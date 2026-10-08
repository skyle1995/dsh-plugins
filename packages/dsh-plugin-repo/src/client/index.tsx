/**
 * dsh-plugin-repo 浏览器半区：设置中的「插件仓库」页。
 *
 * 通过 settings.section slot 注册为设置的一个分区，提供仓库插件目录的
 * 在线列表查看、安装、更新（重装分支最新提交）与卸载。目录数据来自宿主
 * 半区注册的 HTTP 路由 /api/dsh-plugin-repo/catalog；安装/卸载/更新复用
 * 现成的 ctx.remote.pluginManager 远程能力。
 */
import { createElement as h, Fragment, useEffect, useMemo, useRef, useState } from "react";

const NS = "dsh-plugin-repo";
const CATALOG_ROUTE = "/api/dsh-plugin-repo/catalog";

const zh = {
	title: "插件仓库",
	description: "管理仓库中的插件：查看在线目录、安装、更新与卸载。",
	source: "仓库源",
	refresh: "刷新",
	refreshCatalog: "刷新目录",
	loading: "正在加载仓库目录…",
	empty: "仓库目录为空，稍后刷新重试。",
	loadError: "读取仓库目录失败：{message}",
	entryInstall: "安装",
	entryUpdate: "更新",
	entryRemove: "卸载",
	entryBusy: "处理中…",
	entryCancel: "取消",
	notBundle: "非组合包",
	installedBadge: "已安装",
	catalogBadge: "在线版本 {version}",
	installOk: "「{name}」安装成功。",
	installFailed: "「{name}」操作失败：{message}",
	removeConfirm: "确定卸载「{name}」吗？其配置覆盖会保留在 profile 中。",
	unavailable: "当前 profile 没有插件管理服务，无法安装或卸载。",
};

const en = {
	title: "Plugin Repository",
	description: "Manage plugins from the repository: browse the online catalog, install, update, and uninstall.",
	source: "Source",
	refresh: "Refresh",
	refreshCatalog: "Refresh catalog",
	loading: "Loading the repository catalog…",
	empty: "The repository catalog is empty; refresh to retry.",
	loadError: "Failed to load the repository catalog: {message}",
	entryInstall: "Install",
	entryUpdate: "Update",
	entryRemove: "Uninstall",
	entryBusy: "Working…",
	entryCancel: "Cancel",
	notBundle: "Not a bundle",
	installedBadge: "Installed",
	catalogBadge: "Online version {version}",
	installOk: "“{name}” installed successfully.",
	installFailed: "“{name}” operation failed: {message}",
	removeConfirm: "Uninstall “{name}”? Its configuration overrides remain in the profile.",
	unavailable: "This profile has no plugin management service; install and uninstall are unavailable.",
};

/** 极简文案翻译：{name} 占位替换。 */
function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

const css = `
.dpr-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dpr-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dpr-title{margin:0;font-size:16px;font-weight:600}
.dpr-subtitle{margin:0;color:var(--dsw-alias-label-tertiary, #888);font-size:13px;line-height:1.6}
.dpr-source{margin:0;color:var(--dsw-alias-label-tertiary, #888);font-size:12px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;overflow-wrap:anywhere}
.dpr-btn{appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dpr-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dpr-btn:disabled{opacity:.5;cursor:default}
.dpr-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dpr-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dpr-list{display:flex;flex-direction:column;gap:8px}
.dpr-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dpr-info{flex:1;min-width:0}
.dpr-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dpr-version{color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-weight:400}
.dpr-desc{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere}
.dpr-badges{display:flex;gap:6px;flex-wrap:wrap}
.dpr-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dpr-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dpr-badge-warn{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dpr-actions{display:flex;gap:8px;flex-shrink:0;align-items:center}
.dpr-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dpr-notice-err{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d33) 12%, transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dpr-notice-ok{background:color-mix(in srgb, var(--dsw-alias-state-success,#18864b) 12%, transparent);color:var(--dsw-alias-state-success,#18864b)}
`;

/**
 * 设置分区组件：props 由 slot 框架提供 t（按 NS 绑定）、close，以及
 * 注册时 inject 的 ctx。
 */
