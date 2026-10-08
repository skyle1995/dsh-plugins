/**
 * dsh-plugin-session-archive 浏览器半区：会话右键菜单里的「删除会话」项。
 *
 * 通过 sidebar.workspaces.session.menu.item slot 在会话菜单底部（归档项
 * 之后，order 900）注册「删除会话」。删除走宿主半区的
 * /api/dsh-session-archive/delete 路由（官方 workspaceRegistry 记账
 * detach + 会话文件清理），成功后刷新页面以同步会话列表。
 */
import { createElement as h } from "react";
import { IconTrashOutlineRegular, MenuItemButton } from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-session-archive";
const API = "/api/dsh-session-archive";

const zh = {
	"menu.deleteSession": "删除会话",
	deleteConfirm: "确定永久删除该会话吗？其会话记录与磁盘文件将被移除，不可恢复。",
	deleteFailed: "删除失败：{message}",
};

const en = {
	"menu.deleteSession": "Delete session",
	deleteConfirm: "Permanently delete this session? Its records and on-disk files will be removed and cannot be recovered.",
	deleteFailed: "Delete failed: {message}",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 会话菜单项：删除会话（菜单底部）。 */
function DeleteSessionMenuItem({ sessionId, useMenuOpenState, t, deleteSession }) {
	const [, setMenuOpen] = useMenuOpenState();
	return h(MenuItemButton, {
		icon: h(IconTrashOutlineRegular, { size: 14 }),
		onSelect: () => {
			setMenuOpen(false);
			deleteSession(sessionId);
		},
		children: t("menu.deleteSession"),
	});
}

/** 注册词典与会话菜单的「删除会话」项（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-session-archive: dictionaries");
	const t = ctx.locale.bind(NS);
	const deleteSession = (sessionId) => {
		if (!globalThis.confirm(t("deleteConfirm"))) return;
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
	ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
		name: "sidebar.workspaces.session.menu.item",
		id: "delete-session",
		order: 900,
		locale: NS,
		inject: () => ({ deleteSession }),
	}, DeleteSessionMenuItem));
}
