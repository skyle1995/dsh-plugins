window.__ModuleLoader__.load({
  id: "dsh-plugin-repo",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/dsh-plugin-repo/src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var NS = "dsh-plugin-repo";
var API = "/api/dsh-plugin-repo";
var zh = {
  title: "\u63D2\u4EF6\u4ED3\u5E93",
  description: "\u7BA1\u7406\u4ED3\u5E93\u4E2D\u7684\u63D2\u4EF6\uFF1A\u67E5\u770B\u5728\u7EBF\u76EE\u5F55\u3001\u5B89\u88C5\u3001\u66F4\u65B0\u4E0E\u5378\u8F7D\u3002",
  source: "\u4ED3\u5E93\u6E90",
  refresh: "\u5237\u65B0",
  search: "\u641C\u7D22\u63D2\u4EF6\u2026",
  loading: "\u6B63\u5728\u52A0\u8F7D\u4ED3\u5E93\u76EE\u5F55\u2026",
  empty: "\u4ED3\u5E93\u76EE\u5F55\u4E3A\u7A7A\uFF0C\u7A0D\u540E\u5237\u65B0\u91CD\u8BD5\u3002",
  loadError: "\u8BFB\u53D6\u4ED3\u5E93\u76EE\u5F55\u5931\u8D25\uFF1A{message}",
  entryInstall: "\u5B89\u88C5",
  entryUpdate: "\u66F4\u65B0",
  entryRemove: "\u5378\u8F7D",
  entryBusy: "\u5904\u7406\u4E2D\u2026",
  entryCancel: "\u53D6\u6D88",
  notBundle: "\u975E\u7EC4\u5408\u5305",
  installedBadge: "\u5DF2\u5B89\u88C5",
  enabledBadge: "\u5DF2\u542F\u7528",
  catalogBadge: "\u5728\u7EBF\u7248\u672C {version}",
  installOk: "\u300C{name}\u300D\u64CD\u4F5C\u6210\u529F\u3002",
  installFailed: "\u300C{name}\u300D\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  removeConfirm: "\u786E\u5B9A\u5378\u8F7D\u300C{name}\u300D\u5417\uFF1F\u5176\u914D\u7F6E\u8986\u76D6\u4F1A\u4FDD\u7559\u5728 profile \u4E2D\u3002"
};
var en = {
  title: "Plugin Repository",
  description: "Manage plugins from the repository: browse the online catalog, install, update, and uninstall.",
  source: "Source",
  refresh: "Refresh",
  search: "Search plugins\u2026",
  loading: "Loading the repository catalog\u2026",
  empty: "The repository catalog is empty; refresh to retry.",
  loadError: "Failed to load the repository catalog: {message}",
  entryInstall: "Install",
  entryUpdate: "Update",
  entryRemove: "Uninstall",
  entryBusy: "Working\u2026",
  entryCancel: "Cancel",
  notBundle: "Not a bundle",
  installedBadge: "Installed",
  enabledBadge: "Enabled",
  catalogBadge: "Online version {version}",
  installOk: "\u201C{name}\u201D succeeded.",
  installFailed: "\u201C{name}\u201D operation failed: {message}",
  removeConfirm: "Uninstall \u201C{name}\u201D? Its configuration overrides remain in the profile."
};
function format(text, params) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
async function api(path, options) {
  const response = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", accept: "application/json" },
    ...options
  });
  const payload = await response.json().catch(() => ({ ok: false, message: `HTTP ${response.status}` }));
  if (!response.ok || payload.ok !== true) {
    const error = new Error(payload.message ?? `HTTP ${response.status}`);
    error.code = payload.code;
    throw error;
  }
  return payload;
}
var css = `
.dpr-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dpr-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dpr-title{margin:0;font-size:16px;font-weight:600}
.dpr-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dpr-source{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.dpr-toolbar{display:flex;align-items:center;gap:8px}
.dpr-search{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:4px 10px;font-size:13px;line-height:20px;min-width:180px}
.dpr-search:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dpr-btn{appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
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
.dpr-actions{display:flex;gap:8px;flex-shrink:0;align-items:center}
.dpr-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dpr-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dpr-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
`;
function RepoSection({ t }) {
  const [catalog, setCatalog] = (0, import_react.useState)({ status: "loading", source: null, entries: [] });
  const [busy, setBusy] = (0, import_react.useState)({});
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [query, setQuery] = (0, import_react.useState)("");
  const requests = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  async function refresh() {
    setCatalog((previous) => ({ ...previous, status: "loading" }));
    try {
      const payload = await api("/catalog");
      setCatalog({ status: "ok", source: payload.source, entries: payload.entries ?? [] });
    } catch (error) {
      setCatalog({ status: "error", source: null, entries: [], message: error.message });
    }
  }
  (0, import_react.useEffect)(() => {
    void refresh();
  }, []);
  const filtered = (0, import_react.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return catalog.entries;
    return catalog.entries.filter((entry) => entry.name.toLowerCase().includes(q) || (entry.description ?? "").toLowerCase().includes(q));
  }, [catalog.entries, query]);
  function renderNotice() {
    if (notice === null) return null;
    return (0, import_react.createElement)("p", { className: `dpr-notice ${notice.kind === "error" ? "dpr-notice-err" : "dpr-notice-ok"}` }, notice.text);
  }
  async function run(name, kind, requestId, work) {
    setBusy((previous) => ({ ...previous, [name]: kind }));
    setNotice(null);
    if (requestId !== void 0) requests.current.set(name, requestId);
    try {
      await work();
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
    if (requestId === void 0) return;
    try {
      await api("/cancel", { method: "POST", body: JSON.stringify({ requestId }) });
    } catch {
    }
  }
  async function remove(entry) {
    if (!globalThis.confirm(format(t("removeConfirm"), { name: entry.name }))) return;
    await run(entry.name, "remove", void 0, async () => {
      await api("/remove", { method: "POST", body: JSON.stringify({ name: entry.name }) });
      setNotice({ kind: "ok", text: format(t("installOk"), { name: entry.name }) });
    }).catch((error) => {
      setNotice({ kind: "error", text: format(t("installFailed"), { name: entry.name, message: error.message }) });
    });
  }
  function renderRow(entry) {
    const entryBusy = busy[entry.name];
    const actions = [];
    if (entryBusy !== void 0) {
      actions.push((0, import_react.createElement)("button", { key: "busy", className: "dpr-btn", disabled: true }, t("entryBusy")));
      if (entryBusy === "install") actions.push((0, import_react.createElement)("button", { key: "cancel", className: "dpr-btn", onClick: () => void cancel(entry.name) }, t("entryCancel")));
    } else if (entry.installed) {
      actions.push((0, import_react.createElement)("button", { key: "update", className: "dpr-btn dpr-btn-primary", onClick: () => void install(entry) }, t("entryUpdate")));
      if (entry.removable !== false) actions.push((0, import_react.createElement)("button", { key: "remove", className: "dpr-btn dpr-btn-danger", onClick: () => void remove(entry) }, t("entryRemove")));
    } else {
      actions.push((0, import_react.createElement)("button", { key: "install", className: "dpr-btn dpr-btn-primary", onClick: () => void install(entry) }, t("entryInstall")));
    }
    const badges = [];
    if (entry.installed) badges.push((0, import_react.createElement)("span", { key: "installed", className: "dpr-badge dpr-badge-on" }, t("installedBadge")));
    if (entry.enabled) badges.push((0, import_react.createElement)("span", { key: "enabled", className: "dpr-badge dpr-badge-on" }, t("enabledBadge")));
    if (!entry.isBundle) badges.push((0, import_react.createElement)("span", { key: "nb", className: "dpr-badge dpr-badge-warn" }, t("notBundle")));
    if (entry.version !== null && entry.version !== void 0) badges.push((0, import_react.createElement)("span", { key: "v", className: "dpr-badge" }, format(t("catalogBadge"), { version: entry.version })));
    return (0, import_react.createElement)(
      "div",
      { key: entry.name, className: "dpr-row" },
      (0, import_react.createElement)(
        "div",
        { className: "dpr-info" },
        (0, import_react.createElement)(
          "div",
          { className: "dpr-name" },
          (0, import_react.createElement)("span", null, entry.name),
          badges.length > 0 ? (0, import_react.createElement)("div", { className: "dpr-badges" }, badges) : null
        ),
        entry.description ? (0, import_react.createElement)("p", { className: "dpr-desc" }, entry.description) : null
      ),
      (0, import_react.createElement)("div", { className: "dpr-actions" }, actions)
    );
  }
  const body = catalog.status === "loading" ? (0, import_react.createElement)("p", { className: "dpr-subtitle" }, t("loading")) : catalog.status === "error" ? (0, import_react.createElement)("p", { className: "dpr-subtitle" }, format(t("loadError"), { message: catalog.message })) : filtered.length === 0 ? (0, import_react.createElement)("p", { className: "dpr-subtitle" }, t("empty")) : (0, import_react.createElement)("div", { className: "dpr-list" }, filtered.map(renderRow));
  return (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("style", null, css),
    (0, import_react.createElement)(
      "div",
      { className: "dpr-page" },
      (0, import_react.createElement)(
        "div",
        { className: "dpr-head" },
        (0, import_react.createElement)(
          "div",
          null,
          (0, import_react.createElement)("h1", { className: "dpr-title" }, t("title")),
          (0, import_react.createElement)("p", { className: "dpr-subtitle" }, t("description")),
          catalog.source ? (0, import_react.createElement)("p", { className: "dpr-source" }, `${t("source")}\uFF1A${catalog.source.gitUrl}\uFF08${catalog.source.branch}\uFF09`) : null
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dpr-toolbar" },
          (0, import_react.createElement)("button", { className: "dpr-btn", onClick: () => void refresh() }, t("refresh"))
        )
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dpr-toolbar" },
        (0, import_react.createElement)("input", { className: "dpr-search", placeholder: t("search"), value: query, onChange: (event) => setQuery(event.target.value) })
      ),
      renderNotice(),
      body
    )
  );
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-repo: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "plugin-repo",
    order: 100,
    label: () => t("title"),
    locale: NS
  }, RepoSection));
}
var inject = [
  "slots",
  "locale"
];

    return module.exports;
  }
});
