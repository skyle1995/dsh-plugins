/**
 * dsh-plugin-message-recall —— 消息撤回插件：撤回助手消息，并连同该轮对
 * 工作区文件的修改一起还原。
 *
 * 宿主半区（lib/index.js）包含三块能力：
 * - 变更捕获记录器：监听根上下文事件，在 write / edit / str_replace_editor
 *   等文件工具执行前把目标文件的「变更前」内容按轮次记录（内存 + 落盘到
 *   $DSH_HOME/dsh-message-recall/<编码会话 id>/turn-<轮次>.json），供撤回时
 *   还原；子代理会话不记录（与官方 workspace-changes 同口径）；
 * - 撤回引擎：注入 sessions + sessionPersistence 的作用域服务，按
 *   { sessionId, messageId } 定位目标轮次，先还原文件、再把该轮助手侧
 *   surface 节点替换为一条「消息已撤回」占位 user/message（surface replace，
 *   对模型与界面可见，后续请求不再携带被遮蔽消息）；
 * - Web 路由：POST /api/dsh-message-recall/recall 供浏览器半区调用，仅注册
 *   在存在 webServer 的 profile 里。
 *
 * 激活由服务可用性驱动：主服务本身无必填依赖（捕获记录器在任意 profile
 * 运行）；撤回引擎与路由分别在 sessions/sessionPersistence、webServer 可用
 * 时才激活。
 *
 * @module dsh-plugin-message-recall
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionSeq } from "@deepseek-ai/dsh-session/types";
import { isDeepStrictEqual } from "node:util";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import {
	canonicalPath,
	captureFileAt,
	encodeSessionSegment,
	mergeTurnCaptures,
	mutationPath,
} from "./capture.js";
import { placeholderContent, planRecall, planRollback } from "./recall.js";

/** 浏览器半区调用撤回的 HTTP 路由。 */
export const RECALL_ROUTE = "/api/dsh-message-recall/recall";

/** 单文件捕获内容的上限（字节），超限的路径只能跳过还原。 */
export const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;

/** 占位消息的生产者 source kind（MessageSourceMap 可扩展，未知 kind 安全回落）。 */
export const PLACEHOLDER_SOURCE_KIND = "message-recall";

/** 解析 $DSH_HOME（DSH_HOME 环境变量优先，其次 ~/.dsh）。 */
export function resolveDshHome() {
	const env = process.env.DSH_HOME?.trim();
	if (env !== undefined && env !== "") return env;
	return join(homedir(), ".dsh");
}

/** 带错误码的撤回失败。 */
export class RecallError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "RecallError";
		this.code = code;
	}
}

/**
 * 单会话的变更捕获记录器：按轮次记录「变更前」状态，随轮次结束落盘。
 * 每轮每个路径只捕获第一次（与官方 workspace-changes 同口径）。
 */
export class TurnCaptureRecorder {
	constructor(session, capturesDir, maxFileBytes, logger) {
		this.session = session;
		this.sessionId = String(session.id);
		this.cwd = typeof session.header?.cwd === "string" && session.header.cwd !== "" ? session.header.cwd : null;
		this.capturesDir = capturesDir;
		this.maxFileBytes = maxFileBytes;
		this.logger = logger;
		this.turn = null;
		this.turns = new Map();
		this.writeTail = Promise.resolve();
	}

	/** 无工作目录的会话不记录。 */
	get eligible() {
		return this.cwd !== null;
	}

	/** turn/start 时更新当前轮次。 */
	startTurn(turn) {
		this.turn = turn;
	}

	/** 内存捕获表：{ [轮次]: { [绝对路径]: Capture } }。 */
	captureMap() {
		const result = {};
		for (const [turn, map] of this.turns) result[String(turn)] = Object.fromEntries(map);
		return result;
	}

