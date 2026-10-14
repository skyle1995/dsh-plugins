/**
 * dsh-plugin-repo 浏览器半区：设置面板里的「插件仓库」独立分区。
 *
 * 在线列表与安装/更新/卸载全部通过宿主半区注册的同源 HTTP 路由完成
 * （参考 dsh-plugin-market 的做法）：
 * - GET  /api/dsh-plugin-repo/catalog  目录 + 已安装/启用状态
 * - POST /api/dsh-plugin-repo/install  { spec, enabled, requestId }
 * - POST /api/dsh-plugin-repo/remove   { name }
 * - POST /api/dsh-plugin-repo/cancel   { requestId }
 *
 * 浏览器侧不依赖 ctx.remote，渲染只依赖框架注入的 t 与本地 fetch。
 */
import { createElement as h, Fragment, useEffect, useMemo, useRef, useState } from "react";

const NS = "dsh-plugin-repo";
const API = "/api/dsh-plugin-repo";

const zh = {
	title: "插件仓库",
	description: "管理仓库中的插件：查看在线目录、安装、更新与卸载。",
	source: "仓库源",
	refresh: "刷新",
	search: "搜索插件…",
	loading: "正在加载仓库目录…",
	empty: "仓库目录为空，稍后刷新重试。",
	loadError: "读取仓库目录失败：{message}",
	entryInstall: "安装",
	entryUpdate: "更新",
	entryReinstall: "重装",
	entryEnable: "启用",
	entryDisable: "禁用",
	entryRemove: "卸载",
	entryBusy: "处理中…",
	entryCancel: "取消",
	notBundle: "非组合包",
	notInstalledBadge: "未安装",
	installedBadge: "已安装",
	enabledBadge: "已启用",
	disabledBadge: "已禁用",
	basePluginBadge: "基础插件",
	versionBadge: "版本 {version}",
	repoVersionBadge: "仓库版本 {version}",
	updateAvailableBadge: "可更新",
	installOk: "「{name}」操作成功。",
	installFailed: "「{name}」操作失败：{message}",
	removeConfirm: "确定卸载「{name}」吗？其配置覆盖会保留在 profile 中。",
};

