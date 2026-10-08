/**
 * dsh-plugin-session-archive 浏览器半区：设置面板里的「会话归档」分区。
 *
 * 通过 settings.section 注册为设置面板左侧导航的独立分区：列出全部会话
 * （活跃 / 已归档两组，支持搜索），提供 归档 / 还原 / 删除 操作。数据与
 * 操作全部走宿主半区注册的 /api/dsh-session-archive 路由（宿主基于官方
 * ctx.workspaceRegistry 归档集实现；归档活跃会话会被官方活动检查拒绝并
 * 返回原因）。
 */
import { createElement as h, Fragment, useEffect, useMemo, useState } from "react";

const NS = "dsh-plugin-session-archive";
const API = "/api/dsh-session-archive";

const zh = {
	title: "会话归档",
	description: "管理已归档的会话：可随时还原到会话列表，或永久删除。归档操作请使用会话列表中的归档入口。",
	refresh: "刷新",
	search: "搜索会话…",
	loading: "正在加载会话列表…",
	empty: "没有已归档的会话。",
	loadError: "读取会话列表失败：{message}",
	restore: "还原",
	delete: "删除",
	restored: "已还原：{title}",
	deleted: "已删除：{title}",
	actionFailed: "操作失败：{message}",
	deleteConfirm: "确定永久删除会话「{title}」吗？此操作会移除会话记录与磁盘文件，不可恢复。",
	ungrouped: "未分组",
};

const en = {
	title: "Session Archive",
	description: "Manage archived sessions: restore them to the session list anytime, or delete them permanently. Use the session list to archive sessions.",
	refresh: "Refresh",
	search: "Search sessions…",
	loading: "Loading sessions…",
	empty: "No archived sessions.",
	loadError: "Failed to load sessions: {message}",
	archivedGroup: "Archived",
	restore: "Restore",
	delete: "Delete",
	restored: "Restored: {title}",
	deleted: "Deleted: {title}",
	actionFailed: "Operation failed: {message}",
	deleteConfirm: "Permanently delete session “{title}”? Its records and on-disk files will be removed and cannot be recovered.",
	ungrouped: "Ungrouped",
};

/** 极简文案翻译：{name} 占位替换。 */
function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 与宿主路由通信的极简 JSON 客户端。 */
async function api(path, options) {
	const response = await fetch(`${API}${path}`, {
		headers: { "content-type": "application/json", accept: "application/json" },
		...options,
	});
	const payload = await response.json().catch(() => ({ ok: false, message: `HTTP ${response.status}` }));
	if (!response.ok || payload.ok !== true) {
		const error = new Error(payload.message ?? `HTTP ${response.status}`);
		error.code = payload.code;
		throw error;
	}
	return payload;
}

const css = `
.dsa-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dsa-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsa-title{margin:0;font-size:16px;font-weight:600}
.dsa-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dsa-toolbar{flex-shrink:0;display:flex;align-items:center;gap:8px}
.dsa-search{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:4px 10px;font-size:13px;line-height:20px;min-width:200px}
.dsa-search:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsa-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dsa-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dsa-btn:disabled{opacity:.5;cursor:default}
.dsa-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dsa-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dsa-group-title{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
.dsa-list{display:flex;flex-direction:column;gap:8px}
.dsa-row{display:flex;align-items:center;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:10px 14px}
.dsa-info{flex:1;min-width:0}
.dsa-name{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.dsa-meta{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;overflow-wrap:anywhere}
.dsa-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777);flex-shrink:0}
.dsa-badge-on{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dsa-actions{flex-shrink:0;display:flex;gap:8px;flex-shrink:0;align-items:center}
.dsa-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dsa-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dsa-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
`;

