/**
 * dsh-plugin-message-recall 真实持久化冷路径测试：用真实的
 * @deepseek-ai/dsh-session-persistence-jsonl 后端（compression: 'none'）
 * 构造冷会话，验证撤回引擎的冷路径在真实句柄上的完整行为——
 * create/append/flush/read 的索引语义、占位节点的 seq 连续性、文件还原。
 *
 * 运行：node packages/dsh-plugin-message-recall/test/persistence.smoke.mjs
 */
import { Context } from "@deepseek-ai/cordis";
import PersistenceBackend from "@deepseek-ai/dsh-session-persistence-jsonl";
import { SESSION_FORMAT_VERSION } from "@deepseek-ai/dsh-session";
import { SessionId } from "@deepseek-ai/dsh-session/types";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const assistantMessage = (id, text) => ({ id, role: "assistant", content: [{ type: "text", text }], source: { kind: "model", provider: "test", model: "test-model" } });

const dir = await mkdtemp(join(tmpdir(), "dsh-message-recall-persist-"));
try {
	const workspace = join(dir, "workspace");
	const capturesDir = join(dir, "captures");
	await mkdir(workspace, { recursive: true });
	const aPath = join(workspace, "a.txt");
	await writeFile(aPath, "v2", "utf8");

	const sessionId = "persist-session";
	await mkdir(join(capturesDir, encodeSessionSegment(sessionId)), { recursive: true });
	await writeFile(join(capturesDir, encodeSessionSegment(sessionId), "turn-1.json"), JSON.stringify({
		sessionId,
		turn: 1,
		captures: { [aPath]: { kind: "content", content: "v1" } },
	}), "utf8");

	// ---- 真实后端（纯文本 JSONL，便于断言）----
	const root = new Context();
	await root.plugin(PersistenceBackend, { root: dir, compression: "none" });
	for (let i = 0; i < 50 && root.sessionPersistence === undefined; i++) await new Promise((resolve) => setTimeout(resolve, 5));
	const persistence = root.sessionPersistence;
	check("真实持久化服务就绪", persistence !== undefined);

	// 构造冷会话：第 1 轮 用户提问 → 助手定稿（m-1）。
	const handle = await persistence.create({ version: SESSION_FORMAT_VERSION, id: SessionId(sessionId), createdAt: Date.now(), cwd: workspace, isSeeded: false, delegationDepth: 0 });
	const entries = [
		{ seq: 0, time: 1, type: "turn/start", data: { turn: 1 } },
		{ seq: 1, time: 2, type: "user/message", data: userMessage("u-1", "把 a.txt 改成 v2"), surfaceOp: "append" },
		{ seq: 2, time: 3, type: "step/start", data: { turn: 1, step: 1 } },
		{ seq: 3, time: 4, type: "assistant/message", data: { turn: 1, step: 1, message: assistantMessage("m-1", "已修改"), stream: [] }, surfaceOp: "append" },
		{ seq: 4, time: 5, type: "step/end", data: { turn: 1, step: 1 } },
		{ seq: 5, time: 6, type: "turn/end", data: { turn: 1, reason: "success" } },
	];
	await handle.append(entries);
	await handle.flush();
	await handle.close();
	check("冷会话已创建", (await persistence.stat(sessionId)) !== undefined);

	// ---- 引擎冷路径：真实句柄 ----
	const engine = new RecallEngine({
		sessions: { get: () => undefined, flush: async () => false },
		sessionPersistence: persistence,
		logger: { warn: () => {} },
	}, { capturesDir, maxFileBytes: 1024 * 1024 }, () => undefined);

	const result = await engine.recall({ sessionId, messageId: "m-1" });
	check("冷会话撤回成功", result.ok === true && result.value.live === false);
	check("a.txt 已还原", await readFile(aPath, "utf8") === "v1");

	// 占位节点真实落盘：读回完整日志，最后一条是 surface replace 的 user/message。
	const verify = await persistence.open(sessionId, "read");
	const { events: stored } = await verify.read();
	await verify.close();
	const placeholder = stored.at(-1);
	check("提示消息已落盘（append，不折叠）", placeholder.type === "user/message" && placeholder.surfaceOp === "append");
	check("原始消息保留", stored.some((event) => event.seq === 1) && stored.some((event) => event.seq === 3));
	check("提示 seq 连续", placeholder.seq === 6 && stored.length === 7);
	check("提示文案正确", String(placeholder.data?.content?.[0]?.text ?? "").includes("已撤回第 1 轮的编辑"));

	// 原始 JSONL 文件可读且含占位（compression none 的物理形态）。
	// 布局：<root>/<projectKey(cwd)>/<encodedId>/session.v4.jsonl
	const projectDirs = (await readdir(dir)).filter((name) => name.startsWith("--"));
	check("项目分组目录存在", projectDirs.length === 1);
	const logDir = join(dir, projectDirs[0], encodeSessionSegment(sessionId));
	const files = (await readdir(logDir)).filter((name) => name.endsWith(".jsonl"));
	check("纯文本 JSONL 存在", files.length === 1);
	const raw = await readFile(join(logDir, files[0]), "utf8");
	check("原始日志含提示", raw.includes("已撤回第 1 轮的编辑"));
	check("重复撤回幂等成功", (await engine.recall({ sessionId, messageId: "m-1" })).ok === true);

	root.dispose?.();
} finally {
	await rm(dir, { recursive: true, force: true });
}

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("PERSISTENCE SMOKE OK");
