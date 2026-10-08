/**
 * dsh-plugin-message-recall 浏览器半区：用户消息上的「撤回」按钮、助手
 * 消息动作行的备用入口，以及撤回确认弹窗。
 *
 * - conversation.chat.node（key: "user"，priority -1 遮蔽官方视图）在用户
 *   消息气泡上渲染「撤回」按钮（悬停显示 Tooltip，另附复制按钮）；遮蔽
 *   崩溃时框架自动回退到官方视图；
 * - 点击后经 shell.overlay 弹出 RiskConfirmation 确认弹窗，确认后调用宿主
 *   半区的 POST /api/dsh-message-recall/recall（{ sessionId, messageId, seq }），
 *   宿主按「轮」撤回编辑：还原该轮文件变更，并追加一条「已撤回第 N 轮的
 *   编辑…」提示消息（普通消息，界面即时可见；原对话消息保留）。
 */
import { createElement as h, useEffect, useState } from "react";
import {
	IconCheckOutlineRegular, IconCopyOutlineRegular, IconRefreshOutlineRegular, RiskConfirmation, Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-message-recall";
const API = "/api/dsh-message-recall";

const zh = {
	"action.recall": "撤回",
	"action.title": "撤回这轮对话并还原该轮文件变更",
	"action.copy": "复制",
	recallConfirmTitle: "撤回消息",
	recallConfirm: "将还原该轮对工作区文件所做的修改，并在会话中插入一条撤回提示。对话消息保留在会话记录中。",
	recallAcknowledge: "我已知晓撤回会还原该轮文件变更",
	recallCancel: "取消",
	recallConfirmAction: "撤回",
	recallFailed: "撤回失败：{message}",
	recalledNotice: "撤回成功：{message}",
	recalledShort: "撤回成功",
};

const en = {
	"action.recall": "Recall",
	"action.title": "Recall this turn and revert its file changes",
	"action.copy": "Copy",
	recallConfirmTitle: "Recall message",
	recallConfirm: "The turn's workspace file changes will be reverted, and a recall notice will be inserted into the conversation. The conversation messages remain in the transcript.",
	recallAcknowledge: "I understand the file changes will be reverted",
	recallCancel: "Cancel",
	recallConfirmAction: "Recall",
	recallFailed: "Recall failed: {message}",
	recalledNotice: "Recalled: {message}",
	recalledShort: "Recall succeeded",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** DOM 级 toast：直接挂到 document.body，样式全用 JS 内联（CSP 屏蔽 style 标签也能显示）。 */
function showDomToast(text) {
	if (typeof document === "undefined") return;
	let el = document.querySelector(".mrt-toast-host");
	if (el === null) {
		el = document.createElement("div");
		el.className = "mrt-toast-host";
		el.setAttribute("role", "status");
		Object.assign(el.style, {
			position: "fixed",
			left: "50%",
			bottom: "36px",
			transform: "translateX(-50%)",
			zIndex: "2147483000",
			background: "#ffffff",
			color: "#1f2329",
			border: "1px solid #d9dde3",
			borderRadius: "10px",
			boxShadow: "0 8px 24px rgba(0,0,0,.12)",
			padding: "10px 16px",
			fontSize: "13px",
			lineHeight: "1.6",
			maxWidth: "min(560px, calc(100vw - 48px))",
			overflowWrap: "anywhere",
			pointerEvents: "none",
		});
		document.body.appendChild(el);
	}
	el.textContent = text;
	clearTimeout(el.__mrtTimer);
	el.__mrtTimer = setTimeout(() => el.remove(), 4500);
}

/** 模块级待确认撤回 store（单实例 bundle，供按钮与确认弹窗共享）。 */
let pendingRecall = null;
const listeners = new Set();
function requestRecall(sessionId, messageId, seq) {
	pendingRecall = { sessionId, messageId, ...(seq === undefined ? {} : { seq }) };
	for (const listener of listeners) listener();
}
function settleRecall() {
	pendingRecall = null;
	for (const listener of listeners) listener();
}
function usePendingRecall() {
	const [state, setState] = useState(pendingRecall);
	useEffect(() => {
		const listener = () => setState(pendingRecall);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return state;
}

const css = `
.mru{display:flex;flex-direction:column;align-items:flex-end;gap:2px;position:relative;padding:2px 0}
.mru-bubble{max-width:82%;min-width:0;background:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-1,#f5f7fa));border:.5px solid var(--dsw-alias-border-l3,#e3e6ea);border-radius:14px;padding:9px 13px}
.mru-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65;color:var(--dsw-alias-label-primary,#1f2329)}
.mru-images{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.mru-images img{max-width:220px;max-height:160px;border-radius:8px;object-fit:cover}
.mru-refs{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a919c);overflow-wrap:anywhere}
.mru-actions{display:flex;gap:2px;align-items:center;opacity:0;transition:opacity .12s ease}
.mru:hover .mru-actions{opacity:1}
.mru-btn{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-tertiary,#8a919c);cursor:pointer;width:28px;height:28px;border-radius:var(--dsw-radius-sm,6px);justify-content:center;align-items:center;padding:5px;display:inline-flex}
.mru-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f0f2f5);color:var(--dsw-alias-label-secondary,#4b5563)}`;

/**
 * 用户消息节点视图（遮蔽官方 key:"user" 条目，priority -1）：重渲染气泡
 * 内容，悬停显示「撤回 / 复制」按钮。撤回把该轮的用户消息与助手回复一并
 * 删除并还原文件变更。
 */
function RecallUserNodeView(props) {
	const { node, t, requestRecall } = props;
	const [hover, setHover] = useState(false);
	const [copied, setCopied] = useState(false);
	const data = node?.data ?? {};
	const blocks = Array.isArray(data.content) ? data.content : [];
	const text = blocks.filter((block) => block?.type === "text").map((block) => block.text).join("\n");
	const images = blocks.filter((block) => block?.type === "image" && typeof block.image?.preview?.url === "string");
	const labels = Array.isArray(data.referenceLabels) ? data.referenceLabels : [];
	const copy = () => {
		void navigator.clipboard?.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		}).catch(() => {});
	};
	return h("div", {
		className: "mru",
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
	},
		h("div", { className: "mru-bubble" },
			text !== "" ? h("div", { className: "mru-text" }, text) : null,
			images.length > 0 ? h("div", { className: "mru-images" }, images.map((block, index) => h("img", { key: index, src: block.image.preview.url, alt: block.image.name ?? "" }))) : null,
			labels.length > 0 ? h("div", { className: "mru-refs" }, labels.join(" · ")) : null),
		hover || copied ? h("div", { className: "mru-actions" },
			h(Tooltip, { label: t("action.title"), side: "bottom", align: "end", delayMs: 400, children: h("button", { className: "mru-btn", type: "button", "aria-label": t("action.recall"), onClick: () => requestRecall(data.id ?? "", data.seq) }, h(IconRefreshOutlineRegular, { size: 14 })) }),
			h(Tooltip, { label: t("action.copy"), side: "bottom", align: "end", delayMs: 400, children: h("button", { className: "mru-btn", type: "button", "aria-label": t("action.copy"), onClick: copy }, copied ? h(IconCheckOutlineRegular, { size: 14 }) : h(IconCopyOutlineRegular, { size: 14 })) })) : null);
}

/** 撤回确认弹窗（RiskConfirmation，需勾选确认）。 */
function RecallConfirmDialog({ t, usePendingRecall: usePending, settleRecall: settle, confirmRecall }) {
	const request = usePending();
	const [acknowledged, setAcknowledged] = useState(false);
	useEffect(() => {
		if (request !== null) setAcknowledged(false);
	}, [request]);
	return h(RiskConfirmation, {
		open: request !== null,
		title: t("recallConfirmTitle"),
		description: t("recallConfirm"),
		acknowledgeLabel: t("recallAcknowledge"),
		cancelLabel: t("recallCancel"),
		confirmLabel: t("recallConfirmAction"),
		acknowledged,
		onAcknowledgedChange: setAcknowledged,
		onCancel: settle,
		onConfirm: () => {
			const target = request;
			settle();
			if (target !== null) confirmRecall(target.sessionId, target.messageId, target.seq);
		},
	});
}

/** 浏览器插件入口：注册词典、按钮与确认弹窗。 */
export function apply(ctx) {
	register(ctx);
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
];

/** 注册词典、撤回按钮与确认弹窗（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "message-recall: dictionaries");
	const t = ctx.locale.bind(NS);
	const confirmRecall = (sessionId, messageId, seq) => {
		void fetch(`${API}/recall`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ sessionId, messageId, ...(seq === undefined ? {} : { seq }) }),
		}).then(async (response) => {
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || payload.ok !== true) {
				console.error("[dsh-plugin-message-recall]", payload.message ?? `HTTP ${response.status}`, payload);
				showDomToast(format(t("recallFailed"), { message: payload.message ?? `HTTP ${response.status}` }));
				return;
			}
			// 成功：DOM toast 直接挂 body（不依赖 overlay 可见性），宿主追加的
			// 「已撤回第 N 轮的编辑…」消息同时出现在会话里。
			const notice = typeof payload.value?.notice === "string" && payload.value.notice !== "" ? payload.value.notice : t("recalledShort");
			showDomToast(format(t("recalledNotice"), { message: notice }));
		}).catch((error) => {
			globalThis.alert(format(t("recallFailed"), { message: error.message }));
		});
	};

	// 用户消息气泡上的撤回按钮（遮蔽官方 user 节点视图；崩溃时框架回退官方视图）。
	// sessionId 来自会话作用域绑定；取不到时传空串，宿主会按 messageId 自动定位会话。
	ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
		name: "conversation.chat.node",
		key: "user",
		priority: -1,
		locale: NS,
		inject: (scopeKey) => {
			const sessionId = typeof scopeKey === "string" ? scopeKey : "";
			return {
				requestRecall: (messageId, seq) => requestRecall(sessionId, messageId, seq),
			};
		},
	}, (props) => h(RecallUserNodeView, props)));

	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "message-recall-confirm",
		locale: NS,
		inject: () => ({ usePendingRecall, settleRecall, confirmRecall }),
	}, RecallConfirmDialog));

	ctx.effect(() => {
		if (typeof document === "undefined") return;
		const style = document.createElement("style");
		style.textContent = css;
		style.setAttribute("data-dsh-plugin", "dsh-plugin-message-recall");
		document.head.appendChild(style);
		return () => style.remove();
	}, "message-recall: styles");
}