/** 设置分区组件：props 由 slot 框架提供 t（按 NS 绑定）。 */
function SessionArchiveSection({ t }) {
	const [sessions, setSessions] = useState([]);
	const [status, setStatus] = useState("loading");
	const [notice, setNotice] = useState(null);
	const [busy, setBusy] = useState(null);
	const [query, setQuery] = useState("");

	async function refresh() {
		setStatus("loading");
		try {
			const payload = await api("/sessions");
			setSessions(payload.sessions ?? []);
			setStatus("ok");
		} catch (error) {
			setStatus("error");
			setNotice({ kind: "error", text: format(t("loadError"), { message: error.message }) });
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const archivedOnly = sessions.filter((session) => session.archived);
		if (q === "") return archivedOnly;
		return archivedOnly.filter((session) => session.title.toLowerCase().includes(q) || session.id.toLowerCase().includes(q) || (session.workspaceTitle ?? "").toLowerCase().includes(q));
	}, [sessions, query]);

	async function run(session, operation, messageKey, confirmText) {
		if (confirmText !== undefined && !globalThis.confirm(confirmText)) return;
		setBusy(session.id);
		setNotice(null);
		try {
			await api(`/${operation}`, { method: "POST", body: JSON.stringify({ sessionId: session.id }) });
			setNotice({ kind: "ok", text: format(t(messageKey), { title: session.title }) });
			await refresh();
		} catch (error) {
			setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
		} finally {
			setBusy(null);
		}
	}

	function renderNotice() {
		if (notice === null) return null;
		return h("p", { className: `dsa-notice ${notice.kind === "error" ? "dsa-notice-err" : "dsa-notice-ok"}` }, notice.text);
	}

	function renderRow(session) {
		const actions = [
			h("button", { key: "restore", className: "dsa-btn dsa-btn-primary", disabled: busy !== null, onClick: () => void run(session, "restore", "restored") }, t("restore")),
			h("button", { key: "delete", className: "dsa-btn dsa-btn-danger", disabled: busy !== null, onClick: () => void run(session, "delete", "deleted", format(t("deleteConfirm"), { title: session.title })) }, t("delete")),
		];
		const meta = session.workspaceTitle
			? `${session.workspaceTitle}（${session.workspacePath}）`
			: session.workspacePath || t("ungrouped");
		return h("div", { key: session.id, className: "dsa-row" },
			h("div", { className: "dsa-info" },
				h("div", { className: "dsa-name" }, session.title),
				h("p", { className: "dsa-meta" }, `${session.id} · ${meta}`)),
			session.archived ? h("span", { className: "dsa-badge dsa-badge-on" }, t("archivedGroup")) : null,
			h("div", { className: "dsa-actions" }, actions));
	}

	const archived = filtered.filter((session) => session.archived);

	const body = status === "loading"
		? h("p", { className: "dsa-subtitle" }, t("loading"))
		: status === "error"
			? h("p", { className: "dsa-subtitle" }, format(t("loadError"), { message: "" }))
			: archived.length === 0
				? h("p", { className: "dsa-subtitle" }, t("empty"))
				: h(Fragment, null,
					h("p", { className: "dsa-group-title" }, `${t("archivedGroup")}（${archived.length}）`),
					h("div", { className: "dsa-list" }, archived.map(renderRow)));

	return h(Fragment, null,
		h("style", null, css),
		h("div", { className: "dsa-page" },
			h("div", { className: "dsa-head" },
				h("div", null,
					h("h1", { className: "dsa-title" }, t("title")),
					h("p", { className: "dsa-subtitle" }, t("description"))),
				h("div", { className: "dsa-toolbar" },
					h("button", { className: "dsa-btn", onClick: () => void refresh() }, t("refresh")))),
			h("div", { className: "dsa-toolbar" },
				h("input", { className: "dsa-search", placeholder: t("search"), value: query, onChange: (event) => setQuery(event.target.value) })),
			renderNotice(),
			body));
}

/** 注册会话归档设置分区（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-session-archive: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "session-archive",
		order: 120,
		label: () => t("title"),
		locale: NS,
	}, SessionArchiveSection));
}
