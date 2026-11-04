/**
 * dsh-plugin-sound-alert 离线冒烟测试（零依赖，node:vm 模拟浏览器环境）。
 *
 * 覆盖：
 * - bundle 外壳与导出面（apply / inject / previewSound / setCustomSound / resetCustomSound）；
 * - 设置分区注册（settings.section）与面板渲染；
 * - 会话状态跃迁 → 提示音（首次快照不发声；pending 出现发 attention；
 *   running true→false 发 done；子代理会话不发 done）；
 * - 偏好（关闭开关不发声、音量写入 audio.volume、localStorage 持久化）；
 * - 自定义音频（IndexedDB 替换 → 播放自定义源；恢复默认 → 回到内置源）；
 * - 自动播放被拦截 → 面板提示 + 手势解锁 → 恢复播放。
 *
 * 运行：node test/smoke.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

/** 直接由 assets/*.wav 构造期望的 data URI：断言播放的就是打包进去的那两段音频。 */
function dataUriOf(file) {
	return `data:audio/wav;base64,${readFileSync(new URL(`../assets/${file}`, import.meta.url)).toString("base64")}`;
}
const EXPECTED = { attention: dataUriOf("attention.wav"), done: dataUriOf("done.wav") };
const KIND = { ATTENTION: "attention", DONE: "done" };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 由播放的 data URI 反查场景（自定义音频走 blob: 前缀，另行断言）。 */
function kindOf(source) {
	if (source === EXPECTED.attention) return "attention";
	if (source === EXPECTED.done) return "done";
	return assert.fail(`播放了未知音频（长度 ${String(source).length}）`);
}

/** 极简内存版 IndexedDB，够本插件用到 open/transaction/objectStore/get/put/delete。 */
function makeFakeIndexedDB() {
	const stores = new Map();
	const db = {
		objectStoreNames: { contains: (name) => stores.has(name) },
		createObjectStore: (name) => {
			stores.set(name, new Map());
		},
		transaction: (name, _mode) => {
			if (!stores.has(name)) stores.set(name, new Map());
			const map = stores.get(name);
			const tx = { oncomplete: null, onerror: null, error: null };
			const request = (work) => {
				const req = {};
				setTimeout(() => {
					try {
						req.result = work();
						req.onsuccess?.();
						tx.oncomplete?.();
					} catch (error) {
						req.error = error;
						req.onerror?.();
					}
				}, 0);
				return req;
			};
			tx.objectStore = () => ({
				get: (key) => request(() => map.get(key)),
				put: (value, key) => request(() => map.set(key, value)),
				delete: (key) => request(() => map.delete(key)),
			});
			return tx;
		},
	};
	return {
		open: () => {
			const req = {};
			setTimeout(() => {
				req.result = db;
				req.onupgradeneeded?.();
				req.onsuccess?.();
			}, 0);
			return req;
		},
	};
}

/**
 * 在隔离的 VM 沙箱里加载一次插件 bundle。
 * @param {object} [options] - `{ prefs }` 预置 localStorage。
 * @returns 插件导出、播放记录、存储与假 ctx。
 */
