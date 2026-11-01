/**
 * dsh-plugin-sound-alert 浏览器半区：手动交互提示音。
 *
 * 监听 DSH 的会话状态源 `ctx.uiSession.sessionStatus`（Map<sessionId, {
 * running, pendingInteraction, completionUnread }>），在「需要人手动操作」的
 * 时刻发声：
 *
 * - pendingInteraction 出现（或换成另一个交互）→ attention（上行五度双音）：
 *   ask_user_question 选方向、审批请求、plan 复核，都属于这一类；
 * - running: true → false（任务结束 / 被停止）→ done（下行五度双音）。
 *
 * 配置入口：设置面板「提示音」分区（settings.section）。
 *
 * 每个场景可单独启用 / 关闭、可替换成本地音频文件（存 IndexedDB，按浏览器保存）、
 * 可恢复内置提示音、可随时试听。音频以内联 data URI 下发，不依赖宿主路由。
 */
import { createElement as h, Fragment, useState, useSyncExternalStore } from "react";
// 构建期虚拟模块：见 scripts/build-client.mjs（把 assets/*.wav 转成 data URI）。
import { attentionSound, doneSound } from "virtual:sound-alert-assets";

/** 本地化命名空间。 */
const NS = "dsh-plugin-sound-alert";
/** 偏好存储键（带版本号，结构变更时旧值自动回落默认）。 */
const STORAGE_KEY = `${NS}:prefs:v1`;
/** 同一场景的最小重复间隔（毫秒），避免多会话同时变化时连发。 */
const REPEAT_GUARD_MS = 280;
/** 自定义音频 IndexedDB 名称与对象仓库。 */
const DB_NAME = `${NS}:audio`;
const DB_STORE = "sounds";
/** 自定义音频大小上限（4MB）：本地提示音不需要更大。 */
const MAX_CUSTOM_BYTES = 4 * 1024 * 1024;

const zh = {
	title: "提示音",
	description: "在需要你手动操作的节点播放提示音：Agent 停下来问你（选择方向 / 确认 / 审批）以及任务结束或停止。",
	enable: "启用提示音",
	enableHint: "关闭后不播放任何提示音（面板里的试听不受影响）",
	volume: "音量",
	volumeHint: "建议 50%–80%，过高会盖过系统其它提示音",
	scenes: "触发场景",
	pending: "需要你操作",
	pendingHint: "Agent 提问、等待确认或审批时",
	done: "任务结束 / 已停止",
	doneHint: "当前任务跑完、被中止或出错退出时",
	preview: "试听",
	previewAll: "依次试听",
	replace: "替换",
	reset: "恢复默认",
	customBadge: "自定义",
	builtinBadge: "内置",
	pickerHint: "支持 wav / mp3 / m4a / ogg / flac，最大 4MB",
	tooLarge: "音频文件超过 4MB，请换一个更短的提示音。",
	unsupported: "无法识别的音频文件，请选择 wav / mp3 / m4a / ogg / flac。",
	storeFailed: "保存自定义音频失败：{message}",
	replaced: "已替换「{scene}」的提示音：{name}",
	resetDone: "已恢复「{scene}」的内置提示音",
	blocked: "浏览器拦截了自动播放：请先在页面上点击任意位置或按一次键，之后提示音即可正常播放。",
	ready: "提示音就绪",
	muted: "提示音已关闭",
	note: "提示音只在浏览器标签页处于打开状态时播放；偏好与自定义音频按浏览器保存。",
};

