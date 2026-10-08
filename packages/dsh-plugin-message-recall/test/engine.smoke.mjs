/**
 * dsh-plugin-message-recall 引擎冒烟测试：用真实的 @deepseek-ai/cordis +
 * @deepseek-ai/dsh-session 构造活跃会话，验证撤回引擎的完整链路——
 * 定位消息、还原文件、surface 替换（真实 surface 校验）与冷会话写路径。
 *
 * 运行：node packages/dsh-plugin-message-recall/test/engine.smoke.mjs
 */
import { Context } from "@deepseek-ai/cordis";
import SessionStore from "@deepseek-ai/dsh-session";
import { SessionId, SessionSeq } from "@deepseek-ai/dsh-session/types";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecallEngine } from "../lib/index.js";
import { encodeSessionSegment } from "../lib/capture.js";

let failed = 0;
function check(label, condition) {
	if (condition) console.log(`ok  - ${label}`);
	else {
		failed += 1;
		console.error(`FAIL- ${label}`);
	}
}

const userMessage = (id, text) => ({ id, role: "user", content: [{ type: "text", text }], source: { kind: "user" } });
const assistantMessage = (id, text) => ({
	id, role: "assistant",
	content: [{ type: "text", text }],
	source: { kind: "model", provider: "test", model: "test-model" },
});
const toolMessage = (id) => ({ id, role: "tool", content: [{ type: "text", text: "ok" }], source: { kind: "tool", callId: "call-1" } });

