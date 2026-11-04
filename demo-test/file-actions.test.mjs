/**
 * 文件管理增强插件跨平台回归。
 * 参数：无；运行 node --test demo-test/file-actions.test.mjs，失败返回非零状态。
 * 临时工作区位于本目录并在测试后移除；同一套测试可在 Windows/macOS/Linux 运行。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile, chmod } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const directory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(directory, "../packages/dsh-plugin-file-actions");
const require = createRequire(join(packageDirectory, "package.json"));
const { Context, Service } = await import(pathToFileURL(require.resolve("@deepseek-ai/cordis")).href);
const { default: FileActionsService, sanitizeEntryName, sanitizeZipName, crc32, buildZipBuffer, createZipBuffer } =
        await import(pathToFileURL(join(packageDirectory, "lib/index.js")).href);
const { dosDateTime, writeZipFile } = await import(pathToFileURL(join(packageDirectory, "lib/zip.js")).href);

/** 本地 fs 桩：参数为上下文，提供原生路径解析与工作区包含判定。 */
class StubFs extends Service {
        /** 注册服务；参数为上下文，返回服务实例。 */
        constructor(ctx) { super(ctx, "fs"); }
        /** 解析路径；参数为路径及 cwd，返回文件服务目标。 */
        async resolve(path, options = {}) { return { targetKey: resolve(options.cwd ?? ".", path) }; }
        /** 提取宿主路径；参数为目标，返回绝对路径。 */
        processPath(target) { return target.targetKey; }
        /** 判断包含关系；参数为父子目标，返回布尔值。 */
        contains(parent, child) {
                const path = relative(parent.targetKey, child.targetKey);
                return path === "" || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
        }
}

/** 会话桩：参数为上下文和工作区配置，提供 live 会话。 */
class StubSessions extends Service {
        /** 注册服务；参数为上下文及根目录，返回服务实例。 */
        constructor(ctx, config) { super(ctx, "sessions"); this.root = config.root; }
        /** 列出会话；无参数，返回当前测试会话数组。 */
        list() { return [{ header: { cwd: this.root } }]; }
}

/** 沙箱桩：参数为上下文和工作区配置，提供已知工作区根。 */
class StubPolicy extends Service {
        /** 注册服务；参数为上下文及根目录，返回服务实例。 */
        constructor(ctx, config) { super(ctx, "sandboxPolicy"); this.workspaceRoot = config.root; }
}

/** 创建测试环境；参数为测试上下文及配置，返回工作区与服务，自动清理。 */
async function fixture(t, config = {}) {
        const workspace = await mkdtemp(join(directory, ".file-actions-"));
        const context = new Context();
        t.after(async () => {
                try { await context.fiber.dispose(); }
                finally { await rm(workspace, { recursive: true, force: true }); }
        });
        await context.plugin(StubFs, {});
        await context.plugin(StubSessions, { root: workspace });
        await context.plugin(StubPolicy, { root: workspace });
        await context.plugin(FileActionsService, { maxEditBytes: 1024, ...config });
        return { workspace, actions: context.get("fileActions") };
}

/** 解析中央目录并验证 CRC；参数为 ZIP Buffer，返回条目内容和 Unix 权限映射。 */
function unzip(buffer) {
        const end = buffer.length - 22;
        assert.equal(buffer.readUInt32LE(end), 0x06054b50);
        const count = buffer.readUInt16LE(end + 10);
        let cursor = buffer.readUInt32LE(end + 16);
        const result = new Map();
        for (let n = 0; n < count; n++) {
                assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
                const method = buffer.readUInt16LE(cursor + 10);
                const length = buffer.readUInt32LE(cursor + 20);
                const size = buffer.readUInt32LE(cursor + 24);
                const nameLength = buffer.readUInt16LE(cursor + 28);
                const local = buffer.readUInt32LE(cursor + 42);
                const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
                const raw = buffer.subarray(start, start + length);
                const data = method === 8 ? inflateRawSync(raw) : raw;
                assert.equal(data.length, size);
                assert.equal(crc32(data), buffer.readUInt32LE(cursor + 16));
                const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
                result.set(name, { data, mode: buffer.readUInt32LE(cursor + 38) >>> 16 });
                cursor += 46 + nameLength + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
        }
        return result;
}

