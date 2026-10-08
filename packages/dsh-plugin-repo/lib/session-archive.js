/**
 * dsh-plugin-session-archive —— 会话归档：归档会话管理。
 *
 * 基于官方 workspace 注册表（@deepseek-ai/dsh-workspace）的归档集实现：
 * - 归档：ctx.workspaceRegistry.archiveSession(sessionId) —— 归档不清除
 *   workspace 记账，会话从所有分组界面隐藏；活跃会话会被官方活动检查
 *   拒绝（返回明确的 activity 说明），不会误归档正在运行的会话；
 * - 还原：unarchiveSession —— 从归档集移除，会话回到原分组位置；
 * - 删除：永久删除 —— 从归档集移除、从所属 workspace 记账中 detach，
 *   再删除 sessions 根目录下的会话文件（按官方 encodeSegment 规则定位）
 *   与 projcache 标题缓存。
 *
 * 标题来自 storages/session_projcache/sessions/<sid>.json 的投影缓存
 * （与 dsh-controller 相同的读取方式），缺失时显示「(无标题)」。
 *
 * 浏览器半区经设置面板的 settings.section 分区消费
 * /api/dsh-session-archive 路由；服务键为 sessionArchive。
 *
 * @module dsh-plugin-session-archive
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** 浏览器半区使用的 HTTP 路由前缀。 */
export const SESSION_ARCHIVE_API = "/api/dsh-session-archive";

/** 带错误码的管理操作失败。 */
export class SessionArchiveError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "SessionArchiveError";
		this.code = code;
	}
}

/** 解析 $DSH_HOME（DSH_HOME 环境变量优先，其次 ~/.dsh）。 */
export function resolveDshHome() {
	const env = process.env.DSH_HOME?.trim();
	if (env !== undefined && env !== "") return env;
	return join(homedir(), ".dsh");
}

/**
 * 官方 dsh-session-persistence-jsonl 的路径段编码（encodeSegment）复刻：
 * 安全字符（A-Za-z0-9._-，不含 ~）原样保留，其余以 ~XXXX 十六进制转义，
 * "." 与 ".." 特殊处理。用于在 sessions 根目录下定位会话目录。
 */
export function encodeSessionSegment(raw) {
	const text = String(raw);
	if (text.length === 0) throw new SessionArchiveError("session-archive/empty-segment", "路径段不能为空");
	if (text === ".") return "~002E";
	if (text === "..") return "~002E~002E";
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		const ch = text[i];
		if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
		else out += "~" + code.toString(16).toUpperCase().padStart(4, "0");
	}
	return out;
}

/**
 * 读取会话标题：storages/session_projcache/sessions/<sid>.json 的
 * record.rows.title.val（与 dsh-controller 相同的投影缓存读取方式）。
 * @returns `{ [sessionId]: title }`
 */
export async function readSessionTitles(projcacheDir) {
	const titles = {};
	if (!existsSync(projcacheDir)) return titles;
	for (const file of await readdir(projcacheDir)) {
		if (!file.endsWith(".json")) continue;
		const sessionId = file.slice(0, -5);
		try {
			const record = JSON.parse(await readFile(join(projcacheDir, file), "utf8"));
			const value = record?.record?.rows?.title?.val;
			if (typeof value === "string" && value.trim() !== "") titles[sessionId] = value;
		} catch {
			// 单个缓存损坏不影响整体。
		}
	}
	return titles;
}

/**
 * 在 sessions 根目录下定位某会话的目录（扫描全部项目目录，按
 * encodeSessionSegment(sessionId) 匹配目录名）。
 * @returns 命中的会话目录绝对路径数组。
 */