const dir = await mkdtemp(join(tmpdir(), "dsh-message-recall-engine-"));
try {
	// ---- 场景：第 2 轮修改了 a.txt 并新建 created.txt ----
	const workspace = join(dir, "workspace");
	const capturesDir = join(dir, "captures");
	await mkdir(workspace, { recursive: true });
	const aPath = join(workspace, "a.txt");
	const createdPath = join(workspace, "created.txt");
	await writeFile(aPath, "v1", "utf8");
	// 模拟该轮工具已发生的修改：a.txt 改为 v2，created.txt 新建。
	await writeFile(aPath, "v2", "utf8");
	await writeFile(createdPath, "new", "utf8");

	const sessionId = "engine-session";
	await mkdir(join(capturesDir, encodeSessionSegment(sessionId)), { recursive: true });
	await writeFile(join(capturesDir, encodeSessionSegment(sessionId), "turn-2.json"), JSON.stringify({
		sessionId,
		turn: 2,
		captures: {
			[aPath]: { kind: "content", content: "v1" },
			[createdPath]: { kind: "absent" },
		},
	}), "utf8");

	// ---- 真实 Session：user → assistant(工具) → tool/result → assistant(定稿) ----
	const root = new Context();
	root.plugin(SessionStore);
	// Cordis 插件纤维异步激活：等待 sessions 服务就绪。
	for (let i = 0; i < 50 && root.sessions === undefined; i++) await new Promise((resolve) => setTimeout(resolve, 5));
	check("sessions 服务就绪", root.sessions !== undefined);
	const session = root.sessions.create(SessionId(sessionId), { meta: { cwd: workspace } });
	session.append("turn/start", { turn: 1 });
	session.append("user/message", userMessage("u-1", "你好"), { surfaceOp: "append" });
	session.append("assistant/message", { turn: 1, step: 1, message: assistantMessage("m-1", "你好！"), stream: [] }, { surfaceOp: "append" });
	session.append("turn/end", { turn: 1, reason: "success" });
	session.append("turn/start", { turn: 2 });
	session.append("user/message", userMessage("u-2", "改一下 a.txt 并新建 created.txt"), { surfaceOp: "append" });
	session.append("assistant/message", { turn: 2, step: 1, message: assistantMessage("m-2", "好的，我来改"), stream: [] }, { surfaceOp: "append" });
	session.append("tool/result", { turn: 2, step: 1, message: toolMessage("t-1") }, { surfaceOp: "append" });
	session.append("assistant/message", { turn: 2, step: 2, message: assistantMessage("m-3", "已完成修改"), stream: [] }, { surfaceOp: "append" });
	session.append("turn/end", { turn: 2, reason: "success" });

	const events = [...session.snapshotEvents()];
	const target = events.find((event) => event.type === "assistant/message" && event.data.message.id === "m-3");
	const toolSeq = events.find((event) => event.type === "tool/result").seq;
	const firstAssistantSeq = events.find((event) => event.type === "assistant/message" && event.data.message.id === "m-2").seq;

	// ---- 引擎（活跃会话路径 + 假持久化读句柄） ----
	const engine = new RecallEngine({
		sessions: {
			get: (id) => String(id) === sessionId ? session : undefined,
			flush: async () => true,
			list: () => [session],
		},
		sessionPersistence: {
			stat: async () => undefined,
			open: async (id, access) => ({
				header: session.header,
				read: async (offset, length) => ({ events: session.snapshotEvents(offset, offset + (length ?? 0)) }),
				close: async () => {},
			}),
		},
		logger: { warn: (...args) => console.warn(...args) },
	}, { capturesDir, maxFileBytes: 1024 * 1024 }, () => undefined);

	const result = await engine.recall({ sessionId, messageId: "m-3" });
	check("活跃会话撤回成功", result.ok === true);
	check("标记为活跃会话", result.value.live === true);
	check("a.txt 已还原", await readFile(aPath, "utf8") === "v1");
	check("created.txt 已删除", !existsSync(createdPath));
	check("还原清单含 a.txt", result.value.restored.includes(aPath));
	check("删除清单含 created.txt", result.value.deleted.includes(createdPath));
	check("轮次正确", result.value.turn === 2);

	const userSeq = events.find((event) => event.type === "user/message" && event.data.id === "u-2").seq;
	const nodes = [...session.surface.nodes];
	check("助手消息已移出 surface", !nodes.includes(firstAssistantSeq) && !nodes.includes(target.seq));
	check("工具结果已移出 surface", !nodes.includes(toolSeq));
	check("用户消息已移出 surface", !nodes.includes(userSeq));
	const placeholderSeq = session.snapshotEvents().length - 1;
	check("占位节点进入 surface", nodes.includes(placeholderSeq));
	const messages = session.deriveMessages();
	check("派生历史无助手回复", !messages.some((message) => message.id === "m-3"));
	check("派生历史无工具结果", !messages.some((message) => message.id === "t-1"));
	check("派生历史无原用户消息", !messages.some((message) => message.id === "u-2"));
	check("派生历史含占位消息", messages.some((message) => message.role === "user" && String(message.content?.[0]?.text ?? "").includes("消息已撤回")));

	// 再次撤回同一消息应失败（范围已被遮蔽）。
	const second = await engine.recall({ sessionId, messageId: "m-3" });
	check("重复撤回被拒绝", second.ok === false && (second.error.code === "recall/target-not-found" || second.error.code === "recall/range-not-intact"));


	// ---- 冷会话路径：live 不存在时直接写持久化句柄 ----
	const stored = [...session.snapshotEvents()];
	let appendedEntry = null;
	const coldEngine = new RecallEngine({
		sessions: {
			get: () => undefined,
			flush: async () => false,
		},
		sessionPersistence: {
			stat: async () => ({ header: session.header, revision: {} }),
			open: async (id, access) => {
				if (access === "write") {
					return {
						header: session.header,
						read: async () => ({ events: stored }),
						append: async (batch) => { appendedEntry = batch[0]; stored.push(batch[0]); },
						flush: async () => {},
						close: async () => {},
					};
				}
				return { header: session.header, read: async () => ({ events: stored }), close: async () => {} };
			},
		},
		logger: { warn: () => {} },
	}, { capturesDir, maxFileBytes: 1024 * 1024 }, () => undefined);
	// 换一条消息：冷会话里撤回第 1 轮的定稿消息。
	const coldResult = await coldEngine.recall({ sessionId, messageId: "m-1" });
	check("冷会话撤回成功", coldResult.ok === true && coldResult.value.live === false);
	check("冷会话写入完整信封", appendedEntry !== null
		&& appendedEntry.type === "user/message"
		&& appendedEntry.seq === SessionSeq(stored.length - 1)
		&& appendedEntry.surfaceOp?.op === "replace"
		&& Array.isArray(appendedEntry.sourceEventSeqs)
		&& appendedEntry.sourceEventSeqs.includes(events.find((event) => event.type === "assistant/message" && event.data.message.id === "m-1").seq)
		&& appendedEntry.sourceEventSeqs.includes(events.find((event) => event.type === "user/message" && event.data.id === "u-1").seq));
	check("冷会话 seq 连续", appendedEntry.seq === stored.length - 1);

	// 不存在的消息：业务失败而非崩溃。
	const missing = await engine.recall({ sessionId, messageId: "m-nope" });
	check("未知消息业务失败", missing.ok === false && missing.error.code === "recall/target-not-found");

	// 不存在的会话。
	const noSession = await engine.recall({ sessionId: "ghost-session", messageId: "m-1" });
	check("未知会话业务失败", noSession.ok === false && noSession.error.code === "recall/session-not-found");
	// 空 sessionId：按 messageId 自动定位（此刻活跃会话里 m-1 仍完整）。
	const resolved = new RecallEngine({
		sessions: {
			get: (id) => String(id) === sessionId ? session : undefined,
			flush: async () => true,
			list: () => [session],
		},
		sessionPersistence: {
			stat: async () => undefined,
			open: async (id, access) => ({
				header: session.header,
				read: async (offset, length) => ({ events: session.snapshotEvents(offset, offset + (length ?? 0)) }),
				close: async () => {},
			}),
		},
		logger: { warn: () => {} },
	}, { capturesDir, maxFileBytes: 1024 * 1024 }, () => undefined);
	const fallback = await resolved.recall({ sessionId: "", messageId: "m-1" });
	check("空会话 id 按消息定位会话", fallback.ok === true && fallback.value.live === true);
	const ghost = await resolved.recall({ sessionId: "", messageId: "m-nope" });
	check("定位失败给出业务错误", ghost.ok === false && ghost.error.code === "recall/session-not-found");

	root.dispose?.();
} finally {
	await rm(dir, { recursive: true, force: true });
}

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("ENGINE SMOKE OK");
