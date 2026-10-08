/**
 * dsh-plugin-message-recall 浏览器半区冒烟测试：模拟 window.__ModuleLoader__
 * 装载预构建的 lib/client.js，验证 apply(ctx) 的 slot 注册、动作注入与
 * 确认后对宿主路由的请求载荷。
 *
 * 运行：node packages/dsh-plugin-message-recall/test/client.smoke.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let failed = 0;
function check(label, condition) {
	if (condition) console.log(`ok  - ${label}`);
	else {
		failed += 1;
		console.error(`FAIL- ${label}`);
	}
}

const react = {
	createElement: (type, props, ...children) => ({ type, props, children }),
	useState: (init) => [init, () => {}],
	useEffect: () => {},
};
const jsxRuntime = { jsx: react.createElement, jsxs: react.createElement, Fragment: Symbol("fragment") };
const primitives = {
	IconRefreshOutlineRegular: "IconRefreshOutlineRegular",
	RiskConfirmation: "RiskConfirmation",
};

const registered = [];
globalThis.window = {
	__ModuleLoader__: {
		load: ({ id, factory }) => {
			registered.push({
				id,
				module: factory((name) => {
					if (name === "react") return react;
					if (name === "react/jsx-runtime") return jsxRuntime;
					if (name === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
					throw new Error("unexpected require: " + name);
				}),
			});
		},
	},
};

const here = dirname(fileURLToPath(import.meta.url));
await import(join(here, "..", "lib", "client.js"));

const entry = registered[0];
check("bundle 注册 id 为包名", entry.id === "dsh-plugin-message-recall");
check("导出 apply/inject", typeof entry.module.apply === "function" && JSON.stringify(entry.module.inject) === JSON.stringify(["slots", "locale"]));

// ---- 模拟平台 ctx：slots + locale ----
const slotRegistrations = [];
const dictionaries = [];
const ctx = {
	effect: (fn) => {
		fn();
		return () => {};
	},
	locale: {
		register: (ns, dict) => dictionaries.push({ ns, dict }),
		bind: () => (key) => key,
	},
	slots: {
		inject: (name, factory) => {
			const result = factory();
			slotRegistrations.push({ name, registration: result });
			return result;
		},
		register: (options, component) => ({ options, component }),
	},
};

let lastFetch = null;
globalThis.fetch = async (url, init) => {
	lastFetch = { url, init };
	return { ok: true, json: async () => ({ ok: true, value: { live: true } }) };
};
globalThis.alert = () => {};

entry.module.apply(ctx);

check("注册助手动作行 slot", slotRegistrations.some((s) => s.name === "conversation.chat.assistant-actions" && s.registration.options.id === "recall"));
check("注册用户节点遮蔽 slot", slotRegistrations.some((s) => s.name === "conversation.chat.node" && s.registration.options.key === "user" && s.registration.options.priority === -1));
check("注册 shell.overlay slot", slotRegistrations.some((s) => s.name === "shell.overlay" && s.registration.options.id === "message-recall-confirm"));
check("词典注册", dictionaries.some((d) => d.ns === "dsh-plugin-message-recall" && d.dict.zh["action.recall"] === "撤回"));

// ---- 动作注入 → 确认弹窗 → 请求宿主路由 ----
const actionSlot = slotRegistrations.find((s) => s.name === "conversation.chat.assistant-actions");
const overlaySlot = slotRegistrations.find((s) => s.name === "shell.overlay");
const injected = actionSlot.registration.options.inject("session-1");
check("动作注入提供 requestRecall", typeof injected.requestRecall === "function");
const overlay = overlaySlot.registration.options.inject();
check("overlay 注入提供确认入口", typeof overlay.confirmRecall === "function" && typeof overlay.usePendingRecall === "function");

injected.requestRecall("message-1");
check("点击后进入待确认状态", overlay.usePendingRecall()?.messageId === "message-1");
// 弹窗 onConfirm 的流程：先清空待确认状态，再发请求。
overlay.settleRecall();
await overlay.confirmRecall("session-1", "message-1");
check("确认后请求宿主路由", lastFetch?.url === "/api/dsh-message-recall/recall");
check("请求载荷为 sessionId+messageId", JSON.parse(lastFetch.init.body).sessionId === "session-1" && JSON.parse(lastFetch.init.body).messageId === "message-1");
check("确认后状态清空", overlay.usePendingRecall() === null);

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("CLIENT SMOKE OK");