const en = {
	title: "Plugin Repository",
	description: "Manage plugins from the repository: browse the online catalog, install, update, and uninstall.",
	source: "Source",
	refresh: "Refresh",
	search: "Search plugins…",
	loading: "Loading the repository catalog…",
	empty: "The repository catalog is empty; refresh to retry.",
	loadError: "Failed to load the repository catalog: {message}",
	entryInstall: "Install",
	entryUpdate: "Update",
	entryReinstall: "Reinstall",
	entryEnable: "Enable",
	entryDisable: "Disable",
	entryRemove: "Uninstall",
	entryBusy: "Working…",
	entryCancel: "Cancel",
	notBundle: "Not a bundle",
	notInstalledBadge: "Not installed",
	installedBadge: "Installed",
	enabledBadge: "Enabled",
	disabledBadge: "Disabled",
	basePluginBadge: "Base plugin",
	versionBadge: "v{version}",
	repoVersionBadge: "Repo v{version}",
	updateAvailableBadge: "Update available",
	installOk: "“{name}” succeeded.",
	installFailed: "“{name}” operation failed: {message}",
	removeConfirm: "Uninstall “{name}”? Its configuration overrides remain in the profile.",
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
.dpr-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dpr-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dpr-title{margin:0;font-size:16px;font-weight:600}
.dpr-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dpr-source{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.dpr-toolbar{flex-shrink:0;display:flex;align-items:center;gap:8px}
.dpr-search{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:4px 10px;font-size:13px;line-height:20px;min-width:180px}
.dpr-search:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dpr-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dpr-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dpr-btn:disabled{opacity:.5;cursor:default}
.dpr-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dpr-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dpr-list{display:flex;flex-direction:column;gap:8px}
.dpr-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dpr-info{flex:1;min-width:0}
.dpr-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dpr-desc{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dpr-badges{display:flex;gap:6px;flex-wrap:wrap}
.dpr-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dpr-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dpr-badge-warn{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dpr-actions{flex-shrink:0;display:flex;gap:8px;flex-shrink:0;align-items:center}
.dpr-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dpr-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dpr-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
.dpr-reload{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dpr-reload .dpr-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
`;

/** 设置分区组件：props 由 slot 框架提供 t（按 NS 绑定）。 */
function RepoSection({ t }) {
	const [catalog, setCatalog] = useState({ status: "loading", source: null, entries: [] });
	const [busy, setBusy] = useState({});
	const [notice, setNotice] = useState(null);
	const [query, setQuery] = useState("");
	/** 插件安装/更新/启停/删除后提示刷新；非 null 时倒计时自动刷新页面。 */
	const requests = useRef(new Map());

	async function refresh() {
		setCatalog((previous) => ({ ...previous, status: "loading" }));
		try {
			const payload = await api("/catalog");
			setCatalog({ status: "ok", source: payload.source, entries: payload.entries ?? [] });
		} catch (error) {
			setCatalog({ status: "error", source: null, entries: [], message: error.message });
		}
	}

	useEffect(() => {
		void refresh();
	}, []);


	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (q === "") return catalog.entries;
		return catalog.entries.filter((entry) => entry.name.toLowerCase().includes(q) || (entry.description ?? "").toLowerCase().includes(q));
	}, [catalog.entries, query]);

	function renderNotice() {
		if (notice === null) return null;
		return h("p", { className: `dpr-notice ${notice.kind === "error" ? "dpr-notice-err" : "dpr-notice-ok"}` }, notice.text);
	}

	async function run(name, kind, requestId, work) {
		setBusy((previous) => ({ ...previous, [name]: kind }));
		setNotice(null);
		if (requestId !== undefined) requests.current.set(name, requestId);
		try {
			await work();
			// 不整页刷新（避免打断连续安装），仅自动更新目录列表：
			// 已安装/启用状态与版本徽标随 refresh 立即变化。
			await refresh();
		} finally {
			requests.current.delete(name);
			setBusy((previous) => {
				const next = { ...previous };
				delete next[name];
				return next;
			});
		}
	}

	async function install(entry) {
		const requestId = crypto.randomUUID();
		await run(entry.name, "install", requestId, async () => {
			await api("/install", { method: "POST", body: JSON.stringify({ spec: entry.spec, enabled: true, requestId }) });
			setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
		}).catch((error) => {
			setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
		});
	}

	async function cancel(name) {
		const requestId = requests.current.get(name);
		if (requestId === undefined) return;
		try {
			await api("/cancel", { method: "POST", body: JSON.stringify({ requestId }) });
		} catch {
			// 取消竞态失败忽略；原安装调用仍会结算。
		}
	}

	async function toggleEnabled(entry) {
		await run(entry.name, "toggle", undefined, async () => {
			await api("/enable", { method: "POST", body: JSON.stringify({ name: entry.name, enabled: !entry.enabled }) });
			setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
		}).catch((error) => {
			setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
		});
	}

	async function remove(entry) {
		if (!globalThis.confirm(format(t("removeConfirm"), { name: entry.name }))) return;
		await run(entry.name, "remove", undefined, async () => {
			await api("/remove", { method: "POST", body: JSON.stringify({ name: entry.name }) });
			setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
		}).catch((error) => {
			setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
		});
	}

	function renderRow(entry) {
		const entryBusy = busy[entry.name];
		const actions = [];
		if (entryBusy !== undefined) {
			actions.push(h("button", { key: "busy", className: "dpr-btn", disabled: true }, t("entryBusy")));
			if (entryBusy === "install") actions.push(h("button", { key: "cancel", className: "dpr-btn", onClick: () => void cancel(entry.name) }, t("entryCancel")));
		} else if (entry.installed) {
			const hasUpdate = entry.installedVersion !== null && entry.installedVersion !== undefined && entry.version !== null && entry.version !== undefined && entry.installedVersion !== entry.version;
			actions.push(h("button", { key: hasUpdate ? "update" : "reinstall", className: hasUpdate ? "dpr-btn dpr-btn-primary" : "dpr-btn", onClick: () => void install(entry) }, hasUpdate ? t("entryUpdate") : t("entryReinstall")));
			if (!entry.self) actions.push(h("button", { key: "toggle", className: "dpr-btn", onClick: () => void toggleEnabled(entry) }, entry.enabled ? t("entryDisable") : t("entryEnable")));
			if (entry.removable !== false) actions.push(h("button", { key: "remove", className: "dpr-btn dpr-btn-danger", onClick: () => void remove(entry) }, t("entryRemove")));
		} else {
			actions.push(h("button", { key: "install", className: "dpr-btn dpr-btn-primary", onClick: () => void install(entry) }, t("entryInstall")));
		}
		const badges = [];
		const hasUpdate = entry.installedVersion !== null && entry.installedVersion !== undefined && entry.version !== null && entry.version !== undefined && entry.installedVersion !== entry.version;
		if (entry.installedVersion !== null && entry.installedVersion !== undefined) badges.push(h("span", { key: "iv", className: "dpr-badge" }, format(t("versionBadge"), { version: entry.installedVersion })));
		badges.push(h("span", { key: "installed", className: entry.installed ? "dpr-badge dpr-badge-on" : "dpr-badge" }, entry.installed ? t("installedBadge") : t("notInstalledBadge")));
		if (entry.installed) badges.push(h("span", { key: "enabled", className: entry.enabled ? "dpr-badge dpr-badge-on" : "dpr-badge dpr-badge-warn" }, entry.enabled ? t("enabledBadge") : t("disabledBadge")));
		if (entry.version !== null && entry.version !== undefined) badges.push(h("span", { key: "v", className: "dpr-badge" }, format(t("repoVersionBadge"), { version: entry.version })));
		if (hasUpdate) badges.push(h("span", { key: "update", className: "dpr-badge dpr-badge-warn" }, t("updateAvailableBadge")));
		if (entry.self) badges.push(h("span", { key: "base", className: "dpr-badge" }, t("basePluginBadge")));
		if (!entry.isBundle) badges.push(h("span", { key: "nb", className: "dpr-badge dpr-badge-warn" }, t("notBundle")));
		return h("div", { key: entry.name, className: "dpr-row" },
			h("div", { className: "dpr-info" },
				h("div", { className: "dpr-name" },
					h("span", null, entry.name),
					badges.length > 0 ? h("div", { className: "dpr-badges" }, badges) : null),
				entry.description ? h("p", { className: "dpr-desc" }, entry.description) : null),
			h("div", { className: "dpr-actions" }, actions));
	}

	const body = catalog.status === "loading"
		? h("p", { className: "dpr-subtitle" }, t("loading"))
		: catalog.status === "error"
			? h("p", { className: "dpr-subtitle" }, format(t("loadError"), { message: catalog.message }))
			: filtered.length === 0
				? h("p", { className: "dpr-subtitle" }, t("empty"))
				: h("div", { className: "dpr-list" }, filtered.map(renderRow));

	return h(Fragment, null,
		h("style", null, css),
		h("div", { className: "dpr-page" },
			h("div", { className: "dpr-head" },
				h("div", null,
					h("h1", { className: "dpr-title" }, t("title")),
					h("p", { className: "dpr-subtitle" }, t("description")),
					catalog.source ? h("p", { className: "dpr-source" }, `${t("source")}：${catalog.source.gitUrl}（${catalog.source.branch}）`) : null),
				h("div", { className: "dpr-toolbar" },
					h("button", { className: "dpr-btn", onClick: () => void refresh() }, t("refresh")))),
			h("div", { className: "dpr-toolbar" },
				h("input", { className: "dpr-search", placeholder: t("search"), value: query, onChange: (event) => setQuery(event.target.value) })),
			renderNotice(),
			body));
}

/** 注册插件仓库设置分区（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-repo: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "plugin-repo",
		order: 100,
		label: () => t("title"),
		locale: NS,
	}, RepoSection));
}
