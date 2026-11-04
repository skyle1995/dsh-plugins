/**
 * MCP 和插件仓库的离线跨平台回归。
 * 参数：无；node --test demo-test/other-plugins.test.mjs，临时文件仅在本目录且自动清理。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const require = createRequire(join(root, "packages/dsh-plugin-mcp/package.json"));
const { Context, Service } = await import(pathToFileURL(require.resolve("@deepseek-ai/cordis")).href);
const mcp = await import("../packages/dsh-plugin-mcp/lib/index.js");
const repo = await import("../packages/dsh-plugin-repo/lib/index.js");
const skills = await import("../packages/dsh-plugin-repo/lib/skills.js");
const archive = await import("../packages/dsh-plugin-repo/lib/session-archive.js");
const { readJsonBody } = await import("../packages/dsh-plugin-repo/lib/request.js");
const catalog = { version: 1, categories: [{ id: "test", presetIds: ["test"] }],
        presets: [{ id: "test", server: { serverName: "test", transport: "stdio" } }] };

/** 创建隔离工作区；参数为测试上下文，返回临时目录并登记清理。 */
async function sandbox(t) {
        const folder = await mkdtemp(join(directory, ".other-plugins-"));
        t.after(() => rm(folder, { recursive: true, force: true }));
        return folder;
}

/** MCP loader 桩；参数为上下文，提供空条目树，不启动 MCP 进程。 */
class StubLoader extends Service {
        /** 注册 loader；参数为上下文，返回实例。 */
        constructor(ctx) { super(ctx, "loader"); }
        /** 解析不存在的条目；参数为 id，始终抛出错误。 */
        resolve(id) { throw new Error(`missing: ${id}`); }
        /** 返回空条目列表；无参数，返回数组。 */
        entries() { return []; }
}

/** 创建真实 MCP 服务；参数为测试上下文，返回服务与目录，自动卸载服务。 */
async function mcpFixture(t) {
        const folder = await sandbox(t);
        const ctx = new Context();
        t.after(() => ctx.fiber.dispose());
        await ctx.plugin(StubLoader, {});
        await ctx.plugin(mcp.McpManagerService, { stateFile: join(folder, "state.json"), presetUrl: "off" });
        const manager = ctx.get("mcpManager");
        await manager.sync("fixture");
        return { folder, ctx, manager };
}

test("MCP 状态写入不碰旧固定临时路径，POSIX 权限与失败清理正确", async (t) => {
        const folder = await sandbox(t);
        const path = join(folder, "state.json");
        await writeFile(`${path}.tmp`, "do-not-touch");
        mcp.saveStateFile(path, [{ serverName: "test" }]);
        assert.equal(mcp.loadStateFile(path).servers[0].serverName, "test");
        assert.equal(await readFile(`${path}.tmp`, "utf8"), "do-not-touch");
        if (process.platform !== "win32") assert.equal((await lstat(path)).mode & 0o777, 0o600);
        const circular = {};
        circular.self = circular;
        assert.throws(() => mcp.saveStateFile(path, [circular]));
        assert.equal(mcp.loadStateFile(path).servers[0].serverName, "test");
        assert.equal((await readdir(folder)).some((name) => name.startsWith(".dsh-mcp-")), false);
});

test("MCP 落盘失败不提前污染内存状态", async (t) => {
        const { folder, manager } = await mcpFixture(t);
        const blocked = join(folder, "blocked");
        await mkdir(blocked);
        manager.stateFile = blocked;
        await assert.rejects(manager.saveServer({ serverName: "test", transport: "stdio", command: process.execPath }));
        assert.equal(manager.servers.length, 0);
        assert.deepEqual(await readdir(blocked), []);
});

test("MCP 投影期间的新请求会补做，不因重入而丢失", async (t) => {
        const { manager } = await mcpFixture(t);
        let release;
        const wait = new Promise((resolveWait) => { release = resolveWait; });
        let runs = 0;
        /** 受控投影桩；无参数，返回空 Promise，首轮等待测试释放。 */
        manager.project = async () => {
                runs += 1;
                if (runs === 1) await wait;
        };
        const first = manager.sync("first");
        const second = manager.sync("second");
        release();
        await Promise.all([first, second]);
        assert.equal(runs, 2);
        assert.equal(manager.syncRunning, false);
});

