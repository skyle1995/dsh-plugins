window.__ModuleLoader__.load({
  id: "dsh-plugin-mcp",
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

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  register: () => register
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var NS = "dsh-plugin-mcp";
var API = "/api/dsh-plugin-mcp";
var zh = {
  title: "MCP \u670D\u52A1\u5668",
  description: "\u7BA1\u7406\u6A21\u578B\u53EF\u7528\u7684\u5916\u90E8 MCP \u670D\u52A1\u5668\uFF1A\u65B0\u589E\u3001\u7F16\u8F91\u3001\u542F\u505C\u4E0E\u5220\u9664\uFF08\u57FA\u4E8E\u5185\u7F6E MCP \u5BA2\u6237\u7AEF\u6865\u63A5\uFF09\u3002",
  managed: "\u5DF2\u7BA1\u7406",
  manual: "cordis.patch.yml \u624B\u5DE5\u914D\u7F6E\uFF08\u53EA\u8BFB\uFF09",
  manualHint: "\u4EE5\u4E0B\u6761\u76EE\u76F4\u63A5\u5199\u5728 profile \u7684 cordis.patch.yml \u4E2D\uFF0C\u8BF7\u5230\u914D\u7F6E\u6587\u4EF6\u91CC\u4FEE\u6539\u3002",
  add: "\u6DFB\u52A0\u670D\u52A1\u5668",
  edit: "\u7F16\u8F91",
  save: "\u4FDD\u5B58",
  cancel: "\u53D6\u6D88",
  refresh: "\u5237\u65B0",
  loading: "\u6B63\u5728\u52A0\u8F7D\u2026",
  empty: "\u8FD8\u6CA1\u6709\u914D\u7F6E MCP \u670D\u52A1\u5668\u3002",
  loadError: "\u8BFB\u53D6\u5217\u8868\u5931\u8D25\uFF1A{message}",
  stateFile: "\u72B6\u6001\u6587\u4EF6\uFF1A{file}",
  corrupt: "\u72B6\u6001\u6587\u4EF6\u635F\u574F\uFF1A{message}",
  enable: "\u542F\u7528",
  disable: "\u505C\u7528",
  remove: "\u5220\u9664",
  removeConfirm: "\u786E\u5B9A\u5220\u9664\u670D\u52A1\u5668\u300C{name}\u300D\u5417\uFF1F\u5176\u5DE5\u5177\u5C06\u7ACB\u5373\u4ECE\u6A21\u578B\u53EF\u7528\u5DE5\u5177\u4E2D\u79FB\u9664\u3002",
  saveOk: "\u300C{name}\u300D\u5DF2\u4FDD\u5B58\u3002",
  removeOk: "\u300C{name}\u300D\u5DF2\u5220\u9664\u3002",
  toggleOk: "\u300C{name}\u300D\u5DF2{state}\u3002",
  opFailed: "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  nameLabel: "\u670D\u52A1\u5668\u540D\uFF08serverName\uFF09",
  nameHint: "\u5DE5\u5177\u5C06\u4EE5 mcp__{name}__<tool> \u5F62\u5F0F\u66B4\u9732\u7ED9\u6A21\u578B\uFF1B[A-Za-z0-9_-]{1,32}",
  transportLabel: "\u4F20\u8F93\u65B9\u5F0F",
  stdio: "stdio\uFF08\u672C\u5730\u8FDB\u7A0B\uFF09",
  http: "streamable-http\uFF08\u8FDC\u7A0B\u670D\u52A1\uFF09",
  commandLabel: "\u547D\u4EE4",
  commandHint: "\u542F\u52A8\u670D\u52A1\u5668\u7684\u53EF\u6267\u884C\u6587\u4EF6\uFF0C\u5982 npx",
  argsLabel: "\u53C2\u6570\uFF08JSON \u6570\u7EC4\uFF09",
  argsHint: '\u5982 ["-y", "@modelcontextprotocol/server-github"]',
  envLabel: "\u73AF\u5883\u53D8\u91CF\uFF08JSON \u5BF9\u8C61\uFF09",
  envHint: '\u5982 {"GITHUB_TOKEN": "ghp_xxx"}\uFF1B\u6CE8\u610F\u4F1A\u660E\u6587\u4FDD\u5B58\u5728\u72B6\u6001\u6587\u4EF6\u4E2D',
  cwdLabel: "\u5DE5\u4F5C\u76EE\u5F55",
  urlLabel: "\u7AEF\u70B9 URL",
  urlHint: "\u5982 http://localhost:3000/mcp",
  headersLabel: "\u8BF7\u6C42\u6807\u5934\uFF08JSON \u5BF9\u8C61\uFF09",
  headersHint: '\u5982 {"Authorization": "Bearer ..."}',
  noteLabel: "\u5907\u6CE8",
  noteHint: "\u4EC5\u4F9B\u9762\u677F\u5C55\u793A\uFF0C\u4E0D\u5F71\u54CD\u914D\u7F6E",
  jsonError: "{label}\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A{message}",
  invalidName: "\u670D\u52A1\u5668\u540D\u5FC5\u987B\u5339\u914D [A-Za-z0-9_-]{1,32}",
  commandRequired: "stdio \u6A21\u5F0F\u9700\u8981\u586B\u5199\u547D\u4EE4",
  urlRequired: "streamable-http \u6A21\u5F0F\u9700\u8981\u586B\u5199 URL",
  statusActive: "\u5DF2\u8FDE\u63A5",
  statusFailed: "\u8FDE\u63A5\u5931\u8D25",
  statusStopped: "\u5DF2\u505C\u6B62",
  statusDisabled: "\u5DF2\u505C\u7528",
  statusStarting: "\u8FDE\u63A5\u4E2D",
  statusPending: "\u5F85\u521B\u5EFA",
  statusConflict: "id \u51B2\u7A81",
  managedBadge: "\u53D7\u7BA1",
  manualBadge: "\u624B\u5DE5"
};
var en = {
  title: "MCP Servers",
  description: "Manage external MCP servers available to the model: add, edit, enable, disable, and remove (built on the bundled MCP client bridge).",
  managed: "Managed",
  manual: "Configured in cordis.patch.yml (read-only)",
  manualHint: "These entries are written directly in the profile's cordis.patch.yml; edit them in the config file.",
  add: "Add server",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  refresh: "Refresh",
  loading: "Loading\u2026",
  empty: "No MCP servers configured yet.",
  loadError: "Failed to load the list: {message}",
  stateFile: "State file: {file}",
  corrupt: "State file is corrupt: {message}",
  enable: "Enable",
  disable: "Disable",
  remove: "Remove",
  removeConfirm: "Remove server \u201C{name}\u201D? Its tools will be removed from the model immediately.",
  saveOk: "\u201C{name}\u201D saved.",
  removeOk: "\u201C{name}\u201D removed.",
  toggleOk: "\u201C{name}\u201D is now {state}.",
  opFailed: "Operation failed: {message}",
  nameLabel: "Server name (serverName)",
  nameHint: "Tools are exposed as mcp__{name}__<tool>; [A-Za-z0-9_-]{1,32}",
  transportLabel: "Transport",
  stdio: "stdio (local process)",
  http: "streamable-http (remote)",
  commandLabel: "Command",
  commandHint: "Executable that starts the server, e.g. npx",
  argsLabel: "Arguments (JSON array)",
  argsHint: 'e.g. ["-y", "@modelcontextprotocol/server-github"]',
  envLabel: "Environment variables (JSON object)",
  envHint: 'e.g. {"GITHUB_TOKEN": "ghp_xxx"}; stored in plain text in the state file',
  cwdLabel: "Working directory",
  urlLabel: "Endpoint URL",
  urlHint: "e.g. http://localhost:3000/mcp",
  headersLabel: "Headers (JSON object)",
  headersHint: 'e.g. {"Authorization": "Bearer ..."}',
  noteLabel: "Note",
  noteHint: "Panel display only; does not affect the config",
  jsonError: "{label} is not valid JSON: {message}",
  invalidName: "Server name must match [A-Za-z0-9_-]{1,32}",
  commandRequired: "stdio requires a command",
  urlRequired: "streamable-http requires a URL",
  statusActive: "Connected",
  statusFailed: "Connection failed",
  statusStopped: "Stopped",
  statusDisabled: "Disabled",
  statusStarting: "Connecting",
  statusPending: "Pending",
  statusConflict: "Id conflict",
  managedBadge: "managed",
  manualBadge: "manual"
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
function emptyForm() {
  return {
    serverName: "",
    transport: "stdio",
    command: "",
    argsText: "",
    envText: "",
    cwd: "",
    url: "",
    headersText: "",
    note: ""
  };
}
function formOf(server) {
  return {
    serverName: server.serverName ?? "",
    transport: server.transport ?? "stdio",
    command: server.command ?? "",
    argsText: Array.isArray(server.args) && server.args.length > 0 ? JSON.stringify(server.args, null, 2) : "",
    envText: server.env && typeof server.env === "object" && Object.keys(server.env).length > 0 ? JSON.stringify(server.env, null, 2) : "",
    cwd: server.cwd ?? "",
    url: server.url ?? "",
    headersText: server.headers && typeof server.headers === "object" && Object.keys(server.headers).length > 0 ? JSON.stringify(server.headers, null, 2) : "",
    note: server.note ?? ""
  };
}
function parseJson(text, label, t) {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return void 0;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(format(t("jsonError"), { label, message: error.message }));
  }
}
var css = `
.dmc-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dmc-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dmc-title{margin:0;font-size:16px;font-weight:600}
.dmc-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dmc-meta{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.dmc-toolbar{flex-shrink:0;display:flex;align-items:center;gap:8px}
.dmc-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dmc-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dmc-btn:disabled{opacity:.5;cursor:default}
.dmc-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dmc-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dmc-list{display:flex;flex-direction:column;gap:8px}
.dmc-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dmc-info{flex:1;min-width:0}
.dmc-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dmc-note{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere}
.dmc-badges{display:flex;gap:6px;flex-wrap:wrap}
.dmc-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dmc-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dmc-badge-warn{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dmc-badge-err{color:var(--dsw-alias-state-error-primary,#d33);border-color:currentColor}
.dmc-actions{flex-shrink:0;display:flex;gap:8px;align-items:center}
.dmc-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dmc-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dmc-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
.dmc-form{display:flex;flex-direction:column;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:14px}
.dmc-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dmc-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dmc-field-wide{grid-column:1 / -1}
.dmc-label{font-size:13px;color:var(--dsw-alias-label-primary,#222)}
.dmc-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);line-height:1.5}
.dmc-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:5px 10px;font-size:13px;line-height:20px;min-width:0;width:100%}
.dmc-input:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dmc-textarea{resize:vertical;min-height:64px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dmc-select{appearance:auto;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:5px 10px;font-size:13px;line-height:20px;min-width:0;width:100%}
.dmc-form-actions{display:flex;gap:8px;justify-content:flex-end}
.dmc-section-label{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
@media (max-width:640px){.dmc-form-grid{grid-template-columns:1fr}}
`;
function McpSection({ t }) {
  const [data, setData] = (0, import_react.useState)({ status: "loading", servers: [], manual: [], stateFile: null, corrupt: null });
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)({});
  const [editing, setEditing] = (0, import_react.useState)(null);
  const [form, setForm] = (0, import_react.useState)(null);
  const [formError, setFormError] = (0, import_react.useState)(null);
  function applySnapshot(payload) {
    setData((previous) => ({
      ...previous,
      status: "ok",
      servers: payload.servers ?? [],
      manual: payload.manual ?? [],
      stateFile: payload.stateFile ?? previous.stateFile,
      corrupt: payload.corrupt ?? null
    }));
  }
  async function refresh() {
    setData((previous) => ({ ...previous, status: "loading" }));
    try {
      const payload = await api("/servers");
      setData({ status: "ok", servers: payload.servers ?? [], manual: payload.manual ?? [], stateFile: payload.stateFile ?? null, corrupt: payload.corrupt ?? null });
    } catch (error) {
      setData({ status: "error", servers: [], manual: [], stateFile: null, corrupt: null, message: error.message });
    }
  }
  (0, import_react.useEffect)(() => {
    void refresh();
  }, []);
  function renderNotice() {
    if (notice === null) return null;
    return (0, import_react.createElement)("p", { className: `dmc-notice ${notice.kind === "error" ? "dmc-notice-err" : "dmc-notice-ok"}` }, notice.text);
  }
  function statusBadge(status) {
    const key = status === "active" ? "statusActive" : status === "failed" ? "statusFailed" : status === "stopped" ? "statusStopped" : status === "disabled" ? "statusDisabled" : status === "starting" ? "statusStarting" : status === "pending" ? "statusPending" : status === "conflict" ? "statusConflict" : null;
    if (key === null) return null;
    const kind = status === "active" ? "on" : status === "failed" || status === "conflict" ? "err" : "warn";
    return (0, import_react.createElement)("span", { key: "status", className: `dmc-badge ${kind === "on" ? "dmc-badge-on" : kind === "err" ? "dmc-badge-err" : "dmc-badge-warn"}` }, t(key));
  }
  async function toggle(server) {
    setBusy((previous) => ({ ...previous, [server.serverName]: "toggle" }));
    setNotice(null);
    try {
      const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "enable", serverName: server.serverName, enabled: server.disabled }) });
      applySnapshot(payload);
      setNotice({ kind: "ok", text: format(t("toggleOk"), { name: server.serverName, state: server.disabled ? t("enable") : t("disable") }) });
    } catch (error) {
      setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
    } finally {
      setBusy((previous) => {
        const next = { ...previous };
        delete next[server.serverName];
        return next;
      });
    }
  }
  async function startEdit(serverName) {
    setFormError(null);
    setNotice(null);
    try {
      const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "detail", serverName }) });
      setForm(formOf(payload.server));
      setEditing(serverName);
    } catch (error) {
      setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
    }
  }
  function startAdd() {
    setFormError(null);
    setNotice(null);
    setForm(emptyForm());
    setEditing(null);
  }
  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  function buildServerPayload() {
    const name = (form.serverName ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) throw new Error(t("invalidName"));
    const args = parseJson(form.argsText, t("argsLabel"), t);
    const env = parseJson(form.envText, t("envLabel"), t);
    const headers = parseJson(form.headersText, t("headersLabel"), t);
    const server = { serverName: name, transport: form.transport, note: form.note };
    if (form.transport === "stdio") {
      if ((form.command ?? "").trim() === "") throw new Error(t("commandRequired"));
      server.command = form.command.trim();
      if (args !== void 0) server.args = args;
      if (env !== void 0) server.env = env;
      if ((form.cwd ?? "").trim() !== "") server.cwd = form.cwd.trim();
    } else {
      if ((form.url ?? "").trim() === "") throw new Error(t("urlRequired"));
      server.url = form.url.trim();
      if (headers !== void 0) server.headers = headers;
    }
    return server;
  }
  async function saveForm() {
    setFormError(null);
    let server;
    try {
      server = buildServerPayload();
    } catch (error) {
      setFormError(error.message);
      return;
    }
    setNotice(null);
    try {
      const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "save", server }) });
      applySnapshot(payload);
      setForm(null);
      setEditing(null);
      setNotice({ kind: "ok", text: format(t("saveOk"), { name: server.serverName }) });
    } catch (error) {
      setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
    }
  }
  async function removeServer(server) {
    if (!globalThis.confirm(format(t("removeConfirm"), { name: server.serverName }))) return;
    setBusy((previous) => ({ ...previous, [server.serverName]: "remove" }));
    setNotice(null);
    try {
      const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "remove", serverName: server.serverName }) });
      applySnapshot(payload);
      setNotice({ kind: "ok", text: format(t("removeOk"), { name: server.serverName }) });
    } catch (error) {
      setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
    } finally {
      setBusy((previous) => {
        const next = { ...previous };
        delete next[server.serverName];
        return next;
      });
    }
  }
  function renderServerRow(server) {
    const rowBusy = busy[server.serverName];
    const badges = [
      statusBadge(server.status),
      (0, import_react.createElement)("span", { key: "transport", className: "dmc-badge" }, server.transport),
      (0, import_react.createElement)("span", { key: "managed", className: "dmc-badge dmc-badge-on" }, t("managedBadge"))
    ].filter(Boolean);
    const actions = [];
    if (rowBusy !== void 0) {
      actions.push((0, import_react.createElement)("button", { key: "busy", className: "dmc-btn", disabled: true }, t("loading")));
    } else {
      actions.push((0, import_react.createElement)("button", { key: "toggle", className: "dmc-btn", onClick: () => void toggle(server) }, server.disabled ? t("enable") : t("disable")));
      actions.push((0, import_react.createElement)("button", { key: "edit", className: "dmc-btn", onClick: () => void startEdit(server.serverName) }, t("edit")));
      actions.push((0, import_react.createElement)("button", { key: "remove", className: "dmc-btn dmc-btn-danger", onClick: () => void removeServer(server) }, t("remove")));
    }
    return (0, import_react.createElement)(
      "div",
      { key: server.id, className: "dmc-row" },
      (0, import_react.createElement)(
        "div",
        { className: "dmc-info" },
        (0, import_react.createElement)(
          "div",
          { className: "dmc-name" },
          (0, import_react.createElement)("span", null, server.serverName),
          (0, import_react.createElement)("div", { className: "dmc-badges" }, badges)
        ),
        server.conflictWith !== null ? (0, import_react.createElement)("p", { className: "dmc-note" }, format(t("loadError"), { message: `id ${server.id} \u5DF2\u88AB ${server.conflictWith} \u5360\u7528` })) : null,
        server.note ? (0, import_react.createElement)("p", { className: "dmc-note" }, server.note) : null
      ),
      (0, import_react.createElement)("div", { className: "dmc-actions" }, actions)
    );
  }
  function renderForm() {
    const isEdit = editing !== null;
    return (0, import_react.createElement)(
      "div",
      { className: "dmc-form" },
      (0, import_react.createElement)(
        "div",
        { className: "dmc-form-grid" },
        (0, import_react.createElement)(
          "label",
          { className: "dmc-field" },
          (0, import_react.createElement)("span", { className: "dmc-label" }, t("nameLabel")),
          (0, import_react.createElement)("input", { className: "dmc-input", value: form.serverName, disabled: isEdit, placeholder: "github", onChange: (event) => updateField("serverName", event.target.value) }),
          (0, import_react.createElement)("span", { className: "dmc-hint" }, t("nameHint"))
        ),
        (0, import_react.createElement)(
          "label",
          { className: "dmc-field" },
          (0, import_react.createElement)("span", { className: "dmc-label" }, t("transportLabel")),
          (0, import_react.createElement)(
            "select",
            { className: "dmc-select", value: form.transport, onChange: (event) => updateField("transport", event.target.value) },
            (0, import_react.createElement)("option", { value: "stdio" }, t("stdio")),
            (0, import_react.createElement)("option", { value: "streamable-http" }, t("http"))
          ),
          (0, import_react.createElement)("span", { className: "dmc-hint" }, form.transport === "stdio" ? t("stdio") : t("http"))
        ),
        form.transport === "stdio" ? (0, import_react.createElement)(
          import_react.Fragment,
          { key: "stdio" },
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("commandLabel")),
            (0, import_react.createElement)("input", { className: "dmc-input", value: form.command, placeholder: "npx", onChange: (event) => updateField("command", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, t("commandHint"))
          ),
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("argsLabel")),
            (0, import_react.createElement)("textarea", { className: "dmc-input dmc-textarea", value: form.argsText, placeholder: '["-y", "@modelcontextprotocol/server-github"]', onChange: (event) => updateField("argsText", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, t("argsHint"))
          ),
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field dmc-field-wide" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("envLabel")),
            (0, import_react.createElement)("textarea", { className: "dmc-input dmc-textarea", value: form.envText, placeholder: '{"GITHUB_TOKEN": "ghp_xxx"}', onChange: (event) => updateField("envText", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, t("envHint"))
          ),
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field dmc-field-wide" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("cwdLabel")),
            (0, import_react.createElement)("input", { className: "dmc-input", value: form.cwd, placeholder: "/path/to/project", onChange: (event) => updateField("cwd", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, null)
          )
        ) : (0, import_react.createElement)(
          import_react.Fragment,
          { key: "http" },
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field dmc-field-wide" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("urlLabel")),
            (0, import_react.createElement)("input", { className: "dmc-input", value: form.url, placeholder: "http://localhost:3000/mcp", onChange: (event) => updateField("url", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, t("urlHint"))
          ),
          (0, import_react.createElement)(
            "label",
            { className: "dmc-field dmc-field-wide" },
            (0, import_react.createElement)("span", { className: "dmc-label" }, t("headersLabel")),
            (0, import_react.createElement)("textarea", { className: "dmc-input dmc-textarea", value: form.headersText, placeholder: '{"Authorization": "Bearer ..."}', onChange: (event) => updateField("headersText", event.target.value) }),
            (0, import_react.createElement)("span", { className: "dmc-hint" }, t("headersHint"))
          )
        ),
        (0, import_react.createElement)(
          "label",
          { className: "dmc-field dmc-field-wide" },
          (0, import_react.createElement)("span", { className: "dmc-label" }, t("noteLabel")),
          (0, import_react.createElement)("input", { className: "dmc-input", value: form.note, onChange: (event) => updateField("note", event.target.value) }),
          (0, import_react.createElement)("span", { className: "dmc-hint" }, t("noteHint"))
        )
      ),
      formError !== null ? (0, import_react.createElement)("p", { className: "dmc-notice dmc-notice-err" }, formError) : null,
      (0, import_react.createElement)(
        "div",
        { className: "dmc-form-actions" },
        (0, import_react.createElement)("button", { className: "dmc-btn", onClick: () => setForm(null) }, t("cancel")),
        (0, import_react.createElement)("button", { className: "dmc-btn dmc-btn-primary", onClick: () => void saveForm() }, t("save"))
      )
    );
  }
  function renderManualRow(entry) {
    return (0, import_react.createElement)(
      "div",
      { key: entry.id, className: "dmc-row" },
      (0, import_react.createElement)(
        "div",
        { className: "dmc-info" },
        (0, import_react.createElement)(
          "div",
          { className: "dmc-name" },
          (0, import_react.createElement)("span", null, entry.serverName || entry.id),
          (0, import_react.createElement)(
            "div",
            { className: "dmc-badges" },
            statusBadge(entry.disabled ? "disabled" : entry.status),
            (0, import_react.createElement)("span", { key: "transport", className: "dmc-badge" }, entry.transport || "?"),
            (0, import_react.createElement)("span", { key: "manual", className: "dmc-badge" }, t("manualBadge")),
            (0, import_react.createElement)("span", { key: "id", className: "dmc-badge" }, entry.id)
          )
        )
      )
    );
  }
  const body = data.status === "loading" ? (0, import_react.createElement)("p", { className: "dmc-subtitle" }, t("loading")) : data.status === "error" ? (0, import_react.createElement)("p", { className: "dmc-subtitle" }, format(t("loadError"), { message: data.message })) : (0, import_react.createElement)(
    import_react.Fragment,
    null,
    data.corrupt !== null ? (0, import_react.createElement)("p", { className: "dmc-notice dmc-notice-err" }, format(t("corrupt"), { message: data.corrupt })) : null,
    form !== null ? renderForm() : null,
    data.servers.length === 0 && data.manual.length === 0 ? (0, import_react.createElement)("p", { className: "dmc-subtitle" }, t("empty")) : (0, import_react.createElement)(
      import_react.Fragment,
      null,
      (0, import_react.createElement)("p", { className: "dmc-section-label" }, t("managed")),
      (0, import_react.createElement)("div", { className: "dmc-list" }, data.servers.map(renderServerRow))
    ),
    data.manual.length > 0 ? (0, import_react.createElement)(
      import_react.Fragment,
      null,
      (0, import_react.createElement)("p", { className: "dmc-section-label" }, t("manual")),
      (0, import_react.createElement)("p", { className: "dmc-subtitle" }, t("manualHint")),
      (0, import_react.createElement)("div", { className: "dmc-list" }, data.manual.map(renderManualRow))
    ) : null
  );
  return (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("style", null, css),
    (0, import_react.createElement)(
      "div",
      { className: "dmc-page" },
      (0, import_react.createElement)(
        "div",
        { className: "dmc-head" },
        (0, import_react.createElement)(
          "div",
          null,
          (0, import_react.createElement)("h1", { className: "dmc-title" }, t("title")),
          (0, import_react.createElement)("p", { className: "dmc-subtitle" }, t("description")),
          data.stateFile !== null ? (0, import_react.createElement)("p", { className: "dmc-meta" }, format(t("stateFile"), { file: data.stateFile })) : null
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dmc-toolbar" },
          (0, import_react.createElement)("button", { className: "dmc-btn", onClick: () => void refresh() }, t("refresh")),
          (0, import_react.createElement)("button", { className: "dmc-btn dmc-btn-primary", onClick: startAdd }, t("add"))
        )
      ),
      renderNotice(),
      body
    )
  );
}
function register(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-plugin-mcp: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-plugin-mcp",
    order: 120,
    label: () => t("title"),
    locale: NS
  }, McpSection));
}
function apply(ctx) {
  register(ctx);
}
var inject = [
  "slots",
  "locale"
];

    return module.exports;
  }
});
