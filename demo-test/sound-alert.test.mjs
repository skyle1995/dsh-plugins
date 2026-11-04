/**
 * 提示音资源与异步快照回归。
 * 参数：无；node --test demo-test/sound-alert.test.mjs，无真实音频播放或磁盘数据库。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/dsh-plugin-sound-alert");
const require = createRequire(join(packageDirectory, "package.json"));
const { build } = require("esbuild");
const source = await readFile(join(packageDirectory, "src/client/index.tsx"), "utf8");
const compiled = await build({
        stdin: { contents: `${source}\nexport { getCustom, subscribeCustom };`, loader: "tsx", resolveDir: packageDirectory },
        bundle: true, format: "cjs", platform: "browser", external: ["react", "virtual:sound-alert-assets"], write: false,
});

/** 加载提示音测试容器；无参数，返回导出、内存数据库、连接统计和清理函数。 */
function harness() {
        const records = new Map();
        const databases = [];
        const revoked = [];
        const listeners = new Map();
        const disposers = [];
        const playback = { paused: 0 };
        let created = 0;
        let abortWrites = false;
        let rejectPlayback = false;
        const module = { exports: {} };
        const environment = {
                Blob,
                console,
                setTimeout: () => 0, clearTimeout: () => {},
                URL: {
                        createObjectURL: () => `blob:test-${++created}`,
                        revokeObjectURL: (url) => revoked.push(url),
                },
                Audio: class {
                        /** 构造测试音频；参数为来源，无实际系统资源。 */
                        constructor(source) { this.source = source; }
                        /** 模拟浏览器自动播放策略；无参数，返回播放 Promise。 */
                        play() { return rejectPlayback ? Promise.reject({ name: "NotAllowedError" }) : Promise.resolve(); }
                        /** 记录卸载停止播放；无参数，无返回值。 */
                        pause() { playback.paused += 1; }
                },
                addEventListener: (name, fn) => listeners.set(name, fn),
                removeEventListener: (name) => listeners.delete(name),
                indexedDB: {
                        /** 打开内存连接；无参数，返回异步请求。 */
                        open() {
                                const request = {};
                                const db = {
                                        closed: false,
                                        objectStoreNames: { contains: () => true },
                                        /** 关闭连接；无参数，无返回值。 */
                                        close() { this.closed = true; },
                                        /** 创建交易；参数为库名和模式，返回交易对象。 */
                                        transaction(name, mode) {
                                                const tx = {};
                                                /** 排队执行单条数据库操作；参数为操作函数，返回请求对象。 */
                                                const execute = (action) => {
                                                        const req = {};
                                                        queueMicrotask(() => {
                                                                if (mode === "readwrite" && abortWrites) {
                                                                        tx.error = new Error("transaction aborted");
                                                                        tx.onabort?.();
                                                                        return;
                                                                }
                                                                req.result = action();
                                                                req.onsuccess?.();
                                                                tx.oncomplete?.();
                                                        });
                                                        return req;
                                                };
                                                tx.objectStore = () => ({
                                                        get: (kind) => execute(() => records.get(kind)),
                                                        put: (record, kind) => execute(() => records.set(kind, record)),
                                                        delete: (kind) => execute(() => records.delete(kind)),
                                                });
                                                return tx;
                                        },
                                };
                                databases.push(db);
                                queueMicrotask(() => { request.result = db; request.onsuccess?.(); });
                                return request;
                        },
                },
                module, exports: module.exports,
                /** 测试依赖加载；参数为模块名，返回 React Hook 桩或音频标识。 */
                require(name) {
                        if (name === "virtual:sound-alert-assets") return { attentionSound: "builtin:attention", doneSound: "builtin:done" };
                        if (name === "react") return {
                                createElement: () => null, Fragment: "fragment",
                                useState: (initial) => [initial, () => {}], useRef: (value) => ({ current: value }),
                                useEffect: () => {}, useSyncExternalStore: (subscribe, snapshot) => snapshot(),
                        };
                        throw new Error(`unknown dependency: ${name}`);
                },
        };
        runInNewContext(compiled.outputFiles[0].text, environment);
        const ctx = {
                locale: { register: () => () => {}, bind: () => (key) => key },
                slots: { inject: () => {}, register: () => () => {} },
                effect: (fn) => { const dispose = fn(); if (typeof dispose === "function") disposers.push(dispose); },
                inject: (deps, fn) => fn(ctx),
                uiSession: { sessionStatus: { subscribe: () => () => {}, getSnapshot: () => new Map() } },
        };
        /** 清理插件作用域；无参数，无返回值。 */
        const cleanup = () => { while (disposers.length) disposers.pop()(); };
        return {
                plugin: module.exports, ctx, records, databases, revoked, listeners, cleanup, playback,
                abort: () => { abortWrites = true; },
                rejectPlayback: () => { rejectPlayback = true; },
        };
}