function RepoSection(props) {
	const { t, ctx } = props;
	const [catalog, setCatalog] = useState({ status: "loading", source: null, entries: [] });
	const [bundles, setBundles] = useState([]);
	const [busy, setBusy] = useState({});
	const [notice, setNotice] = useState(null);
	const requests = useRef(new Map());

	const manager = ctx.remote.pluginManager;
	const installedByName = useMemo(() => new Map(bundles.map((bundle) => [bundle.name, bundle])), [bundles]);

	async function refreshCatalog() {
		setCatalog((previous) => ({ ...previous, status: "loading" }));
		try {
			const response = await fetch(CATALOG_ROUTE, { headers: { accept: "application/json" } });
			const payload = await response.json();
			if (!response.ok || !payload.ok) throw new Error(payload.message ?? `HTTP ${response.status}`);
			setCatalog({ status: "ok", source: payload.source, entries: payload.entries });
		} catch (error) {
			setCatalog({ status: "error", source: null, entries: [], message: error.message });
		}
	}

	async function refreshBundles() {
		try {
			const result = await manager.listBundles();
			if (result?.ok) setBundles(result.value ?? []);
		} catch (error) {
			// 远程读取失败时保留上次快照；安装/卸载按钮会随操作结果报错。
		}
	}

	useEffect(() => {
		void refreshCatalog();
		void refreshBundles();
	}, []);

	function renderNotice() {
		if (notice === null) return null;
		return h("p", { className: `dpr-notice ${notice.kind === "error" ? "dpr-notice-err" : "dpr-notice-ok"}` }, notice.text);
	}

	async function run(name, kind, requestId, work) {
		setBusy((previous) => ({ ...previous, [name]: kind }));
		setNotice(null);
		requests.current.set(name, requestId);
		try {
			await work();
			await refreshBundles();
			await refreshCatalog();
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
			const result = await manager.installBundle(entry.spec, { enabled: true, requestId });
			if (!result?.ok) throw new Error(result?.error?.message ?? "unknown failure");
			setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
		}).catch((error) => {
			setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
		});
	}

	async function cancel(name) {
		const requestId = requests.current.get(name);
		if (requestId === undefined) return;
		try {
			await manager.cancelInstall(requestId);
		} catch {
			// 取消竞态失败忽略；原安装调用仍会结算。
		}
	}

	async function remove(entry) {
		if (!globalThis.confirm(format(t("removeConfirm"), { name: entry.name }))) return;
		await run(entry.name, "remove", undefined, async () => {
			const result = await manager.removeBundle(entry.name);
			if (!result?.ok) throw new Error(result?.error?.message ?? "unknown failure");
			setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
		}).catch((error) => {
			setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
		});
	}

	function renderRow(entry) {
		const bundle = installedByName.get(entry.name);
		const entryBusy = busy[entry.name];
		const actions = [];
		if (entryBusy !== undefined) {
			actions.push(h("button", { key: "busy", className: "dpr-btn", disabled: true }, t("entryBusy")));
			if (entryBusy === "install") actions.push(h("button", { key: "cancel", className: "dpr-btn", onClick: () => void cancel(entry.name) }, t("entryCancel")));
		} else if (bundle) {
			actions.push(h("button", { key: "update", className: "dpr-btn dpr-btn-primary", onClick: () => void install(entry) }, t("entryUpdate")));
			actions.push(h("button", { key: "remove", className: "dpr-btn dpr-btn-danger", onClick: () => void remove(entry) }, t("entryRemove")));
		} else {
			actions.push(h("button", { key: "install", className: "dpr-btn dpr-btn-primary", onClick: () => void install(entry) }, t("entryInstall")));
		}
		const badges = [];
		if (bundle) badges.push(h("span", { key: "on", className: "dpr-badge dpr-badge-on" }, t("installedBadge")));
		if (!entry.isBundle) badges.push(h("span", { key: "nb", className: "dpr-badge dpr-badge-warn" }, t("notBundle")));
		if (entry.version !== null) badges.push(h("span", { key: "v", className: "dpr-badge" }, format(t("catalogBadge"), { version: entry.version })));
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
			: catalog.entries.length === 0
				? h("p", { className: "dpr-subtitle" }, t("empty"))
				: h("div", { className: "dpr-list" }, catalog.entries.map(renderRow));

	return h(Fragment, null,
		h("style", null, css),
		h("div", { className: "dpr-page" },
			h("div", { className: "dpr-head" },
				h("div", null,
					h("h1", { className: "dpr-title" }, t("title")),
					h("p", { className: "dpr-subtitle" }, t("description")),
					catalog.source ? h("p", { className: "dpr-source" }, `${t("source")}：${catalog.source.gitUrl}（${catalog.source.branch}）`) : null),
				h("button", { className: "dpr-btn", onClick: () => { void refreshCatalog(); void refreshBundles(); } }, t("refresh"))),
			renderNotice(),
			body));
}

/** 浏览器插件入口：注册 locale 词典与设置分区。 */
export function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-repo: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "plugin-repo",
		order: 100,
		label: () => t("title"),
		locale: NS,
		inject: () => ({ ctx }),
	}, RepoSection));
}

/** 浏览器依赖注入面（与 package.json 的 dsh.client.inject 一致）。 */
export const inject = [
	"@deepseek-ai/dsh-api-remotes",
	"@deepseek-ai/dsh-client-locale",
];