test("名称校验区分 Windows 与 macOS/Linux，不擅自截掉 POSIX 空格", () => {
        for (const platform of ["darwin", "linux"]) {
                for (const name of ["CON", "NUL.txt", "name:part", "file.", "file ", " 中文.txt "]) {
                        assert.equal(sanitizeEntryName(name, platform), name);
                }
                assert.equal(sanitizeZipName("dir/CON", platform), "CON.zip");
        }
        for (const name of ["CON", "NUL.txt", "COM1.js", "LPT9", "COM¹.txt", "file.", "file ", "a:b", "a?b", "a\u0001b"]) {
                assert.throws(() => sanitizeEntryName(name, "win32"), { code: "file-actions/invalid-name" });
        }
        assert.throws(() => sanitizeZipName("dir/CON", "win32"), { code: "file-actions/invalid-name" });
        assert.equal(sanitizeZipName("..\\中文包", "win32"), "中文包.zip");
});

test("批量同名在任何写入前拒绝，父子源只操作一次", async (t) => {
        const { workspace, actions } = await fixture(t);
        for (const dir of ["a", "b", "dest"]) await mkdir(join(workspace, dir));
        await writeFile(join(workspace, "a/report.txt"), "one");
        await writeFile(join(workspace, "b/report.txt"), "two");
        for (const operation of ["copyEntries", "moveEntries"]) {
                await assert.rejects(actions[operation]({
                        workspaceRoot: workspace, sources: [join(workspace, "a/report.txt"), join(workspace, "b/report.txt")],
                        destination: join(workspace, "dest"),
                }), { code: "file-actions/exists" });
                assert.deepEqual(await readdir(join(workspace, "dest")), []);
        }
        const copied = await actions.copyEntries({
                workspaceRoot: workspace, sources: [join(workspace, "a"), join(workspace, "a/report.txt"), join(workspace, "a")],
                destination: join(workspace, "dest"),
        });
        assert.equal(copied.count, 1);
        assert.equal(await readFile(join(workspace, "dest/a/report.txt"), "utf8"), "one");
        await assert.rejects(actions.copyEntries({
                workspaceRoot: workspace, sources: [join(workspace, "b")], destination: join(workspace, "b"),
        }), { code: "file-actions/into-itself" });
});

test("按实际目标卷识别大小写与 Unicode 冲突，保留敏感卷上的不同文件", async (t) => {
        const { workspace, actions } = await fixture(t);
        for (const dir of ["a", "b", "dest"]) await mkdir(join(workspace, dir));
        for (const [left, right] of [["Case.txt", "case.txt"], ["é.txt", "e\u0301.txt"]]) {
                const source = join(workspace, "a", left);
                await writeFile(source, "one");
                await writeFile(join(workspace, "b", right), "two");
                const equivalent = await lstat(join(workspace, "a", right)).then(() => true, () => false);
                const request = { workspaceRoot: workspace, sources: [source, join(workspace, "b", right)], destination: join(workspace, "dest") };
                if (equivalent) await assert.rejects(actions.copyEntries(request), { code: "file-actions/exists" });
                else assert.equal((await actions.copyEntries(request)).count, 2);
                for (const name of await readdir(join(workspace, "dest"))) await rm(join(workspace, "dest", name));
        }
});