export async function findSessionDirs(sessionsRoot, sessionId) {
	const segment = encodeSessionSegment(sessionId);
	const found = [];
	if (!existsSync(sessionsRoot)) return found;
	for (const entry of await readdir(sessionsRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const candidate = join(sessionsRoot, entry.name, segment);
		if (existsSync(candidate)) found.push(candidate);
	}
	return found;
}

/**
 * 纯函数：把 workspace 记账、归档集与标题合并为会话列表（可脱离 Cordis 测试）。
 * @returns 会话条目数组：{ id, title, workspaceTitle, workspacePath, archived }
 *   排序：未归档在前、已归档在后，同组按标题（中文 locale）排序。
 */
export function buildSessionList(input) {
	const workspaces = input.workspaces ?? [];
	const archivedIds = input.archivedIds ?? [];
	const titles = input.titles ?? {};
	const extraIds = input.extraIds ?? [];
	const archived = new Set(archivedIds);
	const byWorkspace = new Map();
	for (const workspace of workspaces) {
		for (const sessionId of workspace.sessionIds ?? []) {
			if (!byWorkspace.has(sessionId)) byWorkspace.set(sessionId, { title: workspace.title ?? "", path: workspace.path ?? "" });
		}
	}
	const ids = new Set([...byWorkspace.keys(), ...archived, ...extraIds]);
	const sessions = [...ids].map((id) => ({
		id,
		title: typeof titles[id] === "string" && titles[id] !== "" ? titles[id] : "(无标题)",
		workspaceTitle: byWorkspace.get(id)?.title ?? "",
		workspacePath: byWorkspace.get(id)?.path ?? "",
		archived: archived.has(id),
	}));
	sessions.sort((a, b) => {
		if (a.archived !== b.archived) return a.archived ? 1 : -1;
		return a.title.localeCompare(b.title, "zh");
	});
	return sessions;
}

/**
 * dsh-plugin-session-archive 的 Cordis 服务：归档 / 还原 / 删除 + Web 路由。
 * 服务键 `sessionArchive`（ctx.sessionArchive）。
 */
export class SessionArchiveService extends Service {
	static inject = ["workspaceRegistry"];

	static Config = Schema.object({
		/** 会话根目录；留空时自动使用 $DSH_HOME/sessions（或 ~/.dsh/sessions） */
		sessionsDir: Schema.string().default(""),
	});

	constructor(ctx, config) {
		super(ctx, "sessionArchive");
		this.config = config;
		const home = resolveDshHome();
		this.sessionsDir = typeof config.sessionsDir === "string" && config.sessionsDir.trim() !== "" ? config.sessionsDir : join(home, "sessions");
		this.projcacheDir = join(home, "storages", "session_projcache", "sessions");
		ctx.logger.info(`dsh-plugin-session-archive 已激活：会话根 ${this.sessionsDir}`);
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = [
					webCtx.webServer.register({
						kind: "exact",
						path: `${SESSION_ARCHIVE_API}/sessions`,
						handler: (req, res) => this.handleRequest(req, res, "sessions"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SESSION_ARCHIVE_API}/archive`,
						handler: (req, res) => this.handleRequest(req, res, "archive"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SESSION_ARCHIVE_API}/restore`,
						handler: (req, res) => this.handleRequest(req, res, "restore"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SESSION_ARCHIVE_API}/delete`,
						handler: (req, res) => this.handleRequest(req, res, "delete"),
					}),
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "plugin-session-archive: HTTP routes");
			ctx.logger.info(`dsh-plugin-session-archive 路由已注册：${SESSION_ARCHIVE_API}/*`);
		});
	}

	/** 当前快照：workspace 分组 + 归档集 + 标题。 */
	async snapshot() {
		const registry = this.ctx.workspaceRegistry;
		const workspaces = registry.list().map((entity) => ({
			id: entity.id,
			title: entity.title ?? "",
			path: entity.record?.path ?? "",
			sessionIds: [...(entity.record?.sessionIds ?? [])],
		}));
		const archivedIds = [...registry.archivedSessionIds];
		let extraIds = [];
		try {
			const headers = await registry.listStoredHeaders();
			extraIds = headers.map((header) => header.id).filter((id) => typeof id === "string" && id !== "");
		} catch {
			// 头部读取失败不影响列表主体。
		}
		const titles = await readSessionTitles(this.projcacheDir);
		const liveSessions = this.ctx.get("sessions");
		const agents = this.ctx.get("agents");
		const liveIds = [];
		if (liveSessions !== undefined) for (const session of liveSessions.list()) liveIds.push(session.id);
		return {
			workspaces,
			archivedIds,
			sessions: buildSessionList({ workspaces, archivedIds, titles, extraIds }),
			liveIds,
			serviceProbe: { hasSessions: liveSessions !== undefined, hasAgents: agents !== undefined },
		};
	}

	/**
	 * 永久删除，立即生效：
	 * 1. 已实体化（live）会话先处理：正在运行的直接拒绝；空闲的从 live
	 *    存储摘除（发出 session/disposed，会话列表立即移除，无需重启）；
	 * 2. 删文件（校验存在）与标题缓存；
	 * 3. 清归档集与 workspace 记账。
	 */
	async deleteSession(sessionId) {
		const liveSessions = this.ctx.get("sessions");
		const agents = this.ctx.get("agents");
		const live = liveSessions?.get(sessionId);
		if (live !== undefined) {
			const agent = agents?.get(sessionId);
			if (agent !== undefined && agent.status === "running") {
				throw new SessionArchiveError("session-archive/session-running", "该会话正在运行，无法删除；请先停止会话。");
			}
			try {
				const entry = liveSessions.liveEntryFor(live);
				liveSessions.detachEntered(entry);
			} catch (error) {
				throw new SessionArchiveError("session-archive/detach-failed", `无法关闭会话：${error.message}`);
			}
		}
		const dirs = await findSessionDirs(this.sessionsDir, sessionId);
		if (dirs.length === 0) {
			throw new SessionArchiveError("session-archive/not-found", "会话文件不存在或已被删除。");
		}
		for (const dir of dirs) await rm(dir, { recursive: true, force: true });
		await rm(join(this.projcacheDir, `${sessionId}.json`), { force: true });
		const registry = this.ctx.workspaceRegistry;
		await registry.unarchiveSession(sessionId);
		for (const entity of registry.list()) {
			if ((entity.record?.sessionIds ?? []).includes(sessionId)) await entity.detachSession(sessionId);
		}
		return { removedDirs: dirs };
	}

	/** 统一的路由处理器。 */
	async handleRequest(req, res, operation) {
		const json = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (operation === "sessions") {
				if (req.method !== "GET" && req.method !== "HEAD") {
					json(405, { ok: false, code: "session-archive/method", message: "method not allowed" });
					return;
				}
				json(200, { ok: true, ...(await this.snapshot()) });
				return;
			}
			if (req.method !== "POST") {
				json(405, { ok: false, code: "session-archive/method", message: "method not allowed" });
				return;
			}
			let body = {};
			try {
				const chunks = [];
				for await (const chunk of req) chunks.push(chunk);
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
			} catch {
				json(400, { ok: false, code: "session-archive/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			const sessionId = String(body.sessionId ?? "").trim();
			if (sessionId === "") {
				json(400, { ok: false, code: "session-archive/invalid-session", message: "缺少会话 id" });
				return;
			}
			const registry = this.ctx.workspaceRegistry;
			if (operation === "archive") {
				await registry.archiveSession(sessionId);
				json(200, { ok: true, archivedIds: [...registry.archivedSessionIds] });
				return;
			}
			if (operation === "restore") {
				await registry.unarchiveSession(sessionId);
				json(200, { ok: true, archivedIds: [...registry.archivedSessionIds] });
				return;
			}
			if (operation === "delete") {
				const outcome = await this.deleteSession(sessionId);
				json(200, { ok: true, ...outcome, archivedIds: [...registry.archivedSessionIds] });
				return;
			}
			json(404, { ok: false, code: "session-archive/unknown", message: "unknown operation" });
		} catch (error) {
			json(400, { ok: false, code: error.code ?? "session-archive/failure", message: error.message });
		}
	}
}

export default SessionArchiveService;
