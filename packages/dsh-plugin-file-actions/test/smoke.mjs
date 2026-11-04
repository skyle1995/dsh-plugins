/**
 * dsh-plugin-file-actions 服务冒烟测试（脱离 DSH profile 独立运行）：
 * 用真实 cordis 起最小 Context，注入桩 fs / sessions / sandboxPolicy /
 * webServer，验证 copy / move / delete / compress 的完整链路与安全约束，
 * 并独立解析生成的 ZIP（EOCD + central directory + inflate）核对内容。
 * 运行：node packages/dsh-plugin-file-actions/test/smoke.mjs
 */
import { Context, Service } from "@deepseek-ai/cordis";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const require = createRequire(import.meta.url);
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { default: FileActionsService, crc32 } = await import(pathToFileURL(resolve(pkgDir, "lib/index.js")).href);

/** 桩 fs：镜像 dsh-fs-local 的 resolve/processPath/contains 行为（不做 realpath）。 */
class StubFs extends Service {
	constructor(ctx) {
		super(ctx, "fs");
	}
	async resolve(path, opts = {}) {
		const base = opts.cwd ?? ".";
		const targetKey = isAbsolute(String(path)) ? String(path) : resolve(base, String(path));
		return { targetKey, displayPath: targetKey };
	}
	processPath(target) {
		return String(target.targetKey);
	}
	contains(parent, child) {
		const p = this.processPath(parent);
		const c = this.processPath(child);
		const rel = relative(p, c);
		return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
	}
}

/** 桩 sessions：一个 live 会话，其 header.cwd 指向测试工作区。 */
class StubSessions extends Service {
	constructor(ctx, config) {
		super(ctx, "sessions");
		this.workspaceRoot = config.workspaceRoot;
	}
	list() {
		return [{ header: { cwd: this.workspaceRoot } }];
	}
	get() {
		return undefined;
	}
}

/** 桩 sandboxPolicy：一个与工作区无关的沙箱根。 */
class StubPolicy extends Service {
	constructor(ctx, config) {
		super(ctx, "sandboxPolicy");
		this.workspaceRoot = config.workspaceRoot;
	}
}

/** 桩 webServer：记录注册的路由。 */
class StubWebServer extends Service {
	constructor(ctx) {
		super(ctx, "webServer");
		this.routes = new Map();
	}
	register(route) {
		this.routes.set(route.path, route.handler);
		return () => this.routes.delete(route.path);
	}
}

async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

/** 极简 ZIP 读取器：核对条目数与单个已知文件的内容。 */
function readZipNames(buffer) {
	const sig = 0x06054b50;
	let eocd = -1;
	for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
		if (buffer.readUInt32LE(i) === sig) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error("ZIP EOCD 未找到");
	const count = buffer.readUInt16LE(eocd + 10);
	const centralOffset = buffer.readUInt32LE(eocd + 16);
	const names = [];
	let cursor = centralOffset;
	for (let n = 0; n < count; n++) {
		if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("central directory 签名错误");
		const method = buffer.readUInt16LE(cursor + 10);
		const crc = buffer.readUInt32LE(cursor + 16);
		const compressed = buffer.readUInt32LE(cursor + 20);
		const size = buffer.readUInt32LE(cursor + 24);
		const nameLen = buffer.readUInt16LE(cursor + 28);
		const extraLen = buffer.readUInt16LE(cursor + 30);
		const commentLen = buffer.readUInt16LE(cursor + 32);
		const localOffset = buffer.readUInt32LE(cursor + 42);
		const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLen);
		names.push(name);
		// 校验 local header 与数据（目录条目无数据）。
		if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`local header 签名错误：${name}`);
		const localNameLen = buffer.readUInt16LE(localOffset + 26);
		const localExtraLen = buffer.readUInt16LE(localOffset + 28);
		const dataStart = localOffset + 30 + localNameLen + localExtraLen;
		const raw = buffer.subarray(dataStart, dataStart + compressed);
		if (method === 8) {
			const data = inflateRawSync(raw);
			if (data.length !== size) throw new Error(`解压长度不符：${name}`);
			if (crc32(data) !== crc) throw new Error(`CRC 不符：${name}`);
		}
		cursor += 46 + nameLen + extraLen + commentLen;
	}
	return names;
}