const en = {
	title: "Alert sounds",
	description: "Play a sound whenever manual attention is required: the agent asking you (choice / confirmation / approval), and the task finishing or stopping.",
	enable: "Enable alert sounds",
	enableHint: "When off, no sound plays (previews in this panel still work)",
	volume: "Volume",
	volumeHint: "50%–80% works best; louder can drown out system alerts",
	scenes: "Triggers",
	pending: "Needs your input",
	pendingHint: "Agent asked a question, awaits confirmation or approval",
	done: "Task finished / stopped",
	doneHint: "The current task completed, was aborted or failed",
	preview: "Preview",
	previewAll: "Play in order",
	replace: "Replace",
	reset: "Restore default",
	customBadge: "Custom",
	builtinBadge: "Built-in",
	pickerHint: "wav / mp3 / m4a / ogg / flac, up to 4MB",
	tooLarge: "The audio file exceeds 4MB; pick a shorter cue.",
	unsupported: "Unsupported audio file; choose wav / mp3 / m4a / ogg / flac.",
	storeFailed: "Could not save the custom audio: {message}",
	replaced: "Replaced the “{scene}” cue with {name}",
	resetDone: "Restored the built-in “{scene}” cue",
	blocked: "The browser blocked autoplay: click anywhere on the page or press any key once, then sounds will play.",
	ready: "Sounds ready",
	muted: "Sounds muted",
	note: "Sounds only play while the browser tab is open; preferences and custom audio are stored per browser.",
};

/** 文案插值：{name} 占位替换。 */
function format(text, params) {
	return String(text).replace(/\{(\w+)\}/g, (_, key) => String(params?.[key] ?? ""));
}

/** 提示音场景。 */
const KINDS = ["attention", "done"];
/** 场景 → 内置音频 data URI（构建期注入）。 */
const BUILTIN = { attention: attentionSound, done: doneSound };
/** 场景 → 文案键。 */
const SCENE_LABEL = { attention: "pending", done: "done" };

/** 默认偏好。 */
const DEFAULTS = { enabled: true, volume: 0.7, onPending: true, onDone: true };

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** 规范化偏好：容忍旧值、缺字段与非法类型。 */
function normalizePrefs(raw) {
	const value = raw !== null && typeof raw === "object" ? raw : {};
	return {
		enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULTS.enabled,
		volume: typeof value.volume === "number" ? clamp01(value.volume) : DEFAULTS.volume,
		onPending: typeof value.onPending === "boolean" ? value.onPending : DEFAULTS.onPending,
		onDone: typeof value.onDone === "boolean" ? value.onDone : DEFAULTS.onDone,
	};
}

/** 读取偏好（localStorage 不可用时回落默认值）。 */
function readPrefs() {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (typeof raw !== "string" || raw === "") return { ...DEFAULTS };
		return normalizePrefs(JSON.parse(raw));
	} catch {
		return { ...DEFAULTS };
	}
}

let prefs = readPrefs();
const prefsListeners = new Set();

/** 当前偏好快照（引用稳定，供 useSyncExternalStore 使用）。 */
function getPrefs() {
	return prefs;
}

/** 订阅偏好变化。 */
function subscribePrefs(listener) {
	prefsListeners.add(listener);
	return () => {
		prefsListeners.delete(listener);
	};
}

/** 合并写入偏好并通知订阅者。 */
function updatePrefs(patch) {
	prefs = normalizePrefs({ ...prefs, ...patch });
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// 隐私模式下写入失败：本会话内仍然生效。
	}
	for (const listener of [...prefsListeners]) listener();
}

// ---------------------------------------------------------------------------
// 自定义音频（IndexedDB 存 Blob，按浏览器保存）
// ---------------------------------------------------------------------------

/** 场景 → { url, name } | null，url 为 object URL。 */
const custom = { attention: null, done: null };
const customListeners = new Set();

/** 自定义音频快照（引用稳定）。 */
function getCustom() {
	return custom;
}

/** 订阅自定义音频变化。 */
function subscribeCustom(listener) {
	customListeners.add(listener);
	return () => {
		customListeners.delete(listener);
	};
}

function notifyCustom() {
	for (const listener of [...customListeners]) listener();
}