test("MCP 远程刷新合并并发请求，卸载取消且不写入缓存", async (t) => {
        const { folder, ctx, manager } = await mcpFixture(t);
        const previousFetch = globalThis.fetch;
        t.after(() => { globalThis.fetch = previousFetch; });
        let calls = 0;
        let signal;
        let finish;
        globalThis.fetch = async (url, options) => {
                calls += 1;
                signal = options.signal;
                return new Promise((resolveFetch) => { finish = resolveFetch; });
        };
        manager.presetUrl = "https://catalog.example/presets";
        const first = manager.loadRemotePresets("first");
        const second = manager.loadRemotePresets("second");
        assert.equal(calls, 1);
        await ctx.fiber.dispose();
        assert.equal(signal.aborted, true);
        finish({ ok: true, text: async () => JSON.stringify(catalog) });
        await Promise.all([first, second]);
        assert.equal(manager.presetSource, "bundled");
        assert.deepEqual(await readdir(folder), []);
});

test("MCP 缓存回退仍保留网络失败原因，~user 路径不误展开", async (t) => {
        const { manager } = await mcpFixture(t);
        await writeFile(manager.presetCacheFile, JSON.stringify(catalog));
        const previousFetch = globalThis.fetch;
        t.after(() => { globalThis.fetch = previousFetch; });
        globalThis.fetch = async () => { throw new Error("offline"); };
        manager.presetUrl = "https://catalog.example/presets";
        await manager.loadRemotePresets("test");
        assert.equal(manager.presetSource, "cache");
        assert.equal(manager.presetError, "offline");
        const issues = [];
        assert.equal(mcp.resolveConfigValue("$file:~nobody/no-file", issues), "");
        assert.deepEqual(issues, ["file:~nobody/no-file"]);
        const reference = join(dirname(manager.stateFile), "reference.txt");
        await writeFile(reference, "first-line\r\nignored-line\r\n");
        assert.equal(mcp.resolveConfigValue(`$file:${reference}`, []), "first-line");
        assert.ok(typeof homedir() === "string");
});

test("仓库不存在目录的 404 正确回空数组，分支名和目录名按 API 编码", async () => {
        const config = { owner: "test owner", repo: "test", branch: "feature/mac&windows", catalogDir: "packages" };
        assert.deepEqual(await repo.buildCatalog(config, async () => {
                throw new repo.RepoError("plugin-repo/http", "not found", { status: 404 });
        }), []);
        const calls = [];
        const entries = await repo.buildCatalog(config, async (cfg, path) => {
                calls.push(path);
                return path.includes("/raw/") ? '{"name":"test","version":"1.0.0"}' : [null, { type: "dir", name: "test 包" }];
        });
        assert.equal(entries.length, 1);
        assert.ok(calls[0].includes("test%20owner"));
        assert.ok(calls.every((path) => path.endsWith("?ref=feature%2Fmac%26windows")));
        assert.ok(calls[1].includes("test%20%E5%8C%85"));
        let branchPath;
        await repo.resolveBranchHead(config, async (cfg, path) => {
                branchPath = path;
                return { commit: { id: "commit" } };
        });
        assert.ok(branchPath.endsWith("/branches/feature%2Fmac%26windows"));
});

test("技能编辑保留额外 frontmatter 与 CRLF，禁止新建/改名覆盖", async (t) => {
        const folder = await sandbox(t);
        const source = "---\r\nname: original\r\ndescription: old\r\ndisable-model-invocation: true\r\nuser-invocable: false\r\nwhenToUse: keep\r\ncustom: kept\r\n---\r\n\r\nbody\r\n";
        await writeFile(join(folder, "original.md"), source);
        const previous = await skills.findSkill(folder, "original");
        await skills.saveSkill(folder, { name: "original", description: "new", body: "updated\nsecond line", previous });
        const updated = await readFile(join(folder, "original.md"), "utf8");
        for (const field of ["disable-model-invocation: true", "user-invocable: false", "whenToUse: keep", "custom: kept"]) assert.ok(updated.includes(field));
        assert.ok(updated.includes("\r\n"));
        assert.equal(updated.replaceAll("\r\n", "").includes("\n"), false);
        await assert.rejects(skills.saveSkill(folder, { name: "original", body: "overwrite" }), { code: "skills/exists" });
        await skills.saveSkill(folder, { name: "other", body: "other" });
        await assert.rejects(skills.saveSkill(folder, { name: "other", previous, body: "overwrite" }), { code: "skills/exists" });
        assert.ok((await readFile(join(folder, "other.md"), "utf8")).includes("other"));
        assert.equal((await readdir(folder)).some((name) => name.startsWith(".dsh-skill-")), false);
});

