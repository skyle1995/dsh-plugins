/**
 * dsh-plugin-session-archive 纯函数冒烟测试（临时目录，不触碰真实会话）。
 * 运行：node packages/dsh-plugin-session-archive/test/smoke.mjs
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildSessionList, encodeSessionSegment, findSessionDirs, readSessionTitles,
} from "../lib/index.js";

let failed = 0;
function check(label, condition) {
	if (condition) console.log(`ok  - ${label}`);
	else {
		failed += 1;
		console.error(`FAIL- ${label}`);
	}
}

const dir = await mkdtemp(join(tmpdir(), "dsh-session-archive-test-"));
try {
	// 1) encodeSessionSegment（官方 encodeSegment 语义）
	check("安全字符原样", encodeSessionSegment("session-abc_1.2") === "session-abc_1.2");
	check("点段转义", encodeSessionSegment(".") === "~002E");
	check("双点段转义", encodeSessionSegment("..") === "~002E~002E");
	check("斜杠转义", encodeSessionSegment("a/b") === "a~002Fb");
	check("波浪号转义", encodeSessionSegment("a~b") === "a~007Eb");

	// 2) findSessionDirs：构造 sessions/<项目>/<编码段> 结构
	const sessionsRoot = join(dir, "sessions");
	const sid = "session-1234-5678";
	await mkdir(join(sessionsRoot, "--Project-A--", encodeSessionSegment(sid)), { recursive: true });
	await mkdir(join(sessionsRoot, "--Project-B--", "session-other"), { recursive: true });
	const found = await findSessionDirs(sessionsRoot, sid);
	check("定位会话目录", found.length === 1 && found[0].endsWith(join("--Project-A--", "session-1234-5678")));
	check("未命中其它会话", (await findSessionDirs(sessionsRoot, "session-other")).length === 1);
	check("不存在的会话为空", (await findSessionDirs(sessionsRoot, "session-nope")).length === 0);

	// 3) readSessionTitles：projcache 形状
	const projcache = join(dir, "projcache");
	await mkdir(projcache, { recursive: true });
	await writeFile(join(projcache, `${sid}.json`), JSON.stringify({ record: { rows: { title: { val: "我的会话" } } } }), "utf8");
	await writeFile(join(projcache, "session-other.json"), JSON.stringify({ record: { rows: { title: { val: null } } } }), "utf8");
	await writeFile(join(projcache, "broken.json"), "{ not json", "utf8");
	const titles = await readSessionTitles(projcache);
	check("标题读取", titles[sid] === "我的会话");
	check("空标题跳过", titles["session-other"] === undefined);
	check("损坏文件跳过", titles["broken"] === undefined);

	// 4) buildSessionList：分组、归档排序、额外 id、未分组
	const list = buildSessionList({
		workspaces: [
			{ id: "w1", title: "项目A", path: "/Volumes/A", sessionIds: [sid, "session-x"] },
		],
		archivedIds: ["session-x"],
		titles: { [sid]: "我的会话", "session-x": "旧会话", "session-orphan": "孤儿会话" },
		extraIds: ["session-orphan"],
	});
	check("包含 3 个会话", list.length === 3);
	const archived = list.find((s) => s.id === "session-x");
	const orphan = list.find((s) => s.id === "session-orphan");
	check("归档标记正确", archived.archived === true && orphan.archived === false);
	check("工作区分组", list.find((s) => s.id === sid).workspaceTitle === "项目A");
	check("未分组会话", orphan.workspaceTitle === "" && orphan.workspacePath === "");
	check("活跃在前归档在后", list[0].archived === false && list.at(-1).archived === true);
	check("无标题占位", buildSessionList({ workspaces: [], archivedIds: ["a"], titles: {}, extraIds: ["a"] })[0].title === "(无标题)");
} finally {
	await rm(dir, { recursive: true, force: true });
}

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("SMOKE OK");