/** 打开 IndexedDB（不可用时拒绝，调用方静默降级）。 */
function openDb() {
	return new Promise((resolve, reject) => {
		const factory = globalThis.indexedDB;
		if (factory === undefined || factory === null) {
			reject(new Error("indexedDB unavailable"));
			return;
		}
		const request = factory.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
	});
}

/** 读取一条自定义音频记录。 */
async function idbGet(kind) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, "readonly");
		const request = tx.objectStore(DB_STORE).get(kind);
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.error ?? new Error("indexedDB read failed"));
	});
}

/** 写入一条自定义音频记录。 */
async function idbPut(kind, record) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, "readwrite");
		tx.objectStore(DB_STORE).put(record, kind);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
	});
}

/** 删除一条自定义音频记录。 */
async function idbDelete(kind) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, "readwrite");
		tx.objectStore(DB_STORE).delete(kind);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
	});
}

/** 把 Blob 挂到场景上（替换前释放旧的 object URL）。 */
function applyCustom(kind, blob, name) {
	const previous = custom[kind];
	if (previous !== null) {
		try {
			globalThis.URL?.revokeObjectURL(previous.url);
		} catch {
			// 忽略：URL 不可用时没有可释放的资源。
		}
	}
	let url;
	try {
		url = globalThis.URL.createObjectURL(blob);
	} catch {
		url = null;
	}
	custom[kind] = url === null ? null : { url, name: String(name ?? "custom") };
	notifyCustom();
}

/** 启动时把已保存的自定义音频读回内存。 */
async function restoreCustomSounds() {
	for (const kind of KINDS) {
		try {
			const record = await idbGet(kind);
			const isBlob = typeof Blob !== "undefined" && record?.blob instanceof Blob;
			if (isBlob) applyCustom(kind, record.blob, record.name);
		} catch {
			// IndexedDB 不可用：保持内置提示音。
		}
	}
}

/**
 * 把某个场景的提示音替换成本地音频文件。
 * @param {"attention"|"done"} kind - 场景。
 * @param {File} file - 用户选择的音频文件。
 * @returns {Promise<{ ok: boolean, code?: string, message?: string }>}
 */
export async function setCustomSound(kind, file) {
	if (!KINDS.includes(kind) || file === undefined || file === null) return { ok: false, code: "unsupported" };
	const type = String(file.type ?? "");
	const named = /\.(wav|mp3|m4a|ogg|oga|aac|flac|opus)$/i.test(String(file.name ?? ""));
	if (!type.startsWith("audio/") && !named) return { ok: false, code: "unsupported" };
	if (Number(file.size) > MAX_CUSTOM_BYTES) return { ok: false, code: "too-large" };
	try {
		await idbPut(kind, { blob: file, name: file.name, size: file.size, type });
	} catch (error) {
		return { ok: false, code: "store-failed", message: error?.message ?? String(error) };
	}
	applyCustom(kind, file, file.name);
	return { ok: true };
}

/**
 * 恢复某个场景的内置提示音并清除已保存的自定义音频。
 * @param {"attention"|"done"} kind - 场景。
 * @returns {Promise<void>}
 */
export async function resetCustomSound(kind) {
	if (!KINDS.includes(kind)) return;
	const previous = custom[kind];
	if (previous !== null) {
		try {
			globalThis.URL?.revokeObjectURL(previous.url);
		} catch {
			// 忽略。
		}
	}
	custom[kind] = null;
	notifyCustom();
	try {
		await idbDelete(kind);
	} catch {
		// 删除失败不影响本次会话恢复默认。
	}
}

// ---------------------------------------------------------------------------
// 播放
// ---------------------------------------------------------------------------

/**
 * 诊断入口：控制台里可用 window.__DSH_SOUND_ALERT__ 查看挂载状态、触发次数、
 * 自定义音频状态，并手动试听（排查「没声音」时先看 mounted 与 plays）。
 */
const diagnostics = {
	version: 2,
	mounted: false,
	plays: 0,
	lastKind: null,
	prefs: () => getPrefs(),
	custom: () => ({
		attention: custom.attention?.name ?? null,
		done: custom.done?.name ?? null,
	}),
	preview: (kind) => previewSound(kind),
};