function loadPlugin(options = {}) {
	const storage = new Map();
	if (options.prefs !== undefined) storage.set("dsh-plugin-sound-alert:prefs:v1", JSON.stringify(options.prefs));

	/** 播放记录：src + volume。 */
	const played = [];
	const domListeners = new Map();

	class FakeAudio {
		constructor(src) {
			this.src = src;
			this.volume = 1;
			this.preload = "auto";
		}

		play() {
			played.push({ src: this.src, volume: this.volume });
			return Promise.resolve();
		}
	}

	let loaded;
	const sandbox = {
		console,
		setTimeout,
		clearTimeout,
		Audio: FakeAudio,
		indexedDB: makeFakeIndexedDB(),
		URL: {
			createObjectURL: (blob) => `blob:${String(blob?.name ?? "custom")}`,
			revokeObjectURL: () => {},
		},
		localStorage: {
			getItem: (key) => (storage.has(key) ? storage.get(key) : null),
			setItem: (key, value) => storage.set(key, String(value)),
			removeItem: (key) => storage.delete(key),
		},
		addEventListener: (type, listener) => {
			if (!domListeners.has(type)) domListeners.set(type, new Set());
			domListeners.get(type).add(listener);
		},
		removeEventListener: (type, listener) => {
			domListeners.get(type)?.delete(listener);
		},
		window: {},
	};
	sandbox.window.window = sandbox.window;
	sandbox.window.__ModuleLoader__ = {
		load: ({ id, factory }) => {
			assert.equal(id, "dsh-plugin-sound-alert");
			loaded = factory(require);
		},
	};

	/** 平台模块表：只允许 react。 */
	const react = {
		Fragment: "Fragment",
		createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
		useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
                useRef: (initial) => ({ current: initial }),
                useEffect: () => {},
		useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
	};
	function require(id) {
		if (id === "react") return react;
		throw new Error(`未预期的外部模块：${id}`);
	}

	vm.createContext(sandbox);
	vm.runInContext(SOURCE, sandbox, { filename: "dsh-plugin-sound-alert/lib/client.js" });
	assert.ok(loaded !== undefined, "bundle 应通过 __ModuleLoader__ 注册");

	// ---- 假 cordis 上下文 -------------------------------------------------
	const statusListeners = new Set();
	const state = { status: new Map(), byId: {} };
	const registrations = [];
	const effects = [];
	const dictionaries = {};

	const store = {
		getSnapshot: () => state.status,
		subscribe: (listener) => {
			statusListeners.add(listener);
			return () => statusListeners.delete(listener);
		},
	};

	const ctx = {
		logger: { info() {}, warn() {}, error() {} },
		locale: {
			register: (ns, dicts) => {
				dictionaries[ns] = dicts;
				return () => {};
			},
			bind: (ns) => (key) => `${ns}:${key}`,
		},
		slots: {
			inject: (_name, factory) => factory(),
			register: (definition, component) => {
				registrations.push({ definition, component });
				return () => {};
			},
		},
		effect: (body) => {
			effects.push(body);
			const disposer = body();
			return typeof disposer === "function" ? disposer : () => {};
		},
		inject: (_deps, callback) => callback(ctx),
		uiSession: { sessionStatus: store },
		sessions: {
			list: {
				getSnapshot: () => ({ byId: state.byId }),
			},
		},
	};

	/** 推一次会话状态并通知监听者。 */
	const publish = (entries, byId = {}) => {
		state.status = new Map(entries.map(([id, value]) => [id, value]));
		state.byId = byId;
		for (const listener of [...statusListeners]) listener();
	};

	return { plugin: loaded, played, storage, ctx, publish, registrations, dictionaries, domListeners, effects, sandbox };
}

// ---- 1. 导出面 -----------------------------------------------------------
{
	const { plugin } = loadPlugin();
	assert.equal(typeof plugin.apply, "function", "应导出 apply");
	assert.deepEqual([...plugin.inject], ["slots", "locale"], "inject 声明按服务名");
	for (const name of ["previewSound", "setCustomSound", "resetCustomSound"]) {
		assert.equal(typeof plugin[name], "function", `应导出 ${name}`);
	}
	console.log("✔ 导出面：apply / inject / previewSound / setCustomSound / resetCustomSound");
}

// ---- 2. 设置分区注册与面板渲染 -------------------------------------------
{
	const env = loadPlugin();
	env.plugin.apply(env.ctx);

	assert.ok(env.dictionaries["dsh-plugin-sound-alert"]?.zh?.title, "应注册中文文案");
	const section = env.registrations.find((row) => row.definition.name === "settings.section");
	assert.ok(section, "应注册 settings.section（设置面板分区）");
	assert.equal(section.definition.id, "sound-alert");
	assert.equal(section.definition.order, 140);
	assert.equal(section.definition.locale, "dsh-plugin-sound-alert");
	assert.equal(typeof section.definition.label, "function");
	assert.equal(env.registrations.filter((row) => row.definition.name === "settings.section").length, 1, "只注册一个设置分区");

	const tree = JSON.stringify(section.component({ t: (key) => key }));
	for (const needle of ["dsa-page", "dsa-card", "dsa-btn"]) assert.ok(tree.includes(needle), `面板应包含 ${needle}`);
	for (const key of ["title", "enable", "volume", "scenes"]) {
		assert.ok(tree.includes(key), `面板应包含文案键 ${key}`);
	}

	// 两个场景行各自是一个 SceneRow 子组件（启用开关 + 试听 + 替换 / 恢复默认）。
	const collectTypes = (node, out = []) => {
		if (Array.isArray(node)) {
			for (const child of node) collectTypes(child, out);
			return out;
		}
		if (node && typeof node === "object") {
			if (typeof node.type === "function") out.push(node.type.name);
			for (const child of node.children ?? []) collectTypes(child, out);
		}
		return out;
	};
	const types = collectTypes(section.component({ t: (key) => key }));
	assert.equal(types.filter((name) => name === "SceneRow").length, 2, "应有两个场景行");
	console.log("✔ 设置分区：注册契约 + 面板渲染（启用/音量/两个场景行）");
}