	/** 文件工具执行前调用：捕获目标路径的「变更前」状态。 */
	async capture(name, args) {
		if (this.turn === null || this.cwd === null) return;
		const path = mutationPath(name, args);
		if (path === undefined) return;
		let absolute;
		try {
			absolute = await canonicalPath(resolve(this.cwd, path));
		} catch {
			return;
		}
		const turnMap = this.turns.get(this.turn) ?? new Map();
		if (turnMap.has(absolute)) return;
		let value;
		try {
			value = await captureFileAt(absolute, this.maxFileBytes);
		} catch (error) {
			this.logger?.warn(`message-recall: 捕获失败 ${absolute}：${error.message}`);
			return;
		}
		if (value === undefined) return;
		turnMap.set(absolute, value);
		this.turns.set(this.turn, turnMap);
	}

	/** turn/end 时落盘该轮捕获。 */
	async endTurn(turn) {
		if (turn !== this.turn) return;
		await this.persistTurn(turn);
	}

	/** 会话释放时落盘全部未写入的轮次。 */
	async persistAll() {
		for (const turn of this.turns.keys()) await this.persistTurn(turn);
	}

	/** 原子写入单轮捕获文件（临时文件 + rename）。 */
	async persistTurn(turn) {
		const map = this.turns.get(turn);
		if (map === undefined || map.size === 0) return;
		const record = { sessionId: this.sessionId, turn, captures: Object.fromEntries(map) };
		this.writeTail = this.writeTail.then(async () => {
			const dir = join(this.capturesDir, encodeSessionSegment(this.sessionId));
			await mkdir(dir, { recursive: true });
			const target = join(dir, `turn-${turn}.json`);
			const tmp = join(dir, `turn-${turn}.json.${process.pid}.tmp`);
			await writeFile(tmp, JSON.stringify(record), "utf8");
			await rename(tmp, target);
		});
		try {
			await this.writeTail;
		} catch (error) {
			this.logger?.warn(`message-recall: 落盘轮次 ${turn} 失败：${error.message}`);
		}
	}
}

/** 把规划好的回滚操作落到文件系统。 */
async function applyRollback(operations) {
	const restored = [];
	const deleted = [];
	const failed = [];
	for (const operation of operations) {
		try {
			if (operation.action === "delete") {
				await rm(operation.path, { force: true });
				deleted.push(operation.path);
			} else {
				await mkdir(dirname(operation.path), { recursive: true });
				await writeFile(operation.path, operation.content, "utf8");
				restored.push(operation.path);
			}
		} catch (error) {
			failed.push({ path: operation.path, error: error.message });
		}
	}
	return { restored, deleted, failed };
}

/**
 * 撤回引擎：定位消息 → 还原文件 → surface 替换，支持活跃会话与冷会话。
 * 依赖注入面：sessions + sessionPersistence（由宿主服务的作用域提供）。
 */
export class RecallEngine {
	constructor(ctx, { capturesDir, maxFileBytes }, recorderAccess) {
		this.ctx = ctx;
		this.capturesDir = capturesDir;
		this.maxFileBytes = maxFileBytes;
		this.recorderAccess = recorderAccess;
		this.operationTails = new Map();
		this.admissionOpen = true;
	}

	/** 作用域释放后拒绝新操作并排空已接收操作。 */
	dispose() {
		this.admissionOpen = false;
	}

	/** 每个会话串行化撤回操作。 */
	enqueue(sessionId, operation) {
		if (!this.admissionOpen) return Promise.reject(new RecallError("recall/disposed", "message-recall: 服务正在释放"));
		const tail = (this.operationTails.get(sessionId) ?? Promise.resolve()).then(operation);
		const next = tail.then(() => void 0, () => void 0);
		this.operationTails.set(sessionId, next);
		return tail.finally(() => {
			if (this.operationTails.get(sessionId) === next) this.operationTails.delete(sessionId);
		});
	}