/** 播放器状态：是否已被自动播放策略拦截。 */
let blocked = false;
const engineListeners = new Set();

function getEngineState() {
	return blocked ? "blocked" : "ready";
}

function subscribeEngine(listener) {
	engineListeners.add(listener);
	return () => {
		engineListeners.delete(listener);
	};
}

function setBlocked(next) {
	if (blocked === next) return;
	blocked = next;
	for (const listener of [...engineListeners]) listener();
}

/** 手势解锁只挂一次。 */
let gestureArmed = false;

/** 挂一次性用户手势监听：浏览器在首次手势后放行后续播放。 */
function armGestureUnlock() {
	if (gestureArmed || typeof globalThis.addEventListener !== "function") return;
	gestureArmed = true;
	const unlock = () => {
		gestureArmed = false;
		setBlocked(false);
		globalThis.removeEventListener("pointerdown", unlock, true);
		globalThis.removeEventListener("keydown", unlock, true);
	};
	globalThis.addEventListener("pointerdown", unlock, true);
	globalThis.addEventListener("keydown", unlock, true);
}

/** 上一次播放时间戳（按场景），用于合并连发。 */
const lastPlayed = new Map();

/** 场景当前的音频来源：自定义优先，否则内置。 */
function sourceFor(kind) {
	return custom[kind]?.url ?? BUILTIN[kind] ?? "";
}

/**
 * 播放提示音。
 * @param {"attention"|"done"} kind - 场景。
 * @param {object} [options] - `{ force: true }` 时忽略开关（面板试听用）。
 * @returns {boolean} 是否已发起播放。
 */