test("技能旧路径伪造不能越界，Windows 保留名限制不强加给 macOS", async (t) => {
        const folder = await sandbox(t);
        const dir = join(folder, "skills");
        await mkdir(dir);
        await writeFile(join(folder, "SKILL.md"), "outside");
        await assert.rejects(skills.saveSkill(dir, { name: "changed", previous: { file: "../SKILL.md", name: "changed" }, body: "bad" }), { code: "skills/not-found" });
        assert.equal(await readFile(join(folder, "SKILL.md"), "utf8"), "outside");
        for (const platform of ["darwin", "linux", "win32"]) {
                assert.equal(skills.sanitizeSkillName("..", platform), "");
                assert.equal(skills.sanitizeSkillName(".", platform), "");
        }
        assert.equal(skills.sanitizeSkillName("CON", "win32"), "");
        assert.equal(skills.sanitizeSkillName("CON", "darwin"), "CON");
        assert.equal(skills.sanitizeSkillName("测试 技能", "darwin"), "测试-技能");
});

test("技能并发新建只有一个成功，模型开关写入保留其它字段", async (t) => {
        const folder = await sandbox(t);
        const results = await Promise.allSettled([
                skills.saveSkill(folder, { name: "one", body: "first" }),
                skills.saveSkill(folder, { name: "one", body: "second" }),
        ]);
        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        await skills.setSkillModelEnabled(folder, "one", false);
        const body = await readFile(join(folder, "one.md"), "utf8");
        assert.ok(body.includes("disable-model-invocation: true"));
        assert.ok(body.includes("name: one"));
});

test("仓库请求拒绝超大数据与非对象 JSON", async () => {
        /** 生成异步请求体；参数为字符串或 Buffer，返回可异步迭代对象。 */
        const request = (body) => ({ async *[Symbol.asyncIterator]() { yield Buffer.from(body); } });
        for (const body of ["null", "[]", "\"text\"", "{bad"]) {
                await assert.rejects(readJsonBody(request(body), repo.RepoError, "plugin-repo"), { code: "plugin-repo/invalid-json" });
        }
        await assert.rejects(readJsonBody(request(Buffer.alloc(1024 * 1024 + 1)), repo.RepoError, "plugin-repo"), { code: "plugin-repo/body-too-large" });
        let status;
        const manager = Object.create(mcp.McpManagerService.prototype);
        await manager.handleOperationRequest({ method: "POST", ...request(Buffer.alloc(1024 * 1024 + 1)) }, {
                writeHead(value) { status = value; }, end() {},
        });
        assert.equal(status, 413);
});

test("会话清理不把特殊 id 当成缓存目录路径", async (t) => {
        const folder = await sandbox(t);
        const sessions = join(folder, "sessions");
        const cache = join(folder, "cache");
        const sid = "../victim";
        await mkdir(join(sessions, "Project", archive.encodeSessionSegment(sid)), { recursive: true });
        await mkdir(cache);
        await writeFile(join(folder, "victim.json"), "outside-cache");
        const ctx = new Context();
        t.after(() => ctx.fiber.dispose());
        /** workspace 注册表桩；参数为上下文，提供离线清理方法。 */
        class Registry extends Service {
                /** 注册服务；参数为上下文，返回实例。 */
                constructor(context) { super(context, "workspaceRegistry"); this.archivedSessionIds = new Set(); }
                /** 列出 workspace；无参数，返回空数组。 */
                list() { return []; }
                /** 取消归档；参数为 id，返回已解决 Promise。 */
                async unarchiveSession(id) {}
        }
        await ctx.plugin(Registry, {});
        await ctx.plugin(archive.SessionArchiveService, { sessionsDir: sessions });
        const service = ctx.get("sessionArchive");
        service.projcacheDir = cache;
        await service.deleteSession(sid);
        assert.equal(await readFile(join(folder, "victim.json"), "utf8"), "outside-cache");
        assert.deepEqual(await archive.findSessionDirs(sessions, sid), []);
});