	/**
	 * 读取会话事件并返回按写入方式区分的 append：活跃会话走 live.append +
	 * 持久化核实；冷会话直接写持久化句柄。append 事件带完整信封字段。
	 */
	async withSessionEvents(sessionId, operation) {
		const { sessions, sessionPersistence } = this.ctx;
		if (sessions.get(sessionId) === undefined && await sessionPersistence.stat(sessionId) === undefined && sessions.get(sessionId) === undefined) {
			return { ok: false, error: { code: "recall/session-not-found", message: `会话不存在：${sessionId}` } };
		}
		const live = sessions.get(sessionId);
		if (live !== undefined) {
			const snapshot = live.snapshotEvents();
			return operation(snapshot, async (event) => {
				const last = live.append(event.type, event.data, { surfaceOp: event.surfaceOp, sourceEventSeqs: event.sourceEventSeqs });
				if (!await sessions.flush(live)) throw new RecallError("recall/not-durable", `message-recall: 活跃会话 ${sessionId} 没有参与持久化的监听器`);
				const handle = await sessionPersistence.open(sessionId, "read");
				try {
					// handle.read(offset, length) 按逻辑事件数组索引切片；刚追加的
					// 事件索引为操作开始时的快照长度。
					const { events: stored } = await handle.read(snapshot.length, 1);
					const headerOk = isDeepStrictEqual(
						[handle.header.id, handle.header.createdAt, handle.header.cwd],
						[live.header.id, live.header.createdAt, live.header.cwd],
					);
					if (!headerOk || !isDeepStrictEqual(stored[0], last)) {
						throw new RecallError("recall/not-durable", `message-recall: 活跃会话 ${sessionId} 的撤回记录未持久化`);
					}
				} finally {
					await handle.close();
				}
				return { live: true, event: last };
			});
		}
		const handle = await sessionPersistence.open(sessionId, "write");
		try {
			const { events } = await handle.read();
			return await operation(events, async (event) => {
				const lastSeq = events.length === 0 ? -1 : Number(events.at(-1)?.seq ?? -1);
				const entry = { ...event, seq: SessionSeq(lastSeq + 1), time: Date.now() };
				await handle.append([entry]);
				await handle.flush();
				return { live: false, event: entry };
			});
		} finally {
			await handle.close();
		}
	}

	/** 读取某会话的全部捕获（磁盘 + 内存合并）。 */
	async loadCaptures(sessionId) {
		const dir = join(this.capturesDir, encodeSessionSegment(sessionId));
		const disk = {};
		try {
			const entries = await readdir(dir);
			for (const file of entries) {
				if (!/^turn-\d+\.json$/.test(file)) continue;
				try {
					const record = JSON.parse(await readFile(join(dir, file), "utf8"));
					if (record !== null && typeof record === "object" && typeof record.turn === "number" && typeof record.captures === "object") {
						disk[String(record.turn)] = record.captures;
					}
				} catch (error) {
					this.ctx.logger?.warn(`message-recall: 忽略损坏的捕获文件 ${file}：${error.message}`);
				}
			}
		} catch (error) {
			if (error.code !== "ENOENT") this.ctx.logger?.warn(`message-recall: 读取捕获目录失败 ${dir}：${error.message}`);
		}
		const memory = this.recorderAccess?.(sessionId)?.captureMap() ?? {};
		return mergeTurnCaptures(disk, memory);
	}

	/**
	 * 当请求未携带 sessionId 时，按 messageId 在所有活跃会话与持久化会话中
	 * 定位所属会话（撤回按钮的界面动作通常就在当前会话里，活跃会话优先）。
	 * @returns 会话 id，找不到返回空字符串。
	 */
	async resolveSessionId(messageId, seq) {
		const { sessions, sessionPersistence } = this.ctx;
		const matches = (event) => {
			if (Number.isSafeInteger(seq)) return event.seq === seq && (event.type === "user/message" || event.type === "assistant/message");
			if (event.type === "assistant/message") return event.data?.message?.id === messageId;
			if (event.type === "user/message") return event.data?.id === messageId;
			return false;
		};
		const liveList = typeof sessions.list === "function" ? sessions.list() : [];
		for (const live of liveList) {
			try {
				if (live.snapshotEvents().some(matches)) return String(live.id);
			} catch {
				// 单个会话读取失败不阻断扫描。
			}
		}
		const stored = typeof sessionPersistence.list === "function" ? await sessionPersistence.list() : [];
		for (const snapshot of stored) {
			const id = snapshot.header?.id;
			if (id === undefined) continue;
			try {
				const handle = await sessionPersistence.open(id, "read");
				try {
					const { events } = await handle.read();
					if (events.some(matches)) return String(id);
				} finally {
					await handle.close();
				}
			} catch {
				// 单个冷会话读取失败不阻断扫描。
			}
		}
		return "";
	}

