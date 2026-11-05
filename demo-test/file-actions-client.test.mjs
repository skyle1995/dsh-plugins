/**
 * 客户端路径与异步编辑回归，无浏览器或额外测试依赖。
 * 参数：无；运行 node --test demo-test/file-actions-client.test.mjs，失败返回非零状态。
 * 编译真实 TSX 后以最小 Hook 桩驱动编辑器，不生成磁盘构建缓存。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/dsh-plugin-file-actions");
const require = createRequire(join(packageDirectory, "package.json"));
const { build } = require("esbuild");
const source = await readFile(join(packageDirectory, "src/client/index.tsx"), "utf8");
const compiled = await build({
	stdin: { contents: `${source}\n/** 注入测试会话上下文；参数为宿主桩，无返回值。 */\nexport function setSessionContextForTest(ctx) { sessionContext = ctx; sidebarRight = ctx.sidebarRight; }\nexport { EditorTab, ContextMenu, openMenu, sessionReference, addToSession, dirnameOf, basenameOf, editAddress, parseEditAddress, normalizeHostPath, copyPaths, sameHostPath, invalidRenameName, performRename, stagePaths, pasteInto, readState, presetZipName, performCompress };`, loader: "tsx", resolveDir: packageDirectory },
        bundle: true, format: "cjs", platform: "browser", external: ["react*", "@deepseek-ai/*"], write: false,
});

/** 创建可重绘的最小 Hook 容器；无参数，返回编辑器驱动与待处理请求列表。 */
function harness() {
        const slots = [];
        const effects = [];
        const requests = [];
        const copied = [];
        const listeners = new Map();
        let index = 0;
        let tree;
        let commands;
        const module = { exports: {} };
        const react = {
                /** 创建虚拟元素；参数为类型、属性和子节点，返回节点描述。 */
                createElement(type, props, ...children) { return { type, props: { ...props, ...(children.length ? { children } : {}) } }; },
                Fragment: "fragment",
		/** 读取模块状态；参数为订阅与读取函数，返回当前快照。 */
		useSyncExternalStore(subscribe, read) { return read(); },
                /** 状态 Hook；参数为初值，返回当前状态和更新函数。 */
                useState(initial) {
                        const current = index++;
                        if (!(current in slots)) slots[current] = initial;
                        return [slots[current], (value) => { slots[current] = typeof value === "function" ? value(slots[current]) : value; }];
                },
                /** 引用 Hook；参数为初值，返回持久引用。 */
                useRef(initial) {
                        const current = index++;
                        if (!(current in slots)) slots[current] = { current: initial };
                        return slots[current];
                },
                /** 计算 Hook；参数为计算函数，返回计算结果。 */
                useMemo(fn) { index++; return fn(); },
                /** 效果 Hook；参数为函数和依赖，依赖变化后登记清理与新效果。 */
                useEffect(fn, deps) {
                        const current = index++;
                        const previous = slots[current];
                        if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
                                effects.push(() => {
                                        previous?.cleanup?.();
                                        slots[current] = { deps, cleanup: fn() };
                                });
                        }
                },
        };
        const primitive = new Proxy({
                languageForPath: () => "javascript",
                /** 捕获剪贴板文本；参数为字符串，返回模拟写入成功的 Promise。 */
                async writeClipboard(text) { copied.push(text); return true; },
        }, {
                /** 提供占位平台组件标识；参数为对象和键，返回已知函数或组件名。 */
                get(target, key) { return target[key] ?? String(key); },
        });
        runInNewContext(compiled.outputFiles[0].text, {
                module, exports: module.exports,
                /** 加载仅用于测试的依赖；参数为包名，返回 Hook 桩或平台组件桩。 */
                require(name) { return name === "react" ? react : primitive; },
                AbortController,
                document: {
                        /** 提供空文件树；参数为选择器，返回空节点列表，避免访问真实页面。 */
                        querySelectorAll() { return []; },
                },
                window: {
                        innerWidth: 1600, innerHeight: 1000,
                        addEventListener: (name, fn) => listeners.set(name, fn),
                        removeEventListener: (name) => listeners.delete(name),
                },
                /** 捕获异步请求；参数为 URL 和配置，返回由测试控制完成的 Promise。 */
                fetch(url, options) {
                        return new Promise((resolveRequest, reject) => requests.push({
                                url, options, body: JSON.parse(options.body), reject,
                                /** 完成请求；参数为响应数据，返回空值。 */
                                finish(payload) { resolveRequest({ ok: true, json: async () => ({ ok: true, ...payload }) }); },
                                /** 完成失败请求；参数为错误载荷，返回空值。 */
                                fail(payload) { resolveRequest({ ok: false, status: 400, json: async () => ({ ok: false, ...payload }) }); },
                        }));
                },
                setTimeout: () => 0, clearTimeout: () => {},
                console,
        });
        const tab = {
                contentId: module.exports.editAddress("/workspace", "/workspace/code.js"),
                actions: { bindCommands(value) { commands = value; } },
        };
        /** 重绘编辑器并执行效果；无参数，返回当前虚拟元素树。 */
        function render() {
                index = 0;
                tree = module.exports.EditorTab({ useTabInfo: () => ({ tab }), t: (key) => key });
                while (effects.length) effects.shift()();
                return tree;
        }
        /** 查找匹配节点；参数为断言函数和节点，返回首个匹配节点或 undefined。 */
        function find(predicate, node = tree) {
                if (!node) return undefined;
                if (Array.isArray(node)) {
                        for (const child of node) {
                                const result = find(predicate, child);
                                if (result) return result;
                        }
                        return undefined;
                }
                if (typeof node !== "object") return undefined;
                return predicate(node) ? node : find(predicate, node.props?.children ?? null);
        }
        /** 清理组件效果；无参数，无返回值。 */
        function cleanup() {
                for (const slot of slots) slot?.cleanup?.();
        }
        return { exports: module.exports, tab, requests, copied, render, find, cleanup, listeners, refresh: () => commands.refresh() };
}

/** 等待当前 Promise 链完成；无参数，返回下一事件循环轮次的 Promise。 */
async function flush() {
        await new Promise((resolve) => setImmediate(resolve));
}

test("会话引用兼容 Windows 混合路径、中文、空格及 POSIX 反斜杠", () => {
	const { sessionReference } = harness().exports;
	for (const [path, root, entry, expected] of [
		["D:\\work/docs/中文.md", "D:/work/", "file", "@docs/中文.md"],
		["\\\\server\\share/docs/a.txt", "\\\\server\\share", "file", "@docs/a.txt"],
		["/workspace/my file.txt", "/workspace", "file", '@"my file.txt"'],
		["/workspace/my folder", "/workspace", "directory", '@"my folder/"'],
		["/workspace/name\\part.txt", "/workspace", "file", "@name\\part.txt"],
		["/file.txt", "/", "file", "@file.txt"],
	]) {
		const reference = sessionReference(path, root, entry);
		assert.equal(reference.ref, expected);
		assert.equal(reference.clipboardText, expected);
		assert.equal(reference.source, "reference");
		assert.equal(reference.appearance, entry === "file" ? "file" : "folder");
	}
	for (const path of ["/outside/a", "/workspace-other/a", "/workspace", "/workspace/../a", '/workspace/bad"name', "/workspace/bad\nname"]) {
		assert.equal(sessionReference(path, "/workspace", "file"), null, path);
	}
});

test("右键添加会话追加引用且不发送，切换会话、忙碌及越界保持草稿", () => {
	const app = harness();
	let current = "session-a";
	let cwd = "/workspace";
	let editable = true;
	const inserted = [];
	let focused = 0;
	const scope = {};
	const input = {
		state: { getSnapshot: () => ({ draft: "已有草稿", draftRev: 7 }) },
		actions: { captureInsertion: () => ({ start: 1, end: 4, draftRev: 7 }) },
		/** 记录引用插入；参数为引用及版本跨度，返回是否可编辑。 */
		insertReference(reference, span) { if (!editable) return false; inserted.push({ reference, span }); return true; },
		/** 记录输入框聚焦；无参数，无返回值。 */
		focus() { focused++; },
	};
	app.exports.setSessionContextForTest({
		sidebarRight: { mounted: { getSnapshot: () => current } },
		sessions: { scope: () => scope, list: { getSnapshot: () => ({ byId: { [current]: { cwd } } }) } },
		conversation: { input: { for: (target) => { assert.equal(target, scope); return input; } } },
	});
	const menu = { scope: "row", x: 10, y: 10, sessionId: current, workspaceRoot: cwd, path: "/workspace/code.js", entry: "file" };
	app.exports.openMenu(menu);
	const tree = app.exports.ContextMenu();
	const action = app.find((node) => node.props?.children === "menu.addToSession", tree);
	assert.ok(action);
	action.props.onSelect();
	assert.equal(inserted.length, 1);
	assert.equal(inserted[0].reference.ref, "@code.js");
	assert.deepEqual({ ...inserted[0].span }, { start: 4, end: 4, draftRev: 7 });
	assert.equal(focused, 1);
	assert.equal(app.requests.length, 0);
	assert.equal(app.exports.readState().menu, null);
	current = "session-b";
	app.exports.addToSession(menu);
	current = "session-a";
	cwd = "/other";
	app.exports.addToSession(menu);
	cwd = "/workspace";
	editable = false;
	app.exports.addToSession(menu);
	editable = true;
	app.exports.addToSession({ ...menu, path: "/outside/file" });
	assert.equal(inserted.length, 1);
	assert.equal(focused, 1);
	assert.equal(app.exports.readState().toasts.at(-1).kind, "error");
});

test("浏览器路径覆盖 Windows 盘符/UNC、macOS 根及反斜杠文件名", () => {
        const { exports: paths } = harness();
        for (const [path, parent, name] of [
                ["C:\\Users\\foo\\bar.txt", "C:\\Users\\foo", "bar.txt"],
                ["C:\\foo", "C:\\", "foo"],
                ["C:\\", "C:\\", ""],
                ["D:/docs/file", "D:\\docs", "file"],
                ["D:\\project/sub/docs/开关台账.md", "D:\\project\\sub\\docs", "开关台账.md"],
                ["\\\\server\\share\\file.txt", "\\\\server\\share\\", "file.txt"],
                ["\\\\server\\share/docs/file.txt", "\\\\server\\share\\docs", "file.txt"],
                ["\\\\server\\share\\", "\\\\server\\share\\", ""],
                ["\\\\server\\share", "\\\\server\\share\\", ""],
                ["\\\\?\\UNC\\server\\share", "\\\\?\\UNC\\server\\share\\", ""],
                ["\\\\?\\UNC\\server\\share\\file.txt", "\\\\?\\UNC\\server\\share\\", "file.txt"],
                ["\\\\?\\UNC\\server\\share/docs/中文.md", "\\\\?\\UNC\\server\\share\\docs", "中文.md"],
                ["\\\\?\\D:\\file.txt", "\\\\?\\D:\\", "file.txt"],
                ["/", "/", ""],
                ["/Users/me/file.txt", "/Users/me", "file.txt"],
                ["/Users/me/name\\part.txt", "/Users/me", "name\\part.txt"],
                ["/Users/me/中文目录/", "/Users/me", "中文目录"],
                ["file.txt", ".", "file.txt"],
        ]) {
                assert.equal(paths.dirnameOf(path), parent, path);
                assert.equal(paths.basenameOf(path), name, path);
        }
});

test("复制单项和批量路径统一 Windows 分隔符，保留 POSIX 文件名", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        const mixed = "D:\\Synchro\\Project\\Cheat/win_memrw/docs/开关台账.md";
        const normalized = "D:\\Synchro\\Project\\Cheat\\win_memrw\\docs\\开关台账.md";
        assert.equal(app.exports.normalizeHostPath(mixed), normalized);
        app.exports.copyPaths([mixed]);
        await flush();
        assert.equal(app.copied[0], normalized);
        app.exports.copyPaths([
                mixed,
                "D:/",
                "\\\\server\\share/docs/中文.txt",
                "\\\\?\\D:\\docs/nested/file.txt",
                "/Users/me/docs/中文.md",
                "/Users/me/name\\part.txt",
        ]);
        await flush();
        assert.equal(app.copied[1], [
                normalized,
                "D:\\",
                "\\\\server\\share\\docs\\中文.txt",
                "\\\\?\\D:\\docs\\nested\\file.txt",
                "/Users/me/docs/中文.md",
                "/Users/me/name\\part.txt",
        ].join("\n"));
});

test("工作区及编辑标签路径身份忽略混合分隔符和末尾斜杠，保留 POSIX 大小写及反斜杠", () => {
        const { exports: paths } = harness();
        assert.equal(paths.sameHostPath("D:/work/", "D:\\work"), true);
        assert.equal(paths.sameHostPath("\\\\server\\share", "\\\\server\\share\\"), true);
        assert.equal(paths.sameHostPath("/work/Case", "/work/case"), false);
        assert.equal(paths.sameHostPath("/work/name\\part", "/work/name/part"), false);
        const address = paths.editAddress("D:/work/", "D:\\work/docs/中文.md");
        assert.equal(address, paths.editAddress("D:\\work", "D:/work/docs/中文.md"));
        const parsed = paths.parseEditAddress(address);
        assert.equal(parsed.workspaceRoot, "D:\\work");
        assert.equal(parsed.path, "D:\\work\\docs\\中文.md");
        const legacy = "dsh-resource://file-edit/" + encodeURIComponent("D:/work/") + "/" + encodeURIComponent("D:\\work/docs/中文.md");
        assert.equal(paths.parseEditAddress(legacy).path, parsed.path);
        assert.equal(paths.parseEditAddress("invalid://file-edit/work/file"), null);
        assert.equal(paths.parseEditAddress("dsh-resource://file-edit/%bad/file"), null);
});

test("重命名保留 POSIX 空格与反斜杠，Windows 分隔符仍禁止，压缩目标使用真实父目录", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        const request = { workspaceRoot: "/work", path: "/work/old.txt", name: "old.txt" };
        app.exports.performRename(request, " new\\part.txt ");
        assert.equal(app.requests[0].body.name, " new\\part.txt ");
        app.requests[0].finish({ name: " new\\part.txt " });
        await flush();
        app.exports.performRename({ ...request, workspaceRoot: "D:/work", path: "D:/work/old.txt" }, "new\\part.txt");
        assert.equal(app.requests.length, 1);
        for (const name of ["", " ", ".", "..", "sub/file", "bad\0file"]) {
                assert.equal(app.exports.invalidRenameName(name, "/work/old.txt"), true);
        }
        const mixed = "D:\\work/sub/docs/中文.md";
        assert.equal(app.exports.presetZipName([mixed]), "中文.md.zip");
        app.exports.performCompress({ workspaceRoot: "D:\\work", paths: [mixed], name: "中文.md.zip" }, "");
        assert.equal(app.requests[1].body.destination, "D:\\work\\sub\\docs");
        app.requests[1].finish({ name: "中文.md.zip" });
        await flush();
});

test("粘贴匹配规范工作区并拒绝跨工作区，旧完成结果不清除新剪贴板", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        app.exports.stagePaths(["D:\\work/old.txt"], "cut", "D:/work/");
        app.exports.pasteInto("D:\\other", "D:\\other");
        assert.equal(app.requests.length, 0);
        app.exports.pasteInto("D:\\work\\dest", "D:\\work");
        assert.equal(app.requests.length, 1);
        app.exports.stagePaths(["D:\\work/new.txt"], "copy", "D:\\work");
        app.requests[0].finish({});
        await flush();
        assert.equal(app.exports.readState().clipboard.paths[0], "D:\\work/new.txt");
        app.exports.stagePaths(["D:\\work/first.txt", "D:\\work/second.txt"], "cut", "D:/work");
        app.exports.pasteInto("D:\\work\\dest", "D:\\work");
        app.requests[1].fail({ message: "partial move", details: { completed: ["D:\\work\\first.txt"] } });
        await flush();
        assert.equal(app.exports.readState().clipboard.paths.length, 1);
        assert.equal(app.exports.readState().clipboard.paths[0], "D:\\work/second.txt");
});

test("格式化期间继续输入或切换文件，不覆盖当前内容", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        app.render();
        app.requests[0].finish({ content: "const a=1", version: "v1" });
        await flush();
        app.render();
        app.find((node) => node.props?.title === "edit.format").props.onClick();
        app.find((node) => node.type?.name === "HighlightEditor").props.onContent("new input");
        app.requests[1].finish({ content: "const a = 1;\n" });
        await flush();
        app.render();
        assert.equal(app.find((node) => node.type?.name === "HighlightEditor").props.content, "new input");
        app.find((node) => node.props?.title === "edit.format").props.onClick();
        app.tab.contentId = app.exports.editAddress("/workspace", "/workspace/other.js");
        app.render();
        app.requests[3].finish({ content: "other file", version: "v2" });
        await flush();
        app.requests[2].finish({ content: "outdated format" });
        await flush();
        app.render();
        assert.equal(app.find((node) => node.type?.name === "HighlightEditor").props.content, "other file");
});

test("旧读取响应被取消并忽略，卸载后移除关闭保护", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        app.render();
        app.refresh();
        assert.equal(app.requests[0].options.signal.aborted, true);
        app.requests[1].finish({ content: "latest", version: "v2" });
        await flush();
        app.requests[0].finish({ content: "old", version: "v1" });
        await flush();
        app.render();
        assert.equal(app.find((node) => node.type?.name === "HighlightEditor").props.content, "latest");
        assert.ok(app.listeners.has("beforeunload"));
        app.cleanup();
        assert.equal(app.listeners.has("beforeunload"), false);
});

test("保存携带读取版本且发送快照，保存期间的新输入仍标为未保存", async (t) => {
        const app = harness();
        t.after(app.cleanup);
        app.render();
        app.requests[0].finish({ content: "original", version: "v1" });
        await flush();
        app.render();
        app.find((node) => node.type?.name === "HighlightEditor").props.onContent("snapshot");
        app.render();
        app.find((node) => node.props?.title === "edit.save").props.onClick();
        app.find((node) => node.props?.title === "edit.save").props.onClick();
        assert.equal(app.requests.length, 2);
        assert.equal(app.requests[1].body.version, "v1");
        assert.equal(app.requests[1].body.content, "snapshot");
        app.find((node) => node.type?.name === "HighlightEditor").props.onContent("new input");
        app.requests[1].finish({ version: "v2" });
        await flush();
        app.render();
        assert.equal(app.find((node) => node.type?.name === "HighlightEditor").props.content, "new input");
        assert.ok(app.find((node) => node.props?.className === "dfa-editor-dirty"));
        app.find((node) => node.props?.title === "edit.save").props.onClick();
        assert.equal(app.requests[2].body.version, "v2");
        app.requests[2].finish({ version: "v3" });
        await flush();
});