// ─── 准备工作区 ────────────────────────────────────────────────────────────
const workspace = await mkdtemp(join(tmpdir(), "dsh-file-actions-"));
const outside = await mkdtemp(join(tmpdir(), "dsh-file-actions-outside-"));
await mkdir(join(workspace, "sub", "nested"), { recursive: true });
await mkdir(join(workspace, "dest"), { recursive: true });
await writeFile(join(workspace, "hello.txt"), "hello dsh\n");
await writeFile(join(workspace, "sub", "a.txt"), "alpha\n");
await writeFile(join(workspace, "sub", "nested", "中文 文件.txt"), "中文内容\n");
await writeFile(join(outside, "sneaky.txt"), "outside\n");

// ─── 起 Context ────────────────────────────────────────────────────────────
const root = new Context();
await root.plugin(StubFs, {});
await root.plugin(StubSessions, { workspaceRoot: workspace });
await root.plugin(StubPolicy, { workspaceRoot: join(workspace, "sandbox-only") });
await root.plugin(StubWebServer, {});
await root.plugin(FileActionsService, { maxZipFileBytes: 8 * 1024 * 1024 });
const actions = root.get("fileActions");
if (!actions) throw new Error("fileActions 服务未激活");

// ─── 1) 复制 ───────────────────────────────────────────────────────────────
const copied = await actions.copyEntries({ workspaceRoot: workspace, sources: [join(workspace, "sub")], destination: join(workspace, "dest") });
console.log("copy:", JSON.stringify(copied));
if (copied.count !== 1) throw new Error("复制数量不符");
if (!(await exists(join(workspace, "dest", "sub", "nested", "中文 文件.txt")))) throw new Error("复制结果缺失（中文路径）");

// 同名冲突
let conflict = false;
try {
	await actions.copyEntries({ workspaceRoot: workspace, sources: [join(workspace, "sub")], destination: join(workspace, "dest") });
} catch (error) {
	conflict = error.code === "file-actions/exists";
}
if (!conflict) throw new Error("同名冲突未按预期报错");

// ─── 2) 移动 ───────────────────────────────────────────────────────────────
const moved = await actions.moveEntries({ workspaceRoot: workspace, sources: [join(workspace, "hello.txt")], destination: join(workspace, "dest") });
console.log("move:", JSON.stringify(moved));
if (!(await exists(join(workspace, "dest", "hello.txt"))) || (await exists(join(workspace, "hello.txt")))) throw new Error("移动结果不符");

// ─── 3) 压缩 ───────────────────────────────────────────────────────────────
const zipped = await actions.compressEntries({ workspaceRoot: workspace, sources: [join(workspace, "dest", "sub")], destination: join(workspace, "dest") });
console.log("compress:", JSON.stringify(zipped));
if (zipped.name !== "sub.zip" || zipped.count !== 1 || zipped.skipped !== 0) throw new Error("压缩统计不符");
const zipNames = readZipNames(await readFile(join(workspace, "dest", zipped.name)));
console.log("zip entries:", zipNames.join(", "));
if (!zipNames.includes("sub/") || !zipNames.includes("sub/a.txt") || !zipNames.includes("sub/nested/中文 文件.txt")) throw new Error("ZIP 条目不符");
// 再次压缩应自动改名 sub (2).zip
const zipped2 = await actions.compressEntries({ workspaceRoot: workspace, sources: [join(workspace, "dest", "sub")], destination: join(workspace, "dest") });
if (zipped2.name !== "sub (2).zip") throw new Error("压缩包命名去重不符：" + zipped2.name);
// 自定义压缩包名：剥离目录部分（防穿越）、自动补 .zip 后缀
const zipped3 = await actions.compressEntries({ workspaceRoot: workspace, sources: [join(workspace, "dest", "sub")], destination: join(workspace, "dest"), name: "../我的包" });
console.log("compress(name):", zipped3.name);
if (zipped3.name !== "我的包.zip") throw new Error("自定义压缩包名不符：" + zipped3.name);
if (!(await exists(join(workspace, "dest", "我的包.zip")))) throw new Error("自定义压缩包未生成");

// ─── 4) 删除 ───────────────────────────────────────────────────────────────
const deleted = await actions.deleteEntries({ workspaceRoot: workspace, paths: [join(workspace, "dest", "sub")] });
console.log("delete:", JSON.stringify(deleted));
if (deleted.count !== 1 || deleted.missing !== 0) throw new Error("删除统计不符");
if (await exists(join(workspace, "dest", "sub"))) throw new Error("删除未生效");

