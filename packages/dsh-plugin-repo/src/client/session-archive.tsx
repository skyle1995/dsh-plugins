/**
 * dsh-plugin-session-archive 浏览器半区：会话右键菜单里的「删除会话」项
 * 与删除确认弹窗。
 *
 * - sidebar.workspaces.session.menu.item slot 在会话菜单底部（归档项之后，
 *   order 900）注册红色警示的「删除会话」项（MenuItemButton danger）；
 * - 点击后经 shell.overlay 弹出 RiskConfirmation 确认弹窗（需勾选
 *   「已知晓不可恢复」才可确认），确认后走宿主半区的
 *   /api/dsh-session-archive/delete 路由（官方 workspaceRegistry 记账
 *   detach + 会话文件清理），成功后刷新页面同步会话列表。
 */
import { createElement as h, useEffect, useState } from "react";
import { IconTrashOutlineRegular, MenuItemButton, RiskConfirmation } from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-session-archive";
const API = "/api/dsh-session-archive";

const zh = {
	"menu.deleteSession": "删除会话",
	deleteConfirmTitle: "删除会话",
	deleteConfirm: "该会话的会话记录与磁盘文件将被永久移除，此操作不可恢复。",
	deleteAcknowledge: "我已知晓删除不可恢复",
	deleteCancel: "取消",
	deleteConfirmAction: "删除",
	deleteFailed: "删除失败：{message}",
};

const en = {
	"menu.deleteSession": "Delete session",
	deleteConfirmTitle: "Delete session",
	deleteConfirm: "This session's records and on-disk files will be permanently removed. This cannot be undone.",
	deleteAcknowledge: "I understand this cannot be undone",
	deleteCancel: "Cancel",
	deleteConfirmAction: "Delete",
	deleteFailed: "Delete failed: {message}",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 模块级删除请求 store（单实例 bundle，供菜单项与确认弹窗共享）。 */
let pendingDelete = null;
const listeners = new Set();
function requestDelete(sessionId) {
	pendingDelete = { sessionId };
	for (const listener of listeners) listener();
}
function settleDelete() {
	pendingDelete = null;
	for (const listener of listeners) listener();
}
function usePendingDelete() {
	const [state, setState] = useState(pendingDelete);
	useEffect(() => {
		const listener = () => setState(pendingDelete);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return state;
}

/** 会话菜单项：删除会话（红色警示，菜单底部）。 */
function DeleteSessionMenuItem({ sessionId, useMenuOpenState, t, requestDelete }) {
	const [, setMenuOpen] = useMenuOpenState();
	return h(MenuItemButton, {
		danger: true,
		icon: h(IconTrashOutlineRegular, { size: 14 }),
		onSelect: () => {
			setMenuOpen(false);
			requestDelete(sessionId);
		},
		children: t("menu.deleteSession"),
	});
}

/** 删除确认弹窗（RiskConfirmation，需勾选确认）。 */
function DeleteConfirmDialog({ t, usePendingDelete, settleDelete, confirmDelete }) {
	const request = usePendingDelete();
	const [acknowledged, setAcknowledged] = useState(false);
	// 每次打开重置勾选。
	useEffect(() => {
		if (request !== null) setAcknowledged(false);
	}, [request]);
	return h(RiskConfirmation, {
		open: request !== null,
		title: t("deleteConfirmTitle"),
		description: t("deleteConfirm"),
		acknowledgeLabel: t("deleteAcknowledge"),
		cancelLabel: t("deleteCancel"),
		confirmLabel: t("deleteConfirmAction"),
		acknowledged,
		onAcknowledgedChange: setAcknowledged,
		onCancel: settleDelete,
		onConfirm: () => {
			const sessionId = request?.sessionId;
			settleDelete();
			if (sessionId !== undefined) confirmDelete(sessionId);
		},
	});
}

/** 注册词典、会话菜单的「删除会话」项与确认弹窗（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-session-archive: dictionaries");
	const t = ctx.locale.bind(NS);
	const confirmDelete = (sessionId) => {
		void fetch(`${API}/delete`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ sessionId }),
		}).then(async (response) => {
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || payload.ok !== true) {
				globalThis.alert(format(t("deleteFailed"), { message: payload.message ?? `HTTP ${response.status}` }));
				return;
			}
			globalThis.location.reload();
		}).catch((error) => {
			globalThis.alert(format(t("deleteFailed"), { message: error.message }));
		});
	};
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "session-delete-confirm",
		locale: NS,
		inject: () => ({ usePendingDelete, settleDelete, confirmDelete }),
	}, DeleteConfirmDialog));
	ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
		name: "sidebar.workspaces.session.menu.item",
		id: "delete-session",
		order: 900,
		locale: NS,
		inject: () => ({ requestDelete }),
	}, DeleteSessionMenuItem));
}
