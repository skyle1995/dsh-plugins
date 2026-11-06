/**
 * 基础插件删除会话的客户端回归：模拟宿主服务和网络，不触碰真实会话。
 * 参数：无；返回：node:test 结果；运行 node --test demo-test/session-delete-client.test.mjs。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = join(root, "packages/dsh-plugin-repo");
const require = createRequire(join(packageDirectory, "package.json"));
const { build } = require("esbuild");
const source = await readFile(join(packageDirectory, "src/client/session-archive.tsx"), "utf8");
const compiled = await build({
        stdin: { contents: source, loader: "tsx", resolveDir: packageDirectory },
        bundle: true, format: "cjs", platform: "browser",
        external: ["react*", "@deepseek-ai/*"], write: false,
});

/** 创建模拟客户端；参数为网络与刷新回调，返回删除操作、记录和卸载方法。 */
function fixture({ fetchResponse = async () => ({ ok: true }), refresh = async () => {} } = {}) {
        const requests = [];
        const alerts = [];
        const starts = [];
        const cleanup = [];
        const registrations = new Map();
        const draft = { text: "另一个会话的未发送草稿" };
        let current = "other-session";
        let refreshes = 0;
        let reloads = 0;
        const module = { exports: {} };
        const context = vm.createContext({
                module, exports: module.exports, AbortController,
                /** 外部模块桩；参数为模块名，返回空组件依赖（测试只调用注册逻辑）。 */
                require: () => ({}),
                /** 网络桩；参数为地址和请求选项，返回模拟 HTTP 响应。 */
                fetch: async (url, options) => {
                        requests.push({ url, options });
                        const payload = await fetchResponse(options.signal);
                        return { ok: payload.ok, status: payload.ok ? 200 : 400, json: async () => payload };
                },
                alert: (message) => alerts.push(message),
                location: { reload: () => { reloads++; } },
        });
        vm.runInContext(compiled.outputFiles[0].text, context);
        const ctx = {
                /** 生命周期桩；参数为注册函数，记录其返回的清理函数，无返回值。 */
                effect: (operation) => { const dispose = operation(); if (typeof dispose === "function") cleanup.push(dispose); },
                locale: { register: () => () => {}, bind: () => (key) => ({
                        deleteFailed: "删除失败：{message}",
                        deleteSyncFailed: "会话已删除，但列表更新失败：{message}",
                })[key] ?? key },
                slots: {
                        inject: (name, operation) => operation(),
                        register: (options) => { registrations.set(options.id, options); return () => {}; },
                },
                workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: "workspace-a", sessionIds: ["deleted-session"] }] }) } },
                sessions: {
                        /** 局部刷新桩；无参数，返回完成 Promise，保留模拟草稿。 */
                        refresh: async () => { refreshes++; await refresh(); },
                },
                sidebarRight: { mounted: { getSnapshot: () => current } },
                uiWorkspace: { startSession: (id) => starts.push(id) },
        };
        module.exports.register(ctx);
        return {
                confirmDelete: registrations.get("session-delete-confirm").inject().confirmDelete,
                requests, alerts, starts, draft,
                setCurrent: (id) => { current = id; },
                stats: () => ({ refreshes, reloads }),
                dispose: () => { for (const operation of cleanup) operation(); },
        };
}

/** 创建可控等待；无参数，返回 Promise 和释放函数，等待仅由测试解除。 */
function deferred() {
        let resolve;
        const promise = new Promise((complete) => { resolve = complete; });
        return { promise, resolve };
}

test("删除非当前会话只同步列表，不刷新页面且保留其它草稿", async () => {
        const app = fixture();
        const before = app.draft;
        await app.confirmDelete("deleted-session");
        assert.deepEqual(app.stats(), { refreshes: 1, reloads: 0 });
        assert.equal(app.draft, before);
        assert.equal(app.draft.text, "另一个会话的未发送草稿");
        assert.equal(app.requests[0].url, "/api/dsh-session-archive/delete");
        assert.equal(app.requests[0].options.method, "POST");
        assert.deepEqual(JSON.parse(app.requests[0].options.body), { sessionId: "deleted-session" });
        assert.deepEqual(app.starts, []);
        assert.deepEqual(app.alerts, []);
        app.dispose();
});