test("同工作区并发复制只允许一个成功，不覆盖已存在内容", async (t) => {
        const { workspace, actions } = await fixture(t);
        await mkdir(join(workspace, "dest"));
        await writeFile(join(workspace, "source.txt"), "original");
        const request = { workspaceRoot: workspace, sources: [join(workspace, "source.txt")], destination: join(workspace, "dest") };
        const results = await Promise.allSettled([actions.copyEntries(request), actions.copyEntries(request)]);
        assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
        assert.equal(await readFile(join(workspace, "dest/source.txt"), "utf8"), "original");
        assert.equal(actions.mutations.size, 0);
});

test("批量执行中源消失时明确返回已完成项，不误报整个操作成功", async (t) => {
        const { workspace, actions } = await fixture(t);
        await mkdir(join(workspace, "dest"));
        const first = join(workspace, "first.txt");
        const second = join(workspace, "second.txt");
        await writeFile(first, "first");
        await writeFile(second, "second");
        const plan = actions.transferPlan.bind(actions);
        /** 模拟预检后第二个源被外部删除；参数为源及目标，返回原预检计划。 */
        actions.transferPlan = async (hosts, destination) => {
                const result = await plan(hosts, destination);
                await rm(second);
                return result;
        };
        await assert.rejects(actions.copyEntries({
                workspaceRoot: workspace, sources: [first, second], destination: join(workspace, "dest"),
        }), (error) => {
                assert.deepEqual(error.details.completed, [first]);
                assert.equal(error.details.failed, second);
                return true;
        });
        assert.equal(await readFile(join(workspace, "dest/first.txt"), "utf8"), "first");
        assert.equal(actions.mutations.size, 0);
});

test("保存检测外部修改与并发旧版本，原子替换保留 Unix 权限", async (t) => {
        const { workspace, actions } = await fixture(t);
        const path = join(workspace, "script.sh");
        await writeFile(path, "#!/bin/sh\n");
        await chmod(path, 0o755);
        const request = { workspaceRoot: workspace, path };
        const initial = await actions.readTextEntry(request);
        await writeFile(path, "external");
        await assert.rejects(actions.saveTextEntry({ ...request, content: "mine", version: initial.version }), { code: "file-actions/edit-conflict" });
        assert.equal(await readFile(path, "utf8"), "external");
        const latest = await actions.readTextEntry(request);
        const results = await Promise.allSettled([
                actions.saveTextEntry({ ...request, content: "new-one", version: latest.version }),
                actions.saveTextEntry({ ...request, content: "new-two", version: latest.version }),
        ]);
        assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
        assert.equal(await readFile(path, "utf8"), "new-one");
        if (process.platform !== "win32") assert.equal((await lstat(path)).mode & 0o777, 0o755);
        assert.deepEqual(await readdir(workspace), ["script.sh"]);
});

test("文本读取拒绝非法 UTF-8，格式化保留 CRLF 并限制输入和输出", async (t) => {
        const { workspace, actions } = await fixture(t, { maxEditBytes: 64 });
        const path = join(workspace, "code.js");
        const request = { workspaceRoot: workspace, path };
        await writeFile(path, Buffer.from([0xff, 0xfe]));
        await assert.rejects(actions.readTextEntry(request), { code: "file-actions/not-text" });
        await writeFile(path, "x".repeat(65));
        await assert.rejects(actions.readTextEntry(request), { code: "file-actions/too-large" });
        await assert.rejects(actions.formatTextEntry({ ...request, content: "x".repeat(65) }), { code: "file-actions/too-large" });
        const result = await actions.formatTextEntry({ ...request, content: "const a=1;\r\nconst b=2;\r\n" });
        assert.ok(result.content.includes("\r\n"));
        await assert.rejects(actions.saveTextEntry({ ...request, content: "a\0b" }), { code: "file-actions/not-text" });
});