	/**
	 * 撤回一条消息：先还原文件变更，再以「消息已撤回」占位节点替换该轮
	 * surface 范围（用户消息与助手回复）。文件还原尽力而为：单个失败不影响
	 * 撤回本身。sessionId 缺省时按 messageId 自动定位会话。
	 *
	 * @returns `{ ok: true, value }` 或 `{ ok: false, error: { code, message } }`。
	 */
	async recall({ sessionId, messageId, seq }) {
		const resolvedSeq = Number.isSafeInteger(seq) ? seq : undefined;
		const target = typeof sessionId === "string" && sessionId.trim() !== "" ? sessionId.trim() : await this.resolveSessionId(messageId, resolvedSeq);
		if (target === "") return { ok: false, error: { code: "recall/session-not-found", message: "找不到包含该消息的会话。" } };
		sessionId = target;
		return this.enqueue(sessionId, () => this.withSessionEvents(sessionId, async (events, append) => {
			const plan = planRecall(events, messageId, resolvedSeq);
			if (!plan.ok) return { ok: false, error: { code: plan.code, message: plan.message } };
			const captures = await this.loadCaptures(sessionId);
			const { operations, skipped } = planRollback(captures, plan.turn);
			const { restored, deleted, failed } = await applyRollback(operations);
			const summary = {
				turn: plan.turn,
				restored: restored.length + deleted.length,
				skipped: skipped.length,
				failed: failed.length,
			};
			const text = placeholderContent(summary);
			const placeholder = createUserMessage({
				content: [{ type: "text", text }],
				source: { kind: PLACEHOLDER_SOURCE_KIND },
			});
			const appended = await append({
				type: "user/message",
				data: placeholder,
				surfaceOp: { op: "replace", startSeq: plan.start, endSeq: plan.end },
				sourceEventSeqs: [...plan.shadowedSeqs],
			});
			return {
				ok: true,
				value: {
					live: appended.live,
					turn: plan.turn,
					restored,
					deleted,
					skipped: skipped.map((entry) => ({ ...entry })),
					failed,
					placeholder: text,
				},
			};
		}));
	}
}

/**
 * dsh-plugin-message-recall 的 Cordis 服务：捕获记录器 + 撤回引擎 + Web 路由。
 * 服务键 `messageRecall`，通过 `ctx.messageRecall` 使用。
 */
export class MessageRecallService extends Service {
	static inject = [];

	/** Cordis 配置契约。 */
	static Config = Schema.object({
		maxFileBytes: Schema.number().default(DEFAULT_MAX_FILE_BYTES),
		capturesDir: Schema.string().default(""),
	});

