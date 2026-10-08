window.__ModuleLoader__.load({
  id: "dsh-plugin-session-archive",
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

// packages/dsh-plugin-session-archive/src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var NS = "dsh-plugin-session-archive";
var API = "/api/dsh-session-archive";
var zh = {
  title: "\u4F1A\u8BDD\u5F52\u6863",
  description: "\u7BA1\u7406\u5DF2\u5F52\u6863\u7684\u4F1A\u8BDD\uFF1A\u53EF\u968F\u65F6\u8FD8\u539F\u5230\u4F1A\u8BDD\u5217\u8868\uFF0C\u6216\u6C38\u4E45\u5220\u9664\u3002\u5F52\u6863\u64CD\u4F5C\u8BF7\u4F7F\u7528\u4F1A\u8BDD\u5217\u8868\u4E2D\u7684\u5F52\u6863\u5165\u53E3\u3002",
  refresh: "\u5237\u65B0",
  search: "\u641C\u7D22\u4F1A\u8BDD\u2026",
  loading: "\u6B63\u5728\u52A0\u8F7D\u4F1A\u8BDD\u5217\u8868\u2026",
  empty: "\u6CA1\u6709\u5DF2\u5F52\u6863\u7684\u4F1A\u8BDD\u3002",
  loadError: "\u8BFB\u53D6\u4F1A\u8BDD\u5217\u8868\u5931\u8D25\uFF1A{message}",
  restore: "\u8FD8\u539F",
  delete: "\u5220\u9664",
  restored: "\u5DF2\u8FD8\u539F\uFF1A{title}",
  deleted: "\u5DF2\u5220\u9664\uFF1A{title}",
  actionFailed: "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  deleteConfirm: "\u786E\u5B9A\u6C38\u4E45\u5220\u9664\u4F1A\u8BDD\u300C{title}\u300D\u5417\uFF1F\u6B64\u64CD\u4F5C\u4F1A\u79FB\u9664\u4F1A\u8BDD\u8BB0\u5F55\u4E0E\u78C1\u76D8\u6587\u4EF6\uFF0C\u4E0D\u53EF\u6062\u590D\u3002",
  ungrouped: "\u672A\u5206\u7EC4"
};
var en = {
  title: "Session Archive",
  description: "Manage archived sessions: restore them to the session list anytime, or delete them permanently. Use the session list to archive sessions.",
  refresh: "Refresh",
  search: "Search sessions\u2026",
  loading: "Loading sessions\u2026",
  empty: "No archived sessions.",
  loadError: "Failed to load sessions: {message}",
  archivedGroup: "Archived",
  restore: "Restore",
  delete: "Delete",
  restored: "Restored: {title}",
  deleted: "Deleted: {title}",
  actionFailed: "Operation failed: {message}",
  deleteConfirm: "Permanently delete session \u201C{title}\u201D? Its records and on-disk files will be removed and cannot be recovered.",
  ungrouped: "Ungrouped"
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
function SessionArchiveSection({ t }) {
  const [sessions, setSessions] = (0, import_react.useState)([]);
  const [status, setStatus] = (0, import_react.useState)("loading");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(null);
  const [query, setQuery] = (0, import_react.useState)("");
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
  (0, import_react.useEffect)(() => {
    void refresh();
  }, []);
  const filtered = (0, import_react.useMemo)(() => {
    const q = query.trim().toLowerCase();
    const archivedOnly = sessions.filter((session) => session.archived);
    if (q === "") return archivedOnly;
    return archivedOnly.filter((session) => session.title.toLowerCase().includes(q) || session.id.toLowerCase().includes(q) || (session.workspaceTitle ?? "").toLowerCase().includes(q));
  }, [sessions, query]);
  async function run(session, operation, messageKey, confirmText) {
    if (confirmText !== void 0 && !globalThis.confirm(confirmText)) return;
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
    return (0, import_react.createElement)("p", { className: `dsa-notice ${notice.kind === "error" ? "dsa-notice-err" : "dsa-notice-ok"}` }, notice.text);
  }
  function renderRow(session) {
    const actions = [
      (0, import_react.createElement)("button", { key: "restore", className: "dsa-btn dsa-btn-primary", disabled: busy !== null, onClick: () => void run(session, "restore", "restored") }, t("restore")),
      (0, import_react.createElement)("button", { key: "delete", className: "dsa-btn dsa-btn-danger", disabled: busy !== null, onClick: () => void run(session, "delete", "deleted", format(t("deleteConfirm"), { title: session.title })) }, t("delete"))
    ];
    const meta = session.workspaceTitle ? `${session.workspaceTitle}\uFF08${session.workspacePath}\uFF09` : session.workspacePath || t("ungrouped");
    return (0, import_react.createElement)(
      "div",
      { key: session.id, className: "dsa-row" },
      (0, import_react.createElement)(
        "div",
        { className: "dsa-info" },
        (0, import_react.createElement)("div", { className: "dsa-name" }, session.title),
        (0, import_react.createElement)("p", { className: "dsa-meta" }, `${session.id} \xB7 ${meta}`)
      ),
      session.archived ? (0, import_react.createElement)("span", { className: "dsa-badge dsa-badge-on" }, t("archivedGroup")) : null,
      (0, import_react.createElement)("div", { className: "dsa-actions" }, actions)
    );
  }
  const archived = filtered.filter((session) => session.archived);
  const body = status === "loading" ? (0, import_react.createElement)("p", { className: "dsa-subtitle" }, t("loading")) : status === "error" ? (0, import_react.createElement)("p", { className: "dsa-subtitle" }, format(t("loadError"), { message: "" })) : archived.length === 0 ? (0, import_react.createElement)("p", { className: "dsa-subtitle" }, t("empty")) : (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("p", { className: "dsa-group-title" }, `${t("archivedGroup")}\uFF08${archived.length}\uFF09`),
    (0, import_react.createElement)("div", { className: "dsa-list" }, archived.map(renderRow))
  );
  return (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("style", null, css),
    (0, import_react.createElement)(
      "div",
      { className: "dsa-page" },
      (0, import_react.createElement)(
        "div",
        { className: "dsa-head" },
        (0, import_react.createElement)(
          "div",
          null,
          (0, import_react.createElement)("h1", { className: "dsa-title" }, t("title")),
          (0, import_react.createElement)("p", { className: "dsa-subtitle" }, t("description"))
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsa-toolbar" },
          (0, import_react.createElement)("button", { className: "dsa-btn", onClick: () => void refresh() }, t("refresh"))
        )
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dsa-toolbar" },
        (0, import_react.createElement)("input", { className: "dsa-search", placeholder: t("search"), value: query, onChange: (event) => setQuery(event.target.value) })
      ),
      renderNotice(),
      body
    )
  );
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-session-archive: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "session-archive",
    order: 120,
    label: () => t("title"),
    locale: NS
  }, SessionArchiveSection));
}
var inject = [
  "slots",
  "locale"
];

    return module.exports;
  }
});