// ─── 4.2) 重命名：文件 / 目录 / 非法名字 / 冲突 / 边界 ──────────────────
await mkdir(join(workspace, "ren", "inner"), { recursive: true });
await writeFile(join(workspace, "ren", "a.txt"), "a\n");
const renamed = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren", "a.txt"), name: "b.txt" });
console.log("rename(file):", JSON.stringify(renamed));
if (renamed.name !== "b.txt" || renamed.from !== "a.txt") throw new Error("文件重命名返回值不符");
if (!(await exists(join(workspace, "ren", "b.txt"))) || (await exists(join(workspace, "ren", "a.txt")))) throw new Error("文件重命名未生效");
// 目录重命名：子项随目录一起走
const renamedDir = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren"), name: "ren2" });
console.log("rename(dir):", JSON.stringify(renamedDir));
if (!(await exists(join(workspace, "ren2", "inner"))) || (await exists(join(workspace, "ren")))) throw new Error("目录重命名未生效");
// 名字未变：返回 unchanged，不产生写操作
const unchanged = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren2", "b.txt"), name: "b.txt" });
if (unchanged.unchanged !== true) throw new Error("同名重命名应返回 unchanged");
// 重命名到目录名（目标已存在）→ exists
const renameClash = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren2", "b.txt"), name: "inner" }).then(() => null, (error) => error);
console.log("rename(clash):", renameClash?.code);
if (renameClash?.code !== "file-actions/exists") throw new Error("重命名同名冲突未按预期报错：" + renameClash?.code);
// 非法名字（含分隔符 / 空 / ".." / NUL）一律拒绝
for (const bad of ["x/y.txt", "", "..", ".", "a\\b.txt", "a\0b"]) {
	const rejected = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren2", "b.txt"), name: bad }).then(() => false, (error) => error?.code === "file-actions/invalid-name");
	if (!rejected) throw new Error(`非法重命名名字未被拒绝：${JSON.stringify(bad)}`);
}
// 工作区根目录本身不可重命名
const rootRename = await actions.renameEntry({ workspaceRoot: workspace, path: workspace, name: "nope" }).then(() => false, (error) => error?.code === "file-actions/workspace-root");
if (!rootRename) throw new Error("工作区根目录未被保护（重命名）");
// 不存在的路径 → not-found
const ghostRename = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "nope.txt"), name: "x.txt" }).then(() => false, (error) => error?.code === "file-actions/not-found");
if (!ghostRename) throw new Error("不存在的路径未被拒绝（重命名）");
// 工作区外的路径 → outside-workspace
const outRename = await actions.renameEntry({ workspaceRoot: workspace, path: join(outside, "sneaky.txt"), name: "x.txt" }).then(() => false, (error) => error?.code === "file-actions/outside-workspace");
if (!outRename) throw new Error("工作区外的路径未被拒绝（重命名）");
// 仅改大小写：大小写敏感卷上是普通改名，不敏感卷上命中同一 inode 也应放行
await writeFile(join(workspace, "ren2", "Case.txt"), "c\n");
const caseRename = await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "ren2", "Case.txt"), name: "case.txt" });
if (caseRename.name !== "case.txt" || !(await exists(join(workspace, "ren2", "case.txt")))) throw new Error("大小写重命名未生效");
// 目录带扩展名的重命名不改变类型
await mkdir(join(workspace, "dir.with.dot", "sub"), { recursive: true });
await actions.renameEntry({ workspaceRoot: workspace, path: join(workspace, "dir.with.dot"), name: "dir.v2" });
if (!(await exists(join(workspace, "dir.v2", "sub")))) throw new Error("带点目录重命名未生效");

