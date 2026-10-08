/**
 * dsh-plugin-message-recall 浏览器半区：助手消息动作行的「撤回」按钮与
 * 撤回确认弹窗。
 *
 * - conversation.chat.assistant-actions slot 在每条已定稿助手消息的动作行
 *   （复制 / 分支等图标按钮之间）注册「撤回」按钮（order 30）；
 * - 点击后经 shell.overlay 弹出 RiskConfirmation 确认弹窗，确认后调用宿主
 *   半区的 POST /api/dsh-message-recall/recall（{ sessionId, messageId }）；
 * - 活跃会话由 session 事件流实时更新界面；冷会话成功后刷新页面以加载
 *   最新日志；失败用 alert 提示。
 */
import { createElement as h, useEffect, useState } from "react";
import { IconRefreshOutlineRegular, RiskConfirmation } from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-message-recall";
const API = "/api/dsh-message-recall";

const zh = {
	"action.recall": "撤回",
	"action.title": "撤回此消息并还原该轮文件变更",
	recallConfirmTitle: "撤回消息",
	recallConfirm: "将撤回这条助手回复及其工具调用，并还原该轮对工作区文件所做的修改。撤回后该消息不再显示在会话记录中，也不再进入模型上下文。",
	recallAcknowledge: "我已知晓撤回会还原文件变更",
	recallCancel: "取消",
	recallConfirmAction: "撤回",
	recallFailed: "撤回失败：{message}",
};

const en = {
	"action.recall": "Recall",
	"action.title": "Recall this message and revert its file changes",
	recallConfirmTitle: "Recall message",
	recallConfirm: "This assistant reply and its tool calls will be retracted, and the turn's workspace file changes will be reverted. The message will no longer appear in the transcript or the model context.",
	recallAcknowledge: "I understand the file changes will be reverted",
	recallCancel: "Cancel",
	recallConfirmAction: "Recall",
	recallFailed: "Recall failed: {message}",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 模块级待确认撤回 store（单实例 bundle，供动作按钮与确认弹窗共享）。 */
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

/** 助手消息动作行的「撤回」图标按钮。 */
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

/** 浏览器插件入口：注册词典、动作行「撤回」按钮与确认弹窗。 */
export function apply(ctx) {
	register(ctx);
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
];

/** 注册词典、动作行「撤回」按钮与确认弹窗（由主包 apply 调用）。 */
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
}