// ---- 3. 状态跃迁 → 提示音 -----------------------------------------------
{
	const env = loadPlugin();
	env.plugin.apply(env.ctx);

	// 首次快照只做基线：任务已在跑，不应补发提示音。
	env.publish([["s1", { running: true, pendingInteraction: undefined }]]);
	assert.equal(env.played.length, 0, "首次快照不应发声");

	// 需要人工操作：pendingInteraction 出现。
	env.publish([["s1", { running: true, pendingInteraction: { kind: "question" } }]]);
	assert.equal(env.played.length, 1, "pending 出现应发一次提示音");
	assert.equal(env.played[0].src, EXPECTED.attention, "待操作应播放 attention.wav");

	// 用户已回答：pending 消失，不发声。
	env.publish([["s1", { running: true, pendingInteraction: undefined }]]);
	assert.equal(env.played.length, 1, "pending 清除不应发声");

	// 换成另一个交互（审批 → 提问）：应再次提醒（跨过 280ms 合并窗口）。
	await sleep(300);
	env.publish([["s1", { running: true, pendingInteraction: { kind: "approval" } }]]);
	assert.equal(env.played.length, 2, "新的交互应再次提醒");
	assert.equal(env.played[1].src, EXPECTED.attention, "同一场景应复用同一段音频");

	// 任务结束：running true → false。
	env.publish([["s1", { running: false, pendingInteraction: undefined }]]);
	assert.equal(env.played.length, 3, "任务结束应发一次提示音");
	assert.equal(env.played[2].src, EXPECTED.done, "结束应播放 done.wav");

	// 重复的 false → false 不再发声。
	env.publish([["s1", { running: false, pendingInteraction: undefined }]]);
	assert.equal(env.played.length, 3, "无跃迁不应重复发声");
	assert.equal(kindOf(env.played[0].src), "attention");
	console.log("✔ 状态跃迁：基线 / 待操作 / 新交互 / 结束 / 幂等");
}

// ---- 4. 子代理会话结束不打扰 ---------------------------------------------
{
	const env = loadPlugin();
	env.plugin.apply(env.ctx);
	env.publish([["sub", { running: true }]]);
	env.publish([["sub", { running: false }]], { sub: { retainedBy: { mainView: 0 } } });
	assert.equal(env.played.length, 0, "子代理会话结束不应打扰");
	env.publish([["main", { running: true }]]);
	env.publish([["main", { running: false }]], { main: { retainedBy: { mainView: 1 } } });
	assert.equal(env.played.length, 1, "主会话结束应发声");
	console.log("✔ 会话过滤：子代理静默 / 主会话发声");
}

// ---- 5. 偏好：开关、音量、持久化、试听 --------------------------------
{
	const env = loadPlugin({ prefs: { enabled: false, volume: 0.35, onPending: true, onDone: true } });
	env.plugin.apply(env.ctx);
	env.publish([["s1", { running: true }]]);
	env.publish([["s1", { running: true, pendingInteraction: { kind: "question" } }]]);
	env.publish([["s1", { running: false }]]);
	assert.equal(env.played.length, 0, "关闭总开关后不应发声");

	// 试听忽略开关，按已存音量播放。
	env.plugin.previewSound(KIND.ATTENTION);
	assert.equal(env.played.length, 1, "试听应无视开关直接播放");
	assert.ok(Math.abs(env.played[0].volume - 0.35) < 1e-9, "试听应使用已保存音量");
	assert.ok(env.storage.has("dsh-plugin-sound-alert:prefs:v1"), "偏好应落在 localStorage");
	console.log("✔ 偏好：总开关 / 音量 / localStorage / 试听强制播放");
}

// ---- 6. 场景开关单独生效 -------------------------------------------------
{
	const env = loadPlugin({ prefs: { enabled: true, volume: 0.7, onPending: false, onDone: true } });
	env.plugin.apply(env.ctx);
	env.publish([["s1", { running: true }]]);
	env.publish([["s1", { running: true, pendingInteraction: { kind: "question" } }]]);
	assert.equal(env.played.length, 0, "关闭「需要你操作」后该类不发声");
	env.publish([["s1", { running: false }]]);
	assert.equal(env.played.length, 1, "「任务结束」仍应发声");
	console.log("✔ 场景开关：按场景独立生效");
}

