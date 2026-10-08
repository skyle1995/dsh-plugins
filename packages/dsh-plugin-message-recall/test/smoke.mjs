/**
 * dsh-plugin-message-recall 纯逻辑冒烟测试（临时目录，不触碰真实会话）。
 * 覆盖 capture.js 与 recall.js 的纯函数：mutationPath、captureFileAt、
 * canonicalPath、mergeTurnCaptures、planRecall、foldSurfaceNodes、
 * planRollback、placeholderContent。
 *
 * 运行：node packages/dsh-plugin-message-recall/test/smoke.mjs
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TurnCaptureRecorder } from "../lib/index.js";
import {
	canonicalPath, captureFileAt, encodeSessionSegment, mergeTurnCaptures, mutationPath,
} from "../lib/capture.js";
import {
	foldSurfaceNodes, placeholderContent, planRecall, planRollback, turnAtSeqMap,
} from "../lib/recall.js";

let failed = 0;
function check(label, condition) {
	if (condition) console.log(`ok  - ${label}`);
	else {
		failed += 1;
		console.error(`FAIL- ${label}`);
	}
}

// ---- 合成事件工厂（seq 手工递增） ----
let seqCounter = 0;
function event(type, data, surfaceOp = undefined) {
	const envelope = { type, seq: seqCounter++, time: seqCounter, data, surfaceOp };
	if (surfaceOp !== undefined) envelope.surfaceOp = surfaceOp;
	return envelope;
}
function user(content) {
	return event("user/message", { role: "user", content: [{ type: "text", text: content }], source: { kind: "user" } }, "append");
}
function assistant(id, content, turn, step) {
	return event("assistant/message", { turn, step, message: { id, role: "assistant", content: [{ type: "text", text: content }], source: { kind: "model" } } }, "append");
}
function toolResult(turn, step) {
	return event("tool/result", { turn, step, message: { id: `t-${seqCounter}`, role: "tool", content: [{ type: "text", text: "ok" }], source: { kind: "tool", callId: "c1" } } }, "append");
}

// 典型第 3 轮：用户提问 + 助手（工具调用）+ 工具结果 + 定稿助手消息
const turn3 = [
	event("turn/start", { turn: 3 }),
	user("把 README 改一下"),
	assistant("m-31", "先读文件", 3, 1),
	toolResult(3, 1),
	assistant("m-32", "已完成修改", 3, 2),
	event("turn/end", { turn: 3, reason: "success" }),
];

{
	// 1) mutationPath
	check("write 捕获", mutationPath("write", { file_path: "a.txt", content: "x" }) === "a.txt");
	check("edit 捕获", mutationPath("edit", { file_path: "a.txt", old_string: "x", new_string: "y" }) === "a.txt");
	check("str_replace create 捕获", mutationPath("str_replace_editor", { command: "create", path: "a.txt" }) === "a.txt");
	check("str_replace view 不捕获", mutationPath("str_replace_editor", { command: "view", path: "a.txt" }) === undefined);
	check("read 不捕获", mutationPath("read", { file_path: "a.txt" }) === undefined);
	check("残缺参数不捕获", mutationPath("write", { file_path: "a.txt" }) === undefined);
	check("非对象不捕获", mutationPath("write", null) === undefined);

	// 2) captureFileAt
	const dir = await mkdtemp(join(tmpdir(), "dsh-message-recall-test-"));
	try {
		const target = join(dir, "file.txt");
		check("不存在 → absent", JSON.stringify(await captureFileAt(target, 100)) === JSON.stringify({ kind: "absent" }));
		await writeFile(target, "hello", "utf8");
		check("小文件 → content", (await captureFileAt(target, 100)).content === "hello");
		check("超限 → oversized", (await captureFileAt(target, 3)).kind === "oversized");
		await mkdir(join(dir, "sub"));
		check("目录 → undefined", await captureFileAt(join(dir, "sub"), 100) === undefined);

		// 3) canonicalPath：符号链接解析 + 不存在路径回退
		await writeFile(join(dir, "real.txt"), "data", "utf8");
		await symlink(join(dir, "real.txt"), join(dir, "link.txt"));
		check("符号链接解析", (await canonicalPath(join(dir, "link.txt"))).endsWith("real.txt"));
		const ghost = join(dir, "ghost", "deep", "file.txt");
		const resolved = await canonicalPath(ghost);
		const realDir = await realpath(dir);
		check("不存在路径回退到祖先", resolved.endsWith(join("deep", "file.txt")) && resolved.startsWith(realDir));

		// 4) encodeSessionSegment
		check("段编码斜杠", encodeSessionSegment("a/b") === "a~002Fb");

		// 5) mergeTurnCaptures：磁盘保留旧轮次，内存同轮覆盖
		const merged = mergeTurnCaptures({ 1: { "/a": { kind: "absent" } }, 2: { "/b": { kind: "content", content: "old" } } }, { 2: { "/b": { kind: "content", content: "new" }, "/c": { kind: "absent" } } });
		check("磁盘旧轮次保留", merged[1]["/a"].kind === "absent");
		check("内存覆盖同轮", merged[2]["/b"].content === "new");
		check("内存新路径并入", merged[2]["/c"].kind === "absent");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}

	// 6) planRecall：定位 + 范围 + 遮蔽序列
	const events = [...turn3];
	{
		const plan = planRecall(events, "m-32");
		check("定位定稿消息", plan.ok === true && plan.turn === 3);
		check("范围为助手首条到轮末", plan.start === turn3[2].seq && plan.end === turn3[4].seq);
		check("遮蔽序列完整", JSON.stringify(plan.shadowedSeqs) === JSON.stringify([turn3[2].seq, turn3[3].seq, turn3[4].seq]));
	}
	check("未知消息失败", planRecall(events, "m-nope").code === "recall/target-not-found");
	check("用户消息不是撤回目标", planRecall(events, turn3[1].data.id).ok === false);

	// 7) turnAtSeqMap：user/message 无 data.turn，靠括号归属
	{
		const map = turnAtSeqMap(events);
		check("用户消息归属轮次", map.get(turn3[1].seq) === 3);
		check("助手消息归属轮次", map.get(turn3[4].seq) === 3);
	}

	// 8) foldSurfaceNodes：先撤回后再次撤回应失败（范围不再完整）
	{
		const after = [
			...events,
			event("user/message", { role: "user", content: [{ type: "text", text: "已撤回" }], source: { kind: "user" } }, { op: "replace", startSeq: turn3[2].seq, endSeq: turn3[4].seq }),
		];
		check("替换后范围不再完整", planRecall(after, "m-32").code === "recall/range-not-intact");
		check("折叠后节点数", foldSurfaceNodes(after).length === events.filter((e) => e.surfaceOp === "append").length - 2);
	}

	// 9) planRollback：后轮触碰跳过 / oversized 跳过 / absent 删除 / content 还原
	{
		const captures = {
			3: {
				"/workspace/a.md": { kind: "content", content: "before-a" },
				"/workspace/created.js": { kind: "absent" },
				"/workspace/huge.bin": { kind: "oversized" },
				"/workspace/later.md": { kind: "content", content: "before-later" },
			},
			4: {
				"/workspace/later.md": { kind: "content", content: "again" },
			},
		};
		const { operations, skipped } = planRollback(captures, 3);
		check("还原操作数", operations.length === 2);
		check("新建文件 → 删除", operations.find((o) => o.path.endsWith("created.js"))?.action === "delete");
		check("内容 → 还原", operations.find((o) => o.path.endsWith("a.md"))?.content === "before-a");
		check("后轮触碰跳过", skipped.find((s) => s.path.endsWith("later.md"))?.reason === "later-modified");
		check("超大跳过", skipped.find((s) => s.path.endsWith("huge.bin"))?.reason === "oversized");
	}

	// 10) placeholderContent
	{
		const text = placeholderContent({ turn: 3, restored: 2, skipped: 1, failed: 1 });
		check("占位文案含轮次", text.includes("第 3 轮"));
		check("占位文案含还原数", text.includes("2 个文件变更已还原"));
		check("占位文案含跳过/失败", text.includes("未还原") && text.includes("还原失败"));
	}

	// 11) 撤回中间轮：前一轮用户提问保留、后一轮不受影响
	{
		const turn4 = [
			event("turn/start", { turn: 4 }),
			user("继续"),
			assistant("m-41", "好", 4, 1),
			event("turn/end", { turn: 4, reason: "success" }),
		];
		const all = [...turn3, ...turn4];
		const plan = planRecall(all, "m-32");
		check("中间轮范围不含后轮", plan.ok === true && plan.end === turn3[4].seq && !plan.shadowedSeqs.includes(turn4[1].seq));
	}
}

// ---- 变更捕获记录器（真实文件系统 + 落盘往返）----
const recDir = await mkdtemp(join(tmpdir(), "dsh-message-recall-recorder-"));
try {
	const work = join(recDir, "work");
	const caps = join(recDir, "captures");
	await mkdir(work, { recursive: true });
	await writeFile(join(work, "a.txt"), "v1", "utf8");

	const session = { id: "rec-session", header: { cwd: work } };
	const recorder = new TurnCaptureRecorder(session, caps, 1024 * 1024, { warn: () => {} });
	check("有 cwd 的会话可记录", recorder.eligible === true);
	recorder.startTurn(3);
	await recorder.capture("write", { content: "x", file_path: "a.txt" });
	await recorder.capture("edit", { old_string: "a", new_string: "b", file_path: "a.txt" });
	await recorder.capture("read", { file_path: "a.txt" });
	await recorder.endTurn(3);
	const canonicalA = await canonicalPath(join(work, "a.txt"));
	const persisted = JSON.parse(await readFile(join(caps, "rec-session", "turn-3.json"), "utf8"));
	check("记录器落盘", persisted.turn === 3 && persisted.sessionId === "rec-session");
	check("同轮同路径只捕获一次", Object.keys(persisted.captures).length === 1);
	check("捕获内容为变更前", persisted.captures[canonicalA]?.kind === "content" && persisted.captures[canonicalA]?.content === "v1");

	// 新文件：absent 捕获
	recorder.startTurn(4);
	await recorder.capture("write", { content: "y", file_path: "new.txt" });
	await recorder.endTurn(4);
	const canonicalNew = await canonicalPath(join(work, "new.txt"));
	const absent = JSON.parse(await readFile(join(caps, "rec-session", "turn-4.json"), "utf8"));
	check("新建文件捕获为 absent", absent.captures[canonicalNew]?.kind === "absent");

	// 无 cwd 的会话不记录
	const noCwd = new TurnCaptureRecorder({ id: "s2", header: { cwd: "" } }, caps, 1024, { warn: () => {} });
	check("无 cwd 会话不记录", noCwd.eligible === false);
	await rm(recDir, { recursive: true, force: true });
} catch (error) {
	if (existsSync(recDir)) await rm(recDir, { recursive: true, force: true }).catch(() => {});
	throw error;
}

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("SMOKE OK");
