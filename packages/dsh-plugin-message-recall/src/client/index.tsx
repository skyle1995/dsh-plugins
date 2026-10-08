/**
 * dsh-plugin-message-recall 浏览器半区：用户消息上的「撤回」按钮、助手
 * 消息动作行的备用入口，以及撤回确认弹窗。
 *
 * - conversation.chat.node（key: "user"，priority -1 遮蔽官方视图）在用户
 *   消息气泡上渲染「撤回」按钮（悬停显示，另附复制按钮）；遮蔽崩溃时
 *   框架自动回退到官方视图，撤回能力退化为助手动作行入口；
 * - conversation.chat.assistant-actions 在助手消息动作行保留同样的「撤回」
 *   按钮作为备用入口；
 * - 点击后经 shell.overlay 弹出 RiskConfirmation 确认弹窗，确认后调用宿主
 *   半区的 POST /api/dsh-message-recall/recall（{ sessionId, messageId }），
 *   宿主按「轮」撤回：删除该轮用户消息与助手回复、还原该轮文件变更；
 * - 活跃会话由 session 事件流实时更新界面；冷会话成功后刷新页面；失败用
 *   alert 提示。
 */
import { createElement as h, useEffect, useState } from "react";
import {
	IconCheckOutlineRegular, IconCopyOutlineRegular, IconRefreshOutlineRegular, RiskConfirmation,
} from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-message-recall";
const API = "/api/dsh-message-recall";

const zh = {
	"action.recall": "撤回",
	"action.title": "撤回这轮对话并还原该轮文件变更",
	"action.copy": "复制",
	recallConfirmTitle: "撤回消息",
	recallConfirm: "将删除这条消息及该轮对话（助手回复与工具调用），并还原该轮对工作区文件所做的修改。撤回后这些内容不再显示在会话记录中，也不再进入模型上下文。",
	recallAcknowledge: "我已知晓撤回会删除该轮对话并还原文件变更",
	recallCancel: "取消",
	recallConfirmAction: "撤回",
	recallFailed: "撤回失败：{message}",
};

const en = {
	"action.recall": "Recall",
	"action.title": "Recall this turn and revert its file changes",
	"action.copy": "Copy",
	recallConfirmTitle: "Recall message",
	recallConfirm: "This message and its turn (the assistant reply and tool calls) will be deleted, and the turn's workspace file changes will be reverted. The recalled content will no longer appear in the transcript or the model context.",
	recallAcknowledge: "I understand the turn will be deleted and file changes reverted",
	recallCancel: "Cancel",
	recallConfirmAction: "Recall",
	recallFailed: "Recall failed: {message}",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 模块级待确认撤回 store（单实例 bundle，供按钮与确认弹窗共享）。 */
let pendingRecall = null;
const listeners = new Set();
function requestRecall(sessionId, messageId) {
	pendingRecall = { sessionId, messageId };
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
.mru-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f0f2f5);color:var(--dsw-alias-label-secondary,#4b5563)}
`;

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
			h("button", { className: "mru-btn", type: "button", title: t("action.recall"), "aria-label": t("action.recall"), onClick: () => requestRecall(data.id) }, h(IconRefreshOutlineRegular, { size: 14 })),
			h("button", { className: "mru-btn", type: "button", title: t("action.copy"), "aria-label": t("action.copy"), onClick: copy }, copied ? h(IconCheckOutlineRegular, { size: 14 }) : h(IconCopyOutlineRegular, { size: 14 }))) : null);
}

/** 助手消息动作行的「撤回」图标按钮（备用入口，与官方动作同排）。 */
function RecallAction({ messageId, requestRecall: open, t }) {
	const style = {
		width: "calc(28px + var(--dsh-content-font-delta, 0px))",
		height: "calc(28px + var(--dsh-content-font-delta, 0px))",
		borderRadius: "var(--dsw-radius-sm)",
		color: "var(--dsw-alias-label-tertiary)",
		cursor: "pointer",
		background: "0 0",
		border: "none",
		justifyContent: "center",
		alignItems: "center",
		padding: 6,
		display: "inline-flex",
	};
	return h("button", {
		type: "button",
		title: t("action.title"),
		"aria-label": t("action.recall"),
		style,
		onClick: () => open(messageId),
		onMouseEnter: (event) => {
			event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)";
			event.currentTarget.style.color = "var(--dsw-alias-label-secondary)";
		},
		onMouseLeave: (event) => {
			event.currentTarget.style.background = "";
			event.currentTarget.style.color = "";
		},
	}, h(IconRefreshOutlineRegular, { size: 15 }));
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
			if (target !== null) confirmRecall(target.sessionId, target.messageId);
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
	const confirmRecall = (sessionId, messageId) => {
		void fetch(`${API}/recall`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ sessionId, messageId }),
		}).then(async (response) => {
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || payload.ok !== true) {
				globalThis.alert(format(t("recallFailed"), { message: payload.message ?? `HTTP ${response.status}` }));
				return;
			}
			// 活跃会话：surface 替换经 session 事件流实时更新界面；
			// 冷会话：刷新以加载最新日志。
			if (payload.value?.live !== true) globalThis.location.reload();
		}).catch((error) => {
			globalThis.alert(format(t("recallFailed"), { message: error.message }));
		});
	};

	// 用户消息气泡上的撤回按钮（遮蔽官方 user 节点视图；崩溃时框架回退官方视图）。
	ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
		name: "conversation.chat.node",
		key: "user",
		priority: -1,
		locale: NS,
		inject: (sessionId) => ({
			requestRecall: (messageId) => requestRecall(sessionId, messageId),
		}),
	}, (props) => h(RecallUserNodeView, props)));

	// 助手消息动作行的备用入口。
	ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
		name: "conversation.chat.assistant-actions",
		id: "recall",
		order: 30,
		locale: NS,
		inject: (sessionId) => ({
			requestRecall: (messageId) => requestRecall(sessionId, messageId),
		}),
	}, RecallAction));

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