// ---- 7. 替换 / 恢复单个提示音 --------------------------------------------
{
	const env = loadPlugin({ prefs: { enabled: true, volume: 0.6, onPending: true, onDone: true } });
	env.plugin.apply(env.ctx);

	// 拒绝非音频与超大文件。
	const rejectedType = await env.plugin.setCustomSound(KIND.DONE, { name: "note.txt", type: "text/plain", size: 10 });
	assert.equal(rejectedType.ok, false);
	assert.equal(rejectedType.code, "unsupported");
	const rejectedSize = await env.plugin.setCustomSound(KIND.DONE, { name: "big.mp3", type: "audio/mpeg", size: 8 * 1024 * 1024 });
	assert.equal(rejectedSize.ok, false);
	assert.equal(rejectedSize.code, "too-large");

	// 接受自定义音频 → 播放走自定义源。
	const accepted = await env.plugin.setCustomSound(KIND.DONE, { name: "ding.mp3", type: "audio/mpeg", size: 2048 });
	assert.equal(accepted.ok, true);
	assert.equal(env.sandbox.__DSH_SOUND_ALERT__.custom().done, "ding.mp3", "诊断口应反映自定义音频文件名");
	env.plugin.previewSound(KIND.DONE);
	assert.equal(env.played.at(-1).src, "blob:ding.mp3", "自定义音频应替代内置源");

	// 另一个场景不受影响。
	env.plugin.previewSound(KIND.ATTENTION);
	assert.equal(env.played.at(-1).src, EXPECTED.attention, "未替换的场景仍用内置音频");

	// 恢复默认 → 回到内置源，并清除记录。
	await env.plugin.resetCustomSound(KIND.DONE);
	assert.equal(env.sandbox.__DSH_SOUND_ALERT__.custom().done, null);
	env.plugin.previewSound(KIND.DONE);
	assert.equal(env.played.at(-1).src, EXPECTED.done, "恢复默认后应播放内置音频");
	console.log("✔ 自定义音频：类型/大小校验 + 替换 + 恢复默认");
}

// ---- 8. 自动播放被拦截 → 挂手势解锁 + 面板提示 --------------------------
{
	const env = loadPlugin();
	env.plugin.apply(env.ctx);

	// 换成会被浏览器拦截的 Audio 实现。
	const blocked = [];
	env.sandbox.Audio = class {
		constructor(src) {
			this.src = src;
			this.volume = 1;
			this.preload = "auto";
		}

		play() {
			blocked.push(this.src);
			return Promise.reject(Object.assign(new Error("autoplay blocked"), { name: "NotAllowedError" }));
		}
	};

	env.publish([["s1", { running: true }]]);
	env.publish([["s1", { running: true, pendingInteraction: { kind: "question" } }]]);
	assert.equal(blocked.length, 1, "被拦截时也应发起过播放尝试");
	await sleep(20);
	assert.equal(env.domListeners.get("pointerdown")?.size ?? 0, 1, "被拦截后应挂一次性手势解锁监听");
	assert.equal(env.domListeners.get("keydown")?.size ?? 0, 1, "键盘手势同样可解锁");

	// 面板应展示拦截提示。
	const section = env.registrations.find((row) => row.definition.name === "settings.section");
	const tree = JSON.stringify(section.component({ t: (key) => key }));
	assert.ok(tree.includes("dsa-notice-warn"), "面板应出现自动播放被拦截的提示");
	assert.ok(tree.includes("blocked"), "提示文案应指向 blocked 文案键");

	// 用户手势后：监听移除、恢复播放能力。
	for (const listener of [...(env.domListeners.get("pointerdown") ?? [])]) listener();
	assert.equal(env.domListeners.get("pointerdown")?.size ?? 0, 0, "解锁后应移除手势监听");

	env.sandbox.Audio = class {
		constructor(src) {
			this.src = src;
			this.volume = 1;
			this.preload = "auto";
		}

		play() {
			env.played.push({ src: this.src, volume: this.volume });
			return Promise.resolve();
		}
	};
	await sleep(300);
	env.publish([["s1", { running: true, pendingInteraction: { kind: "approval" } }]]);
	assert.equal(env.played.length, 1, "解锁后新的交互应正常发声");
	console.log("✔ 自动播放拦截：提示 + 手势解锁 + 恢复播放");
}

console.log("\n全部冒烟用例通过 ✅");