function playSound(kind, options = {}) {
	const source = sourceFor(kind);
	if (typeof source !== "string" || source === "") return false;
	if (options.force !== true) {
		if (!prefs.enabled) return false;
		if (kind === "attention" && !prefs.onPending) return false;
		if (kind === "done" && !prefs.onDone) return false;
		const now = Date.now();
		const previous = lastPlayed.get(kind) ?? 0;
		if (now - previous < REPEAT_GUARD_MS) return false;
		lastPlayed.set(kind, now);
	}
	const AudioCtor = globalThis.Audio ?? globalThis.HTMLAudioElement;
	if (typeof AudioCtor !== "function") return false;
	try {
		// 每次新建 audio 元素：允许同一提示音重叠触发，也避免复用导致的截断。
		diagnostics.plays += 1;
		diagnostics.lastKind = kind;
		const audio = new AudioCtor(source);
		audio.preload = "auto";
		audio.volume = clamp01(prefs.volume);
		const started = audio.play();
		if (started !== undefined && typeof started.catch === "function") {
			started.catch((error) => {
				if (error?.name === "NotAllowedError") {
					setBlocked(true);
					armGestureUnlock();
				}
				// 其它错误（解码等）静默：不影响主流程。
			});
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * 试听：忽略启用开关与场景开关，按当前音量播放一次。
 * @param {"attention"|"done"} kind - 场景。
 * @returns {boolean} 是否已发起播放。
 */
export function previewSound(kind) {
	return playSound(kind === "done" ? "done" : "attention", { force: true });
}

/** 会话是否为主视图持有的会话（子代理会话不打扰）。 */
function isMainSession(ctx, sessionId) {
	try {
		const row = ctx.sessions?.list?.getSnapshot?.()?.byId?.[sessionId];
		const count = row?.retainedBy?.mainView;
		// 拿不到保留信息时按「主会话」处理，宁可多提醒一次也不要漏提醒。
		return typeof count === "number" ? count > 0 : true;
	} catch {
		return true;
	}
}

/**
 * 订阅会话状态源，把状态跃迁翻译成提示音。
 * @param {object} ctx - 客户端 Cordis 上下文。
 * @returns {() => void} 取消订阅。
 */
function watchSessionStatus(ctx) {
	const store = ctx.uiSession?.sessionStatus;
	if (store === undefined || typeof store.subscribe !== "function") return () => {};

	/** 上一轮快照：sessionId → { running, pending }。 */
	let previous = new Map();
	let primed = false;

	const evaluate = () => {
		let snapshot;
		try {
			snapshot = store.getSnapshot();
		} catch {
			return;
		}
		if (snapshot === undefined || snapshot === null || typeof snapshot[Symbol.iterator] !== "function") return;

		const next = new Map();
		for (const [sessionId, value] of snapshot) {
			next.set(sessionId, {
				running: value?.running === true,
				pending: value?.pendingInteraction ?? null,
			});
		}

		if (!primed) {
			// 首次快照只记录基线：页面刚打开时不该补发一串提示音。
			previous = next;
			primed = true;
			return;
		}

		// 1）需要人工操作：新的 pending interaction 出现或换成了另一个交互。
		for (const [sessionId, value] of next) {
			if (value.pending === null) continue;
			const before = previous.get(sessionId);
			if (before?.pending === value.pending) continue;
			if (playSound("attention")) break;
		}

		// 2）任务结束 / 停止：running 由 true 变 false（仅主会话）。
		for (const [sessionId, value] of next) {
			const before = previous.get(sessionId);
			if (before?.running !== true || value.running !== false) continue;
			if (!isMainSession(ctx, sessionId)) continue;
			if (playSound("done")) break;
		}

		previous = next;
	};

	const dispose = store.subscribe(evaluate);
	diagnostics.mounted = true;
	evaluate();
	return () => {
		diagnostics.mounted = false;
		if (typeof dispose === "function") dispose();
	};
}

// ---------------------------------------------------------------------------
// 面板 UI（设置分区与「插件」页卡片共用）
// ---------------------------------------------------------------------------

/** 面板样式（沿用平台别名变量，跟随主题明暗）。 */
const css = `
.dsa-page{display:flex;flex-direction:column;gap:18px;min-width:0;padding:4px 0}
.dsa-head{display:flex;flex-direction:column;gap:6px}
.dsa-title{margin:0;font-size:16px;font-weight:600}
.dsa-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dsa-card{display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid var(--dsw-alias-border-l2,#e3e3e3);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsa-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;flex-wrap:wrap}
.dsa-row-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 220px}
.dsa-label{font-size:14px;color:var(--dsw-alias-label-primary,#222);display:flex;align-items:center;gap:8px}
.dsa-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#888);line-height:1.5}
.dsa-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0}
.dsa-switch input{width:16px;height:16px;cursor:pointer;accent-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsa-range{display:flex;align-items:center;gap:12px;min-width:220px}
.dsa-range input[type=range]{flex:1;min-width:140px;accent-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsa-range output{width:44px;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;color:var(--dsw-alias-label-secondary,#555)}
.dsa-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-shrink:0}
.dsa-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;cursor:pointer;flex-shrink:0}
.dsa-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dsa-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dsa-btn-primary:hover{filter:brightness(1.06);background:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsa-badge{font-size:11px;line-height:1;padding:3px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-secondary,#666);white-space:nowrap}
.dsa-badge-custom{border-color:rgba(59,110,245,.45);color:#3b6ef5;background:rgba(59,110,245,.08)}
.dsa-notice{margin:0;font-size:12px;line-height:1.6;border-radius:8px;padding:8px 10px}
.dsa-notice-warn{background:rgba(217,119,6,.12);color:#b45309}
.dsa-notice-err{background:rgba(220,38,38,.12);color:#b91c1c}
.dsa-divider{height:1px;background:var(--dsw-alias-border-l2,#e3e3e3);margin:0}
`;

/**
 * 面板内的操作提示（成功 / 失败），6 秒后自动消失。
 * @returns `[notice, setNotice]`。
 */
function useNotifyState() {
	const [notice, setState] = useState(null);
	const setNotice = (value) => {
		setState(value);
		globalThis.setTimeout(() => setState((current) => (current === value ? null : current)), 6000);
	};
	return [notice, setNotice];
}

/** 通过隐藏 input 选择本地音频文件。 */
function pickAudioFile(kind, t, onNotice) {
	let input = null;
	try {
		input = globalThis.document.createElement("input");
	} catch {
		return;
	}
	input.type = "file";
	input.accept = "audio/*,.wav,.mp3,.m4a,.ogg,.flac";
	input.style.display = "none";
	input.onchange = async () => {
		const file = input?.files?.[0];
		input?.remove();
		if (file === undefined || file === null) return;
		const result = await setCustomSound(kind, file);
		if (result.ok) {
			onNotice({ kind: "ok", text: format(t("replaced"), { scene: t(SCENE_LABEL[kind]), name: file.name }) });
			return;
		}
		const text = result.code === "too-large"
			? t("tooLarge")
			: result.code === "unsupported"
				? t("unsupported")
				: format(t("storeFailed"), { message: result.message ?? result.code ?? "error" });
		onNotice({ kind: "error", text });
	};
	globalThis.document.body.appendChild(input);
	input.click();
}

/** 单条场景行：启用开关 + 试听 + 替换 / 恢复默认。 */
function SceneRow({ t, kind, enabled, onToggle, onNotice }) {
	const customState = useSyncExternalStore(subscribeCustom, getCustom);
	const entry = customState[kind];
	return h(
		"div",
		{ className: "dsa-row" },
		h(
			"label",
			{ className: "dsa-row-main" },
			h(
				"span",
				{ className: "dsa-label" },
				h("input", {
					type: "checkbox",
					checked: enabled,
					onChange: (event) => onToggle(event.target.checked),
					style: { accentColor: "var(--dsw-alias-state-business-primary,#3b6ef5)" },
				}),
				t(SCENE_LABEL[kind]),
				h("span", { className: `dsa-badge${entry === null ? "" : " dsa-badge-custom"}` }, entry === null ? t("builtinBadge") : t("customBadge")),
			),
			h("span", { className: "dsa-hint" }, entry === null ? t(kind === "attention" ? "pendingHint" : "doneHint") : entry.name),
		),
		h(
			"div",
			{ className: "dsa-actions" },
			h("button", { type: "button", className: "dsa-btn", onClick: () => previewSound(kind) }, t("preview")),
			h(
				"button",
				{ type: "button", className: "dsa-btn", onClick: () => pickAudioFile(kind, t, onNotice), title: t("pickerHint") },
				t("replace"),
			),
			entry === null
				? null
				: h(
						"button",
						{
							type: "button",
							className: "dsa-btn",
							onClick: async () => {
								await resetCustomSound(kind);
								onNotice({ kind: "ok", text: format(t("resetDone"), { scene: t(SCENE_LABEL[kind]) }) });
							},
						},
						t("reset"),
					),
		),
	);
}

/**
 * 提示音面板：设置面板「提示音」分区的正文。
 * @param props - `t`（本命名空间的文案读取器）。
 */
function SoundAlertPanel(props) {
	const t = props?.t ?? ((key) => key);
	const current = useSyncExternalStore(subscribePrefs, getPrefs);
	const state = useSyncExternalStore(subscribeEngine, getEngineState);
	const [notice, setNotice] = useNotifyState();
	const percent = Math.round(current.volume * 100);

	return h(
		Fragment,
		null,
		h("style", null, css),
		h(
			"div",
			{ className: "dsa-page" },
			h(
				"div",
				{ className: "dsa-head" },
				h("h1", { className: "dsa-title" }, t("title")),
				h("p", { className: "dsa-subtitle" }, t("description")),
			),
			state === "blocked" ? h("p", { className: "dsa-notice dsa-notice-warn" }, t("blocked")) : null,
			notice === null
				? null
				: h("p", { className: `dsa-notice ${notice.kind === "error" ? "dsa-notice-err" : "dsa-notice-warn"}` }, notice.text),
			h(
				"div",
				{ className: "dsa-card" },
				h(
					"div",
					{ className: "dsa-row" },
					h(
						"div",
						{ className: "dsa-row-main" },
						h("span", { className: "dsa-label" }, t("enable")),
						h("span", { className: "dsa-hint" }, t("enableHint")),
					),
					h(
						"label",
						{ className: "dsa-switch" },
						h("input", {
							type: "checkbox",
							checked: current.enabled,
							onChange: (event) => updatePrefs({ enabled: event.target.checked }),
						}),
						h("span", { className: "dsa-hint" }, current.enabled ? t("ready") : t("muted")),
					),
				),
				h("div", { className: "dsa-divider" }),
				h(
					"div",
					{ className: "dsa-row" },
					h(
						"div",
						{ className: "dsa-row-main" },
						h("span", { className: "dsa-label" }, t("volume")),
						h("span", { className: "dsa-hint" }, t("volumeHint")),
					),
					h(
						"div",
						{ className: "dsa-range" },
						h("input", {
							type: "range",
							min: 0,
							max: 100,
							step: 5,
							value: percent,
							onChange: (event) => updatePrefs({ volume: Number(event.target.value) / 100 }),
						}),
						h("output", null, `${percent}%`),
					),
				),
			),
			h(
				"div",
				{ className: "dsa-card" },
				h("span", { className: "dsa-label", style: { fontWeight: 600 } }, t("scenes")),
				h(SceneRow, {
					t,
					kind: "attention",
					enabled: current.onPending,
					onToggle: (value) => updatePrefs({ onPending: value }),
					onNotice: setNotice,
				}),
				h("div", { className: "dsa-divider" }),
				h(SceneRow, {
					t,
					kind: "done",
					enabled: current.onDone,
					onToggle: (value) => updatePrefs({ onDone: value }),
					onNotice: setNotice,
				}),
				h(
					"div",
					{ className: "dsa-actions" },
					h(
						"button",
						{
							type: "button",
							className: "dsa-btn dsa-btn-primary",
							onClick: () => {
								previewSound("attention");
								globalThis.setTimeout(() => previewSound("done"), 1300);
							},
						},
						t("previewAll"),
					),
				),
			),
			h("p", { className: "dsa-hint" }, t("note")),
		),
	);
}

// ---------------------------------------------------------------------------
// 插件入口
// ---------------------------------------------------------------------------

/**
 * 浏览器插件入口：注册设置分区 + 「插件」页卡片 + 会话状态监听。
 * @param {object} ctx - 客户端 Cordis 上下文。
 */
export function apply(ctx) {
	globalThis.__DSH_SOUND_ALERT__ = diagnostics;
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "sound-alert: dictionaries");
	const t = ctx.locale.bind(NS);

	// 设置面板「提示音」分区（唯一的配置入口）。
	ctx.slots.inject(
		"settings.section",
		() =>
			ctx.slots.register(
				{
					name: "settings.section",
					id: "sound-alert",
					order: 140,
					label: () => t("title"),
					locale: NS,
				},
				SoundAlertPanel,
			),
	);

	// 会话状态监听：uiSession 由 @deepseek-ai/dsh-client-ui-session 提供，
	// 使用作用域注入以便它缺失时（非 Web 组合）安静跳过。
	ctx.inject(["uiSession"], (scoped) => {
		scoped.effect(() => watchSessionStatus(scoped), "sound-alert: session status");
	});

	// 已保存的自定义音频：启动时读回内存（失败即保持内置提示音）。
	restoreCustomSounds().catch(() => {});

	ctx.logger?.info?.("dsh-plugin-sound-alert：设置分区已注册");
}

/** 浏览器依赖注入面（服务名）。 */
export const inject = ["slots", "locale"];
