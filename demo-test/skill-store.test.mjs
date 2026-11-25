/**
 * 技能目录、元信息、内存 ZIP 和商店安装的离线回归。
 * 参数：无；运行 node --test demo-test/skill-store.test.mjs，返回测试退出码。
 * 临时文件限定在 demo-test，测试后清理，不执行技能脚本或访问外网。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { SkillStore } from "../packages/dsh-plugin-repo/lib/skill-store.js";
import { readSkillMetadata } from "../packages/dsh-plugin-repo/lib/skill-metadata.js";
import { decodeSkillArchive, entryPath, validSkillId } from "../packages/dsh-plugin-repo/lib/skill-archive.js";
import { SkillManagerService } from "../packages/dsh-plugin-repo/lib/skills.js";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const config = { gitHost: "https://skills.example", owner: "test", repo: "test", branch: "feature/skills" };

/** 生成 Git blob 摘要；参数为文本或字节，返回 SHA-1 对象 id。 */
function blob(data) {
        const bytes = Buffer.from(data);
        return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** 构造入口文档；参数为技能 id 和描述，返回含 frontmatter 的 Markdown。 */
function markdown(id, description = "A skill description") {
        return `---\nname: ${id}\ndescription: ${description}\n---\n# ${id}\n`;
}

/** 计算 ZIP 测试数据的 CRC；参数为 Buffer，返回无符号 CRC-32。 */
function crc32(data) {
        let crc = 0xffffffff;
        for (const byte of data) {
                crc ^= byte;
                for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        return (crc ^ 0xffffffff) >>> 0;
}

/** 生成单文件 Deflate ZIP；参数为技能 id，返回内存字节，不生成磁盘归档。 */
function archiveFixture(id) {
        const name = Buffer.from(`${id}/SKILL.md`);
        const content = Buffer.from(markdown(id));
        const compressed = deflateRawSync(content);
        const crc = crc32(content);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(content.length, 22);
        local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50);
        central.writeUInt16LE(0x314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(content.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50);
        end.writeUInt16LE(1, 8);
        end.writeUInt16LE(1, 10);
        end.writeUInt32LE(central.length + name.length, 12);
        end.writeUInt32LE(local.length + name.length + compressed.length, 16);
        return Buffer.concat([local, name, compressed, central, name, end]);
}

/** 创建隔离目录和可变 Gitea 替身；参数为测试上下文，返回商店与控制接口。 */
async function fixture(t) {
        const folder = await mkdtemp(join(directory, ".skill-store-"));
        const records = new Map();
        const requests = [];
        const state = { override: null };
        const revision = "1".repeat(40);
        /** 登记仓库目录；参数为 id、文件字典及可选额外树条目，无返回值。 */
        function add(id, files = { "SKILL.md": markdown(id) }, extra = []) {
                const treeSha = blob(JSON.stringify(files) + JSON.stringify(extra));
                records.set(id, { files, treeSha, extra });
        }
        add("example", { "SKILL.md": markdown("example"), "scripts/run.sh": "#!/bin/sh\nexit 0\n" });
        /** 返回 Gitea JSON；参数为 URL 与请求选项，返回 Response，验证固定 revision 和禁止重定向。 */
        async function fetchImpl(input, options) {
                const url = new URL(input);
                requests.push(url);
                assert.equal(options.redirect, "error");
                if (state.override) {
                        const result = await state.override(url, options);
                        if (result !== undefined) return result;
                }
                const prefix = "/api/v1/repos/test/test/";
                const path = decodeURIComponent(url.pathname.slice(prefix.length));
                let payload;
                switch (true) {
                        case path.startsWith("branches/"):
                                assert.equal(path, "branches/feature/skills");
                                payload = { commit: { id: revision } };
                                break;
                        case path === "contents/skills":
                                assert.equal(url.searchParams.get("ref"), revision);
                                payload = [...records].map(([id, record]) => ({ name: id, type: "dir", path: `skills/${id}`, sha: record.treeSha }));
                                payload.push({ name: "example.zip", type: "file" }, { name: "README.md", type: "file" });
                                break;
                        case path.startsWith("git/trees/"): {
                                assert.equal(url.searchParams.get("recursive"), "true");
                                const record = [...records.values()].find((item) => item.treeSha === path.slice(10));
                                assert.ok(record);
                                payload = { sha: record.treeSha, truncated: false, tree: [
                                        ...Object.entries(record.files).map(([name, content]) => ({
                                                path: name, type: "blob", sha: blob(content), mode: name.endsWith(".sh") ? "100755" : "100644",
                                        })), ...record.extra,
                                ] };
                                break;
                        }
                        case path.startsWith("contents/skills/"): {
                                assert.equal(url.searchParams.get("ref"), revision);
                                const [id, ...parts] = path.slice(16).split("/");
                                const data = records.get(id)?.files[parts.join("/")];
                                if (data === undefined) return new Response("", { status: 404 });
                                payload = { encoding: "base64", sha: blob(data), content: Buffer.from(data).toString("base64") };
                                break;
                        }
                        default: throw new Error(`Unexpected URL: ${url}`);
                }
                return Response.json(payload);
        }
        const store = new SkillStore(config, folder, fetchImpl);
        t.after(async () => { store.dispose(); await rm(folder, { recursive: true, force: true }); });
        return { folder, records, requests, state, store, add, revision };
}

test("商店目录只保留解包技能，所有子目录描述可直接读取", async () => {
        const entries = await readdir(join(root, "skills"), { withFileTypes: true });
        assert.equal(entries.some((entry) => entry.name.toLowerCase().endsWith(".zip")), false);
        for (const id of ["skill-creator", "vue-best-practices", "web-design-guidelines"]) {
                assert.ok(entries.some((entry) => entry.isDirectory() && entry.name === id));
        }
        for (const entry of entries.filter((item) => item.isDirectory())) {
                const text = await readFile(join(root, "skills", entry.name, "SKILL.md"), "utf8");
                const meta = readSkillMetadata(text, entry.name);
                assert.ok(meta.description.length > 30);
                assert.equal(meta.name, entry.name);
                assert.ok(text.slice(text.indexOf("---", 3) + 3).trim().length > 0);
        }
        assert.equal(existsSync(join(root, "skills/catalog.json")), false);
});

test("原有技能描述中文在前且完整保留英文，支持双语搜索", async () => {
        const descriptions = [
                ["skill-creator", "创建新技能", "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy."],
                ["vue-best-practices", "Vue.js 开发任务", "MUST be used for Vue.js tasks. Strongly recommends Composition API with `script setup` SFCs and TypeScript as the standard approach. Covers Vue 3, SSR, Volar, vue-tsc. Load for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API unless the project explicitly requires Options API."],
                ["web-design-guidelines", "审查 UI 代码", "Review UI code for Web Interface Guidelines compliance. Use when asked to review my UI, check accessibility, audit design, review UX, or check my site against best practices."],
        ];
        for (const [id, chinese, english] of descriptions) {
                const { description } = readSkillMetadata(await readFile(join(root, "skills", id, "SKILL.md"), "utf8"), id);
                assert.ok(description.startsWith(chinese));
                assert.ok(description.endsWith(english));
                assert.ok(description.toLowerCase().includes(chinese.toLowerCase()));
                assert.ok(description.toLowerCase().includes(english.slice(0, 20).toLowerCase()));
        }
});

test("描述解析支持 BOM、CRLF、引号、多行和可选版本，拒绝缺失及重复字段", () => {
        const result = readSkillMetadata("\ufeff---\r\nname: 'example'\r\ndescription: >-\r\n  first line\r\n  second line\r\nlicense: MIT\r\nmetadata:\r\n  version: \"1.2.3\"\r\n  category: coding\r\n---\r\n", "example");
        assert.equal(result.description, "first line second line");
        assert.equal(result.version, "1.2.3");
        assert.equal(result.category, "coding");
        assert.equal(readSkillMetadata(markdown("example", "'It''s useful'"), "example").description, "It's useful");
        assert.equal(readSkillMetadata(markdown("example", "|\n  first\n  second"), "example").description, "first\nsecond");
        for (const text of [markdown("other"), markdown("example", ""), markdown("example").replace("description:", "name: example\ndescription:")]) {
                assert.throws(() => readSkillMetadata(text, "example"), { code: "skill-store/metadata" });
        }
});

test("跨平台条目拒绝越界、设备名、Git 路径、尾点及反斜杠", () => {
        assert.equal(validSkillId("con"), false);
        assert.equal(validSkillId("valid-skill"), true);
        for (const path of ["example", "example/../bad", "/example/a", "example\\a", "example/CON.txt", "example/a.", "example/.git/config", "example/.GIT/config", "example/.dsh-skill-store.json"]) {
                assert.throws(() => entryPath(path, "example"), { code: "skill-store/unsafe-archive" });
        }
        assert.equal(entryPath("example/references/a.md", "example").path, "references/a.md");
});

test("ZIP 拒绝条目/解压大小超限、损坏 CRC 和符号链接元信息", async () => {
        const id = "example";
        const data = archiveFixture(id);
        const decoded = await decodeSkillArchive(data, id);
        assert.equal(decoded.files.length, 1);
        assert.equal(decoded.files[0].data.toString("utf8"), markdown(id));
        await assert.rejects(decodeSkillArchive(data, id, { maxEntries: 0 }));
        await assert.rejects(decodeSkillArchive(data, id, { maxFileBytes: 1 }), { code: "skill-store/archive-limit" });
        await assert.rejects(decodeSkillArchive(data, id, { maxTotalBytes: 1 }), { code: "skill-store/archive-limit" });
        const end = data.length - 22;
        const central = data.readUInt32LE(end + 16);
        const damaged = Buffer.from(data);
        damaged.writeUInt32LE((damaged.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
        await assert.rejects(decodeSkillArchive(damaged, id), { code: "skill-store/integrity" });
        const linked = Buffer.from(data);
        linked.writeUInt32LE((0o120777 << 16) >>> 0, central + 38);
        await assert.rejects(decodeSkillArchive(linked, id), { code: "skill-store/unsafe-archive" });
});

test("新增技能子目录刷新即可发现，无需 JSON；无效入口只产生提示", async (t) => {
        const { store, add, requests } = await fixture(t);
        assert.equal((await store.view()).entries.length, 1);
        const calls = requests.length;
        await store.view();
        assert.equal(requests.length, calls);
        add("new-skill", { "SKILL.md": markdown("new-skill", "Searchable new description") });
        add("missing", {});
        add("invalid", { "SKILL.md": markdown("wrong") });
        const view = await store.view(true);
        assert.deepEqual(view.entries.map((entry) => entry.id), ["example", "new-skill"]);
        assert.equal(view.entries[1].description, "Searchable new description");
        assert.equal(view.entries[1].version, view.entries[1].treeSha.slice(0, 8));
        assert.deepEqual(view.warnings.map((warning) => warning.id), ["missing", "invalid"]);
        assert.equal(requests.some((url) => url.pathname.includes("catalog.json")), false);
});

test("安装识别本地修改和上游更新，替换前完整备份目录和平铺文件", async (t) => {
        const { store, folder, add } = await fixture(t);
        await store.install({ id: "example" });
        let entry = (await store.view()).entries[0];
        assert.equal(entry.managed, true);
        assert.equal(entry.modified, false);
        assert.equal(entry.updateAvailable, false);
        if (process.platform !== "win32") assert.equal((await lstat(join(folder, "example/scripts/run.sh"))).mode & 0o777, 0o755);
        await writeFile(join(folder, "example/local.txt"), "local edit");
        assert.equal((await store.view()).entries[0].modified, true);
        await assert.rejects(store.install({ id: "example" }), { code: "skill-store/exists" });
        add("example", { "SKILL.md": markdown("example", "Updated description") });
        entry = (await store.view(true)).entries[0];
        assert.equal(entry.updateAvailable, true);
        await writeFile(join(folder, "example.md"), "flat local");
        const result = await store.install({ id: "example", replace: true, treeSha: entry.treeSha });
        assert.equal(await readFile(join(result.backup, "example/local.txt"), "utf8"), "local edit");
        assert.equal(await readFile(join(result.backup, "example.md"), "utf8"), "flat local");
        assert.equal((await store.view()).entries[0].modified, false);
        assert.equal((await readdir(folder)).some((name) => name.startsWith(".dsh-skill-install-")), false);
});

test("拒绝描述确认后变化的来源和被篡改的 blob，不产生安装目录", async (t) => {
        const { store, add, folder, state } = await fixture(t);
        const entry = (await store.view()).entries[0];
        add("example", { "SKILL.md": markdown("example", "Changed") });
        await assert.rejects(store.install({ id: "example", treeSha: entry.treeSha }), { code: "skill-store/changed" });
        state.override = async (url) => {
                if (url.pathname.endsWith("SKILL.md")) return Response.json({ sha: blob("original"), encoding: "base64", content: Buffer.from("tampered").toString("base64") });
        };
        await assert.rejects(store.view(true), { code: "skill-store/integrity" });
        assert.deepEqual(await readdir(folder), []);
});

test("拒绝符号链接、大小写冲突、文件目录重叠和截断文件树", async (t) => {
        const { store, add, folder, state } = await fixture(t);
        const unsafe = [
                [{ path: "link", type: "blob", sha: blob("target"), mode: "120000" }],
                [{ path: "skill.md", type: "blob", sha: blob("duplicate"), mode: "100644" }],
                [{ path: "SKILL.md/child", type: "blob", sha: blob("child"), mode: "100644" }],
                [{ path: "../outside", type: "blob", sha: blob("child"), mode: "100644" }],
        ];
        for (const extra of unsafe) {
                add("example", { "SKILL.md": markdown("example") }, extra);
                await assert.rejects(store.install({ id: "example" }));
                assert.deepEqual(await readdir(folder), []);
        }
        state.override = async (url) => {
                if (url.pathname.includes("/git/trees/")) return Response.json({ sha: url.pathname.split("/").at(-1), tree: [], truncated: true });
        };
        await assert.rejects(store.install({ id: "example" }), { code: "skill-store/invalid-catalog" });
});

test("下载有界，卸载取消请求且后续安装不写盘", async (t) => {
        const { store, state, folder } = await fixture(t);
        state.override = async () => new Response("x".repeat(1024 * 1024 + 1));
        await assert.rejects(store.view(), { code: "skill-store/download-limit" });
        let signal;
        let started;
        const ready = new Promise((done) => { started = done; });
        state.override = async (url, options) => new Promise((done, reject) => {
                signal = options.signal;
                signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
                started();
        });
        const pending = store.view();
        await ready;
        store.dispose();
        assert.equal(signal.aborted, true);
        await assert.rejects(pending, { code: "skill-store/network" });
        await assert.rejects(store.install({ id: "example" }), { code: "skill-store/canceled" });
        assert.deepEqual(await readdir(folder), []);
});

test("替换提交前取消会恢复旧技能，清理暂存及空备份", async (t) => {
        const { store, folder } = await fixture(t);
        await mkdir(join(folder, "example"));
        await writeFile(join(folder, "example/SKILL.md"), "original");
        const check = store.checkActive.bind(store);
        /** 注入备份后取消；无参数，无返回值，验证恢复流程而不修改文件系统函数。 */
        store.checkActive = () => {
                if (existsSync(join(folder, ".dsh-skill-backups")) && !existsSync(join(folder, "example"))) store.dispose();
                check();
        };
        await assert.rejects(store.install({ id: "example", replace: true }), { code: "skill-store/canceled" });
        assert.equal(await readFile(join(folder, "example/SKILL.md"), "utf8"), "original");
        assert.deepEqual(await readdir(join(folder, ".dsh-skill-backups")), []);
        assert.equal((await readdir(folder)).some((name) => name.startsWith(".dsh-skill-install-")), false);
});

test("本地修改扫描限制目录深度，不跟随链接或无限递归", async (t) => {
        const { store, folder } = await fixture(t);
        let path = folder;
        for (let i = 0; i < 66; i++) { path = join(path, "a"); await mkdir(path); }
        assert.equal(await store.modified(folder, []), true);
});

test("商店安装和本地管理共用队列，失败后不阻塞下一次操作", async (t) => {
        const { store } = await fixture(t);
        const manager = { store, mutation: Promise.resolve() };
        const order = [];
        let release;
        const waiting = new Promise((done) => { release = done; });
        /** 控制安装耗时；参数为技能 id，返回模拟安装结果。 */
        store.installOne = async (id) => { order.push(id); await waiting; return { id }; };
        const installation = store.install({ id: "example" });
        const mutation = SkillManagerService.prototype.mutate.call(manager, async () => { order.push("save"); throw new Error("save failed"); });
        const following = store.install({ id: "another" });
        release();
        await installation;
        await assert.rejects(mutation, /save failed/);
        await following;
        assert.deepEqual(order, ["example", "save", "another"]);
});

test("GitHub 主机使用 api.github.com 前缀并读取 commit.sha", async (t) => {
        const folder = await mkdtemp(join(directory, ".skill-store-github-"));
        const revision = "2".repeat(40);
        const seen = [];
        const markdownText = markdown("gh-example");
        const treeSha = blob("github-tree");
        const contentsSha = blob(markdownText);
        /** GitHub 风格替身；参数为 URL 与请求选项，返回 Response。 */
        async function fetchImpl(input, options) {
                const url = new URL(input);
                seen.push(url);
                assert.equal(options.redirect, "error");
                assert.equal(url.origin, "https://api.github.com");
                const path = decodeURIComponent(url.pathname.replace("/repos/test/test/", ""));
                switch (true) {
                        case path.startsWith("branches/"):
                                assert.equal(path, "branches/main");
                                return Response.json({ commit: { sha: revision } });
                        case path === "contents/skills":
                                assert.equal(url.searchParams.get("ref"), revision);
                                return Response.json([{ name: "gh-example", type: "dir", path: "skills/gh-example", sha: treeSha }]);
                        case path.startsWith("git/trees/"):
                                assert.equal(url.searchParams.get("recursive"), "true");
                                return Response.json({ sha: treeSha, truncated: false, tree: [{ path: "SKILL.md", type: "blob", sha: contentsSha, mode: "100644" }] });
                        case path.startsWith("contents/skills/"):
                                assert.equal(url.searchParams.get("ref"), revision);
                                return Response.json({ encoding: "base64", sha: contentsSha, content: Buffer.from(markdownText).toString("base64") });
                        default: throw new Error(`Unexpected URL: ${url}`);
                }
        }
        const store = new SkillStore({ gitHost: "https://github.com", owner: "test", repo: "test", branch: "main" }, folder, fetchImpl);
        t.after(async () => { store.dispose(); await rm(folder, { recursive: true, force: true }); });
        const catalog = await store.catalog(true);
        assert.equal(catalog.revision, revision);
        assert.deepEqual(catalog.skills.map((skill) => skill.id), ["gh-example"]);
        assert.deepEqual(catalog.warnings, []);
        assert.equal(store.apiUrl("branches", "main"), "https://api.github.com/repos/test/test/branches/main?ref=main");
        assert.ok(seen.length >= 3);
});