test("流式 ZIP 内容、CRC、权限正确，排除自身且并发命名不覆盖", async (t) => {
        const { workspace, actions } = await fixture(t);
        const folder = join(workspace, "中文目录");
        await mkdir(folder);
        const path = join(folder, "run.sh");
        await writeFile(path, "#!/bin/sh\necho hello\n");
        await chmod(path, 0o755);
        const request = { workspaceRoot: workspace, sources: [folder], destination: folder, name: "bundle" };
        const [one, two] = await Promise.all([actions.compressEntries(request), actions.compressEntries(request)]);
        assert.equal(one.name, "bundle.zip");
        assert.equal(two.name, "bundle (2).zip");
        const entries = unzip(await readFile(join(folder, one.name)));
        assert.equal(entries.get("中文目录/run.sh").data.toString(), "#!/bin/sh\necho hello\n");
        assert.equal([...entries.keys()].some((name) => name.includes(".dsh-zip-")), false);
        if (process.platform !== "win32") assert.equal(entries.get("中文目录/run.sh").mode & 0o777, 0o755);
        assert.equal((await readdir(folder)).some((name) => name.startsWith(".dsh-")), false);
});

test("ZIP 总量和条目上限失败无残留，单文件超限跳过", async (t) => {
        const { workspace, actions } = await fixture(t, { maxZipTotalBytes: 3, maxZipFileBytes: 10 });
        const folder = join(workspace, "src");
        await mkdir(folder);
        await writeFile(join(folder, "one"), "1234");
        const request = { workspaceRoot: workspace, sources: [folder], destination: workspace };
        await assert.rejects(actions.compressEntries(request), { code: "file-actions/zip-limit" });
        assert.deepEqual(await readdir(workspace), ["src"]);
        await assert.rejects(writeZipFile([folder], join(workspace, "limit.zip"), { maxEntries: 1 }), { code: "file-actions/zip-limit" });
        await assert.rejects(createZipBuffer([folder], { maxTotalBytes: 3 }), { code: "file-actions/zip-limit" });
        const result = await writeZipFile([folder], join(workspace, "skip.zip"), { maxFileBytes: 2 });
        assert.equal(result.skipped, 1);
        assert.equal(unzip(await readFile(join(workspace, "skip.zip"))).size, 1);
        const existing = await readFile(join(workspace, "skip.zip"));
        await assert.rejects(writeZipFile([folder], join(workspace, "skip.zip")), { code: "EEXIST" });
        assert.deepEqual(await readFile(join(workspace, "skip.zip")), existing);
        assert.throws(() => buildZipBuffer(Array.from({ length: 65536 }, () => ({ name: "x", dir: true }))), { code: "file-actions/zip-limit" });
        for (const time of [new Date(1900, 0, 1), new Date(2200, 0, 1), "bad-date"]) {
                const date = dosDateTime(time);
                assert.ok(date.date >= 0 && date.date <= 65535);
                assert.doesNotThrow(() => buildZipBuffer([{ name: "old.txt", data: Buffer.from("old"), mtime: time }]));
        }
});

test("HTTP 拒绝超大请求、非对象 JSON 与过量路径", async (t) => {
        const { workspace, actions } = await fixture(t, { maxEditBytes: 1, maxBatchPaths: 1 });
        /** 调用路由；参数为分块请求，返回状态与响应对象。 */
        const send = async (chunks) => {
                let status;
                let body;
                await actions.handleRequest({
                        method: "POST",
                        async *[Symbol.asyncIterator]() { yield* chunks; },
                }, {
                        writeHead(value) { status = value; },
                        end(value) { body = JSON.parse(value); },
                }, "copy");
                return { status, body };
        };
        assert.equal((await send([Buffer.alloc(65543)])).status, 413);
        assert.equal((await send([Buffer.from("null")])).body.code, "file-actions/bad-request");
        assert.equal((await send([Buffer.from("[]")])).body.code, "file-actions/bad-request");
        const response = await send([Buffer.from(JSON.stringify({ workspaceRoot: workspace, sources: ["a", "b"], destination: workspace }))]);
        assert.equal(response.body.code, "file-actions/too-many-paths");
});