	constructor(ctx, config) {
		super(ctx, "messageRecall");
		this.config = config;
		this.maxFileBytes = Number.isSafeInteger(config.maxFileBytes) && config.maxFileBytes > 0 ? config.maxFileBytes : DEFAULT_MAX_FILE_BYTES;
		this.capturesDir = (config.capturesDir ?? "").trim() !== "" ? config.capturesDir : join(resolveDshHome(), "dsh-message-recall");
		this.recorders = new Map();
		this.engine = undefined;

		// 1) 捕获记录器（根上下文事件，任意 profile 生效）。
		ctx.effect(() => {
			const onSessionEvent = (session, event) => {
				const recorder = this.recorderFor(session);
				if (recorder === undefined) return;
				if (event.type === "turn/start") recorder.startTurn(event.data.turn);
				else if (event.type === "turn/end") void recorder.endTurn(event.data.turn);
			};
			const onPreExecute = async (exec, next) => {
				const session = exec.agent?.session;
				const recorder = session === undefined ? undefined : this.recorderFor(session);
				if (recorder !== undefined) await recorder.capture(exec.name, exec.arguments);
				return next();
			};
			const onDisposed = (session) => {
				const recorder = this.recorders.get(session);
				if (recorder !== undefined) {
					this.recorders.delete(session);
					void recorder.persistAll();
				}
			};
			const offEvent = ctx.on("session/event", onSessionEvent);
			const offPreExecute = ctx.on("tools/pre-execute", onPreExecute);
			const offDisposed = ctx.on("session/disposed", onDisposed);
			ctx.logger.info(`dsh-plugin-message-recall 捕获记录器已就绪：capturesDir=${this.capturesDir}，maxFileBytes=${this.maxFileBytes}`);
			return () => {
				offEvent();
				offPreExecute();
				offDisposed();
			};
		}, "message-recall: capture recorder");

		// 2) 撤回引擎（依赖 sessions + sessionPersistence 的作用域）。
		ctx.inject(["sessions", "sessionPersistence"], (scope) => {
			this.engine = new RecallEngine(
				scope,
				{ capturesDir: this.capturesDir, maxFileBytes: this.maxFileBytes },
				(sessionId) => {
					for (const [session, recorder] of this.recorders) {
						if (String(session.id) === String(sessionId)) return recorder;
					}
					return undefined;
				},
			);
			scope.effect(() => () => {
				this.engine?.dispose();
				this.engine = undefined;
			}, "message-recall: engine scope");
		});

		// 3) Web 路由（依赖 webServer 的作用域）。
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const dispose = webCtx.webServer.register({
					kind: "exact",
					path: RECALL_ROUTE,
					handler: (req, res) => this.handleRecallRequest(req, res),
				});
				ctx.logger.info(`dsh-plugin-message-recall 路由已注册：${RECALL_ROUTE}`);
				return dispose;
			}, "message-recall: HTTP route");
		});
	}

	/** 某会话的捕获记录器（无 cwd / 子代理会话不记录）。 */
	recorderFor(session) {
		if (session === undefined || typeof session.header?.cwd !== "string" || session.header.cwd === "") return undefined;
		if (session.header.origin === "subagent") return undefined;
		let recorder = this.recorders.get(session);
		if (recorder === undefined) {
			recorder = new TurnCaptureRecorder(session, this.capturesDir, this.maxFileBytes, this.ctx.logger);
			this.recorders.set(session, recorder);
		}
		return recorder;
	}

	/** 撤回一条助手消息并还原该轮文件变更（编程入口，供路由与外部服务使用）。 */
	async recall(request) {
		if (this.engine === undefined) {
			return { ok: false, error: { code: "recall/unavailable", message: "撤回引擎不可用：当前 profile 缺少 sessions / sessionPersistence 服务" } };
		}
		return this.engine.recall(request);
	}

	/** POST {RECALL_ROUTE} —— 撤回一条助手消息并还原该轮文件变更。 */
	async handleRecallRequest(req, res) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "POST") {
				payload(405, { ok: false, code: "recall/method", message: "method not allowed" });
				return;
			}
			let body = {};
			try {
				const chunks = [];
				for await (const chunk of req) chunks.push(chunk);
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
			} catch {
				payload(400, { ok: false, code: "recall/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			const sessionId = String(body.sessionId ?? "").trim();
			const messageId = String(body.messageId ?? "").trim();
			const seq = body.seq === undefined ? undefined : Number(body.seq);
			if (messageId === "" && !Number.isSafeInteger(seq)) {
				payload(400, { ok: false, code: "recall/invalid-request", message: "缺少 messageId 或 seq" });
				return;
			}
			if (this.engine === undefined) {
				payload(503, { ok: false, code: "recall/unavailable", message: "撤回引擎不可用：当前 profile 缺少 sessions / sessionPersistence 服务" });
				return;
			}
			const result = await this.engine.recall({ sessionId, messageId, ...(seq === undefined ? {} : { seq }) });
			payload(result.ok ? 200 : 422, result.ok ? result : { ok: false, code: result.error.code, message: result.error.message });
		} catch (error) {
			payload(500, { ok: false, code: error.code ?? "recall/failure", message: error.message });
		}
	}
}

export default MessageRecallService;