/** 等待异步数据库任务完成；无参数，返回事件循环下一轮的 Promise。 */
async function flush() {
        await new Promise((resolveFlush) => setImmediate(resolveFlush));
}

/** 创建小型音频 Blob；参数为名字，返回有音频类型的测试 Blob。 */
function audio(name) {
        const file = new Blob(["test"], { type: "audio/wav" });
        Object.defineProperty(file, "name", { value: name });
        return file;
}

test("自定义提示音每次更新返回新快照并关闭 IndexedDB 连接", async () => {
        const env = harness();
        const original = env.plugin.getCustom();
        let changes = 0;
        const unsubscribe = env.plugin.subscribeCustom(() => { changes += 1; });
        assert.equal((await env.plugin.setCustomSound("attention", audio("first.wav"))).ok, true);
        const first = env.plugin.getCustom();
        assert.notEqual(first, original);
        assert.equal(first.attention.name, "first.wav");
        await env.plugin.resetCustomSound("attention");
        const next = env.plugin.getCustom();
        assert.notEqual(next, first);
        assert.equal(next.attention, null);
        assert.equal(first.attention.name, "first.wav", "旧快照保持不可变");
        assert.equal(changes, 2);
        assert.ok(env.databases.every((db) => db.closed));
        assert.deepEqual(env.revoked, ["blob:test-1"]);
        unsubscribe();
});

test("交易中止返回失败并关闭连接，不留下永远待定的写请求", async () => {
        const env = harness();
        env.abort();
        const result = await env.plugin.setCustomSound("attention", audio("abort.wav"));
        assert.equal(result.ok, false);
        assert.equal(result.code, "store-failed");
        assert.equal(env.plugin.getCustom().attention, null);
        assert.ok(env.databases.every((db) => db.closed));
});

test("并发替换与恢复默认按调用顺序落盘，不让旧结果恢复自定义音频", async () => {
        const env = harness();
        await Promise.all([
                env.plugin.setCustomSound("done", audio("first.wav")),
                env.plugin.setCustomSound("done", audio("second.wav")),
                env.plugin.resetCustomSound("done"),
        ]);
        assert.equal(env.plugin.getCustom().done, null);
        assert.equal(env.records.has("done"), false);
        assert.ok(env.databases.every((db) => db.closed));
});

test("插件卸载释放 Blob URL 和自动播放手势监听，移除诊断引用", async (t) => {
        const env = harness();
        t.after(env.cleanup);
        env.plugin.apply(env.ctx);
        await flush();
        await env.plugin.setCustomSound("attention", audio("custom.wav"));
        env.plugin.previewSound("done");
        env.rejectPlayback();
        env.plugin.previewSound("attention");
        await flush();
        assert.ok(env.listeners.has("pointerdown"));
        assert.ok(env.listeners.has("keydown"));
        env.cleanup();
        assert.equal(env.listeners.size, 0);
        assert.equal(env.plugin.getCustom().attention, null);
        assert.equal(env.playback.paused, 1);
        assert.deepEqual(env.revoked, ["blob:test-1"]);
        assert.ok(env.databases.every((db) => db.closed));
});