// ─── 4.5) 文本编辑：读取 / 保存 / 一键格式化 ─────────────────────────────
const jsonSource = '{"name":"dsh-plugin-file-actions","items":[1,2,3,4,5,6,7,8,9,10],"nested":{"key":"value","flag":true}}';
await writeFile(join(workspace, "code.json"), jsonSource);
const readBack = await actions.readTextEntry({ workspaceRoot: workspace, path: join(workspace, "code.json") });
console.log("read:", JSON.stringify(readBack).slice(0, 90));
if (readBack.content !== jsonSource) throw new Error("读取内容不符");
const formatted = await actions.formatTextEntry({ workspaceRoot: workspace, path: join(workspace, "code.json"), content: readBack.content });
console.log("format:", JSON.stringify(formatted.content).slice(0, 120));
if (!formatted.content.includes("\n")) throw new Error("格式化结果未换行");
if (JSON.stringify(JSON.parse(formatted.content)) !== JSON.stringify(JSON.parse(jsonSource))) throw new Error("格式化改变了数据内容");
const saved = await actions.saveTextEntry({ workspaceRoot: workspace, path: join(workspace, "code.json"), content: formatted.content });
console.log("save:", JSON.stringify(saved));
if ((await readFile(join(workspace, "code.json"), "utf8")) !== formatted.content) throw new Error("保存内容不符");
let unsupported = false;
try {
	await actions.formatTextEntry({ workspaceRoot: workspace, path: join(workspace, "code.xyz"), content: "x" });
} catch (error) {
	unsupported = error.code === "file-actions/format-unsupported";
}
if (!unsupported) throw new Error("未知类型未按预期拒绝格式化");
await writeFile(join(workspace, "bin.dat"), Buffer.from([0x00, 0x01]));
let notText = false;
try {
	await actions.readTextEntry({ workspaceRoot: workspace, path: join(workspace, "bin.dat") });
} catch (error) {
	notText = error.code === "file-actions/not-text";
}
if (!notText) throw new Error("NUL 文件未按预期拒绝");

// ─── 5) 安全约束 ───────────────────────────────────────────────────────────
let outsideRejected = false;
try {
	await actions.deleteEntries({ workspaceRoot: workspace, paths: [join(outside, "sneaky.txt")] });
} catch (error) {
	outsideRejected = error.code === "file-actions/outside-workspace";
}
if (!outsideRejected) throw new Error("工作区外的路径未被拒绝");

let rootProtected = false;
try {
	await actions.deleteEntries({ workspaceRoot: workspace, paths: [workspace] });
} catch (error) {
	rootProtected = error.code === "file-actions/workspace-root";
}
if (!rootProtected) throw new Error("工作区根目录未被保护");

let badWorkspace = false;
try {
	await actions.deleteEntries({ workspaceRoot: outside, paths: [join(outside, "sneaky.txt")] });
} catch (error) {
	badWorkspace = error.code === "file-actions/no-workspace";
}
if (!badWorkspace) throw new Error("未知工作区未被拒绝");

// ─── 6) HTTP 路由（走 handleRequest 全链路） ──────────────────────────────
await new Promise((done) => setImmediate(done));
const web = root.get("webServer");
for (const op of ["copy", "move", "rename", "delete", "compress", "read", "save", "format"]) {
	if (!web.routes.has(`/api/dsh-file-actions/${op}`)) throw new Error(`路由未注册：${op}`);
}
const captured = { status: 0, body: null };
const fakeReq = {
	method: "POST",
	async *[Symbol.asyncIterator]() {
		yield Buffer.from(JSON.stringify({ workspaceRoot: workspace, sources: [join(workspace, "dest", "sub.zip")], destination: workspace }));
	},
};
const fakeRes = {
	writeHead(status, headers) {
		captured.status = status;
		captured.headers = headers;
	},
	end(chunk) {
		captured.body = JSON.parse(chunk);
	},
};
await web.routes.get("/api/dsh-file-actions/copy")(fakeReq, fakeRes);
console.log("http copy:", captured.status, JSON.stringify(captured.body));
if (captured.status !== 200 || captured.body.ok !== true) throw new Error("HTTP 成功链路结果不符");
await web.routes.get("/api/dsh-file-actions/copy")(fakeReq, fakeRes);
console.log("http copy(again):", captured.status, JSON.stringify(captured.body));
if (captured.status !== 400 || captured.body.code !== "file-actions/exists") throw new Error("HTTP 冲突链路结果不符");
// 重命名走同一条路由链路
await writeFile(join(workspace, "http-ren.txt"), "r\n");
const renameReq = {
	method: "POST",
	async *[Symbol.asyncIterator]() {
		yield Buffer.from(JSON.stringify({ workspaceRoot: workspace, path: join(workspace, "http-ren.txt"), name: "http-ren2.txt" }));
	},
};
await web.routes.get("/api/dsh-file-actions/rename")(renameReq, fakeRes);
console.log("http rename:", captured.status, JSON.stringify(captured.body));
if (captured.status !== 200 || captured.body.ok !== true || captured.body.name !== "http-ren2.txt") throw new Error("HTTP 重命名链路结果不符");
if (!(await exists(join(workspace, "http-ren2.txt")))) throw new Error("HTTP 重命名未生效");

console.log("SMOKE OK");
await root.fiber.dispose();
await rm(workspace, { recursive: true, force: true });
await rm(outside, { recursive: true, force: true });