test("删除当前会话在列表同步完成后打开同工作区新会话", async () => {
        const gate = deferred();
        const app = fixture({ refresh: () => gate.promise });
        app.setCurrent("deleted-session");
        const pending = app.confirmDelete("deleted-session");
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(app.starts, []);
        gate.resolve();
        await pending;
        assert.deepEqual(app.starts, ["workspace-a"]);
        assert.equal(app.stats().reloads, 0);
        app.dispose();
});

test("请求或列表同步等待期间切换会话，不覆盖新选择", async () => {
        for (const stage of ["request", "refresh"]) {
                const gate = deferred();
                const app = fixture(stage === "request"
                        ? { fetchResponse: async () => { await gate.promise; return { ok: true }; } }
                        : { refresh: () => gate.promise });
                app.setCurrent("deleted-session");
                const pending = app.confirmDelete("deleted-session");
                await new Promise((resolve) => setImmediate(resolve));
                app.setCurrent("new-selection");
                gate.resolve();
                await pending;
                assert.deepEqual(app.starts, []);
                assert.deepEqual(app.stats(), { refreshes: 1, reloads: 0 });
                app.dispose();
        }
});

test("服务端拒绝和网络失败不触发同步，失败后可以重试", async () => {
        for (const fetchResponse of [
                async () => ({ ok: false, message: "会话正在运行" }),
                async () => { throw new Error("网络断开"); },
        ]) {
                const app = fixture({ fetchResponse });
                await app.confirmDelete("deleted-session");
                await app.confirmDelete("deleted-session");
                assert.equal(app.requests.length, 2);
                assert.deepEqual(app.stats(), { refreshes: 0, reloads: 0 });
                assert.equal(app.alerts.length, 2);
                assert.ok(app.alerts.every((message) => message.startsWith("删除失败：")));
                assert.deepEqual(app.starts, []);
                app.dispose();
        }
});

test("删除已成功但同步失败，提示更新失败且不重发删除或刷新页面", async () => {
        const app = fixture({ refresh: async () => { throw new Error("列表连接断开"); } });
        app.setCurrent("deleted-session");
        await app.confirmDelete("deleted-session");
        assert.equal(app.requests.length, 1);
        assert.deepEqual(app.alerts, ["会话已删除，但列表更新失败：列表连接断开"]);
        assert.deepEqual(app.starts, []);
        assert.deepEqual(app.stats(), { refreshes: 1, reloads: 0 });
        app.dispose();
});

test("相同会话重复确认只提交一次，不同会话可独立提交", async () => {
        const gate = deferred();
        const app = fixture({ fetchResponse: async () => { await gate.promise; return { ok: true }; } });
        const first = app.confirmDelete("deleted-session");
        const duplicate = app.confirmDelete("deleted-session");
        const other = app.confirmDelete("another-session");
        assert.equal(app.requests.length, 2);
        gate.resolve();
        await Promise.all([first, duplicate, other]);
        assert.deepEqual(app.stats(), { refreshes: 2, reloads: 0 });
        app.dispose();
});

test("卸载取消网络请求，不再同步列表、导航或提示错误", async () => {
        const app = fixture({
                fetchResponse: (signal) => new Promise((resolve, reject) => {
                        signal.addEventListener("abort", () => reject(new Error("取消")), { once: true });
                }),
        });
        const pending = app.confirmDelete("deleted-session");
        app.dispose();
        await pending;
        await app.confirmDelete("another-session");
        assert.equal(app.requests.length, 1);
        assert.equal(app.requests[0].options.signal.aborted, true);
        assert.deepEqual(app.stats(), { refreshes: 0, reloads: 0 });
        assert.deepEqual(app.alerts, []);
        assert.deepEqual(app.starts, []);
});

test("同步期间卸载，不导航且忽略后续同步异常", async () => {
        const gate = deferred();
        const app = fixture({ refresh: async () => { await gate.promise; throw new Error("同步中断"); } });
        app.setCurrent("deleted-session");
        const pending = app.confirmDelete("deleted-session");
        await new Promise((resolve) => setImmediate(resolve));
        app.dispose();
        gate.resolve();
        await pending;
        assert.deepEqual(app.starts, []);
        assert.deepEqual(app.alerts, []);
        assert.equal(app.stats().reloads, 0);
});
