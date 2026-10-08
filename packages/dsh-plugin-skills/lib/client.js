window.__ModuleLoader__.load({
  id: "dsh-plugin-skills",
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

// packages/dsh-plugin-skills/src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var NS = "dsh-plugin-skills";
var API = "/api/dsh-plugin-skills";
var zh = {
  title: "\u6280\u80FD\u80FD\u529B",
  description: "\u7BA1\u7406\u672C\u5730 skills \u6280\u80FD\uFF1A\u65B0\u5EFA\u3001\u7F16\u8F91\u3001\u5220\u9664\u3001\u5BFC\u5165\uFF0C\u4EE5\u53CA\u662F\u5426\u5141\u8BB8\u6A21\u578B\u8C03\u7528\u3002",
  refresh: "\u5237\u65B0",
  create: "\u65B0\u5EFA\u6280\u80FD",
  import: "\u5BFC\u5165",
  edit: "\u7F16\u8F91",
  view: "\u67E5\u770B",
  back: "\u8FD4\u56DE",
  delete: "\u5220\u9664",
  cancel: "\u53D6\u6D88",
  save: "\u4FDD\u5B58",
  name: "\u540D\u79F0",
  skillNamePlaceholder: "\u5982 my-skill\uFF08\u4EC5\u5B57\u6BCD\u6570\u5B57-_\uFF09",
  skillDescription: "\u63CF\u8FF0",
  skillBody: "\u6B63\u6587\uFF08SKILL.md \u5185\u5BB9\uFF09",
  loading: "\u6B63\u5728\u52A0\u8F7D\u6280\u80FD\u5217\u8868\u2026",
  empty: "\u8FD8\u6CA1\u6709\u6280\u80FD\uFF0C\u70B9\u51FB\u300C\u65B0\u5EFA\u6280\u80FD\u300D\u521B\u5EFA\u4E00\u4E2A\u3002",
  loadError: "\u8BFB\u53D6\u6280\u80FD\u5217\u8868\u5931\u8D25\uFF1A{message}",
  saved: "\u6280\u80FD\u300C{name}\u300D\u5DF2\u4FDD\u5B58\u3002",
  removed: "\u6280\u80FD\u300C{name}\u300D\u5DF2\u5220\u9664\u3002",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}",
  actionFailed: "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  deleteConfirm: "\u786E\u5B9A\u5220\u9664\u6280\u80FD\u300C{name}\u300D\u5417\uFF1F",
  modelEnabled: "\u6A21\u578B\u53EF\u8C03\u7528",
  modelDisabled: "\u6A21\u578B\u5DF2\u7981\u7528",
  enableModel: "\u5141\u8BB8\u6A21\u578B\u8C03\u7528",
  disableModel: "\u7981\u7528\u6A21\u578B\u8C03\u7528",
  layoutBundle: "\u76EE\u5F55",
  layoutFlat: "\u6587\u4EF6",
  userInvocable: "\u7528\u6237\u53EF\u8C03\u7528",
  userNotInvocable: "\u7528\u6237\u4E0D\u53EF\u8C03\u7528",
  importOk: "\u5DF2\u5BFC\u5165 {count} \u4E2A\u6280\u80FD\uFF1A{names}",
  importFailed: "\u5BFC\u5165\u5931\u8D25\uFF1A{message}",
  importSkipped: "\u8DF3\u8FC7 {count} \u4E2A\u6587\u4EF6\uFF1A{names}",
  detailBody: "\u6B63\u6587",
  detailFile: "\u6587\u4EF6",
  detailWhenToUse: "\u9002\u7528\u573A\u666F",
  noWhenToUse: "\uFF08\u672A\u586B\u5199\uFF09",
  promptTitle: "\u89C4\u5219\uFF08\u63D0\u793A\u8BCD\uFF09",
  promptDescription: "\u5168\u5C40\u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF08persona\uFF09\u3002\u4FDD\u5B58\u540E\u7531 dsh \u70ED\u52A0\u8F7D\uFF0C\u65E0\u9700\u91CD\u542F\uFF1B\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u3002",
  promptReload: "\u91CD\u65B0\u52A0\u8F7D",
  promptSave: "\u4FDD\u5B58\u63D0\u793A\u8BCD",
  promptSaved: "\u63D0\u793A\u8BCD\u5DF2\u4FDD\u5B58\uFF08\u70ED\u52A0\u8F7D\u751F\u6548\uFF09\u3002",
  promptSaveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}",
  promptLoading: "\u6B63\u5728\u52A0\u8F7D\u63D0\u793A\u8BCD\u2026"
};
var en = {
  title: "Skills",
  description: "Manage local skills: create, edit, delete, import, and control model invocation.",
  refresh: "Refresh",
  create: "New skill",
  import: "Import",
  edit: "Edit",
  view: "View",
  back: "Back",
  delete: "Delete",
  cancel: "Cancel",
  save: "Save",
  name: "Name",
  skillNamePlaceholder: "e.g. my-skill (letters, digits, - and _ only)",
  skillDescription: "Description",
  skillBody: "Body (SKILL.md content)",
  loading: "Loading skills\u2026",
  empty: "No skills yet. Click \u201CNew skill\u201D to create one.",
  loadError: "Failed to load skills: {message}",
  saved: "Skill \u201C{name}\u201D saved.",
  removed: "Skill \u201C{name}\u201D deleted.",
  saveFailed: "Save failed: {message}",
  actionFailed: "Operation failed: {message}",
  deleteConfirm: "Delete skill \u201C{name}\u201D?",
  modelEnabled: "Model invocable",
  modelDisabled: "Model disabled",
  enableModel: "Allow model invocation",
  disableModel: "Disable model invocation",
  layoutBundle: "Directory",
  layoutFlat: "File",
  userInvocable: "User invocable",
  userNotInvocable: "Not user invocable",
  importOk: "Imported {count} skill(s): {names}",
  importFailed: "Import failed: {message}",
  importSkipped: "Skipped {count} file(s): {names}",
  detailBody: "Body",
  detailFile: "File",
  detailWhenToUse: "When to use",
  noWhenToUse: "(not set)",
  promptTitle: "Rules (Prompt)",
  promptDescription: "Global system prompt (persona). Saved changes hot-apply without restart; leave empty for the default.",
  promptReload: "Reload",
  promptSave: "Save prompt",
  promptSaved: "Prompt saved (hot-applied).",
  promptSaveFailed: "Save failed: {message}",
  promptLoading: "Loading prompt\u2026"
};
function format(text, params) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
var css = `
.dsk-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dsk-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsk-title{margin:0;font-size:16px;font-weight:600}
.dsk-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dsk-actions{flex-shrink:0;display:flex;gap:8px;flex-shrink:0;align-items:center}
.dsk-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dsk-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dsk-btn:disabled{opacity:.5;cursor:default}
.dsk-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dsk-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dsk-form{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:14px}
.dsk-field{display:flex;flex-direction:column;gap:4px}
.dsk-label{font-size:12px;color:var(--dsw-alias-label-secondary,#555)}
.dsk-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:6px 10px;font-size:13px;line-height:20px}
.dsk-input:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsk-textarea{min-height:220px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.6}
.dsk-list{display:flex;flex-direction:column;gap:8px}
.dsk-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dsk-info{flex:1;min-width:0}
.dsk-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dsk-desc{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsk-detail-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dsk-body{box-sizing:border-box;max-height:360px;overflow:auto;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:8px;padding:10px 12px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary,#222)}
.dsk-meta{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.dsk-badges{display:flex;gap:6px;flex-wrap:wrap}
.dsk-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dsk-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dsk-badge-off{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dsk-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dsk-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dsk-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
`;
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
function SkillsSection({ t }) {
  const [skills, setSkills] = (0, import_react.useState)([]);
  const [status, setStatus] = (0, import_react.useState)("loading");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [editing, setEditing] = (0, import_react.useState)(null);
  const [form, setForm] = (0, import_react.useState)({ name: "", description: "", body: "" });
  const fileRef = (0, import_react.useRef)(null);
  async function refresh() {
    setStatus("loading");
    try {
      const payload = await api("/skills");
      setSkills(payload.skills ?? []);
      setStatus("ok");
    } catch (error) {
      setStatus("error");
      setNotice({ kind: "error", text: format(t("loadError"), { message: error.message }) });
    }
  }
  (0, import_react.useEffect)(() => {
    void refresh();
  }, []);
  function openCreate() {
    setForm({ name: "", description: "", body: "" });
    setEditing({ mode: "create" });
    setNotice(null);
  }
  function openEdit(skill) {
    setForm({ name: skill.name, description: skill.description, body: skill.body });
    setEditing({ mode: "edit", skill });
    setNotice(null);
  }
  function openView(skill) {
    setEditing({ mode: "view", skill });
    setNotice(null);
  }
  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === void 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const payload = await api("/import", {
        method: "POST",
        headers: { "x-file-name": encodeURIComponent(file.name), "content-type": "application/octet-stream" },
        body: file
      });
      const imported = payload.imported ?? [];
      const skipped = payload.skipped ?? [];
      setNotice({
        kind: "ok",
        text: `${format(t("importOk"), { count: imported.length, names: imported.map((item) => item.name).join("\u3001") || "\u2014" })}${skipped.length > 0 ? " " + format(t("importSkipped"), { count: skipped.length, names: skipped.join("\u3001") }) : ""}`
      });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: format(t("importFailed"), { message: error.message }) });
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (form.name.trim() === "") {
      setNotice({ kind: "error", text: format(t("saveFailed"), { message: t("skillNamePlaceholder") }) });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload = await api("/save", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          body: form.body,
          ...editing.mode === "edit" ? { previous: editing.skill } : {}
        })
      });
      setEditing(null);
      setNotice({ kind: "ok", text: format(t("saved"), { name: payload.skill.name }) });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: format(t("saveFailed"), { message: error.message }) });
    } finally {
      setBusy(false);
    }
  }
  async function toggleModel(skill) {
    setBusy(true);
    setNotice(null);
    try {
      await api("/toggle", { method: "POST", body: JSON.stringify({ name: skill.name, modelEnabled: skill.modelDisabled }) });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
    } finally {
      setBusy(false);
    }
  }
  async function remove(skill) {
    if (!globalThis.confirm(format(t("deleteConfirm"), { name: skill.name }))) return;
    setBusy(true);
    setNotice(null);
    try {
      await api("/delete", { method: "POST", body: JSON.stringify({ name: skill.name }) });
      setNotice({ kind: "ok", text: format(t("removed"), { name: skill.name }) });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
    } finally {
      setBusy(false);
    }
  }
  function renderNotice() {
    if (notice === null) return null;
    return (0, import_react.createElement)("p", { className: `dsk-notice ${notice.kind === "error" ? "dsk-notice-err" : "dsk-notice-ok"}` }, notice.text);
  }
  function renderForm() {
    return (0, import_react.createElement)(
      "div",
      { className: "dsk-form" },
      (0, import_react.createElement)(
        "div",
        { className: "dsk-field" },
        (0, import_react.createElement)("span", { className: "dsk-label" }, t("name")),
        (0, import_react.createElement)("input", { className: "dsk-input", value: form.name, placeholder: t("skillNamePlaceholder"), onChange: (event) => setForm({ ...form, name: event.target.value }) })
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dsk-field" },
        (0, import_react.createElement)("span", { className: "dsk-label" }, t("skillDescription")),
        (0, import_react.createElement)("input", { className: "dsk-input", value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }) })
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dsk-field" },
        (0, import_react.createElement)("span", { className: "dsk-label" }, t("skillBody")),
        (0, import_react.createElement)("textarea", { className: "dsk-input dsk-textarea", value: form.body, onChange: (event) => setForm({ ...form, body: event.target.value }) })
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dsk-actions" },
        (0, import_react.createElement)("button", { className: "dsk-btn dsk-btn-primary", disabled: busy, onClick: () => void submit() }, t("save")),
        (0, import_react.createElement)("button", { className: "dsk-btn", disabled: busy, onClick: () => setEditing(null) }, t("cancel"))
      )
    );
  }
  function renderDetail() {
    const skill = editing.skill;
    const badges = [
      (0, import_react.createElement)("span", { key: "layout", className: "dsk-badge" }, skill.layout === "bundle" ? t("layoutBundle") : t("layoutFlat")),
      (0, import_react.createElement)("span", { key: "model", className: `dsk-badge ${skill.modelDisabled ? "dsk-badge-off" : "dsk-badge-on"}` }, skill.modelDisabled ? t("modelDisabled") : t("modelEnabled")),
      (0, import_react.createElement)("span", { key: "user", className: `dsk-badge ${skill.userInvocable ? "dsk-badge-on" : "dsk-badge-off"}` }, skill.userInvocable ? t("userInvocable") : t("userNotInvocable"))
    ];
    return (0, import_react.createElement)(
      "div",
      { className: "dsk-form" },
      (0, import_react.createElement)(
        "div",
        { className: "dsk-detail-head" },
        (0, import_react.createElement)(
          "div",
          { className: "dsk-name" },
          (0, import_react.createElement)("span", null, skill.name),
          (0, import_react.createElement)("div", { className: "dsk-badges" }, badges)
        ),
        (0, import_react.createElement)("button", { className: "dsk-btn", onClick: () => setEditing(null) }, t("back"))
      ),
      skill.description ? (0, import_react.createElement)("p", { className: "dsk-desc", style: { display: "block", WebkitLineClamp: "unset" } }, skill.description) : null,
      skill.whenToUse ? (0, import_react.createElement)("p", { className: "dsk-desc", style: { display: "block", WebkitLineClamp: "unset" } }, `${t("detailWhenToUse")}\uFF1A${skill.whenToUse}`) : (0, import_react.createElement)("p", { className: "dsk-subtitle" }, `${t("detailWhenToUse")}\uFF1A${t("noWhenToUse")}`),
      (0, import_react.createElement)("p", { className: "dsk-meta" }, `${t("detailFile")}\uFF1A${skill.file}`),
      (0, import_react.createElement)(
        "div",
        { className: "dsk-field" },
        (0, import_react.createElement)("span", { className: "dsk-label" }, t("detailBody")),
        (0, import_react.createElement)("pre", { className: "dsk-body" }, skill.body)
      )
    );
  }
  function renderRow(skill) {
    const badges = [
      (0, import_react.createElement)("span", { key: "layout", className: "dsk-badge" }, skill.layout === "bundle" ? t("layoutBundle") : t("layoutFlat")),
      (0, import_react.createElement)("span", { key: "model", className: `dsk-badge ${skill.modelDisabled ? "dsk-badge-off" : "dsk-badge-on"}` }, skill.modelDisabled ? t("modelDisabled") : t("modelEnabled")),
      (0, import_react.createElement)("span", { key: "user", className: `dsk-badge ${skill.userInvocable ? "dsk-badge-on" : "dsk-badge-off"}` }, skill.userInvocable ? t("userInvocable") : t("userNotInvocable"))
    ];
    return (0, import_react.createElement)(
      "div",
      { key: skill.name, className: "dsk-row" },
      (0, import_react.createElement)(
        "div",
        { className: "dsk-info" },
        (0, import_react.createElement)(
          "div",
          { className: "dsk-name" },
          (0, import_react.createElement)("span", null, skill.name),
          (0, import_react.createElement)("div", { className: "dsk-badges" }, badges)
        ),
        skill.description ? (0, import_react.createElement)("p", { className: "dsk-desc" }, skill.description) : null
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dsk-actions" },
        (0, import_react.createElement)("button", { className: "dsk-btn", disabled: busy, onClick: () => openView(skill) }, t("view")),
        (0, import_react.createElement)("button", { className: "dsk-btn", disabled: busy, onClick: () => openEdit(skill) }, t("edit")),
        (0, import_react.createElement)("button", { className: "dsk-btn", disabled: busy, onClick: () => void toggleModel(skill) }, skill.modelDisabled ? t("enableModel") : t("disableModel")),
        (0, import_react.createElement)("button", { className: "dsk-btn dsk-btn-danger", disabled: busy, onClick: () => void remove(skill) }, t("delete"))
      )
    );
  }
  const body = status === "loading" ? (0, import_react.createElement)("p", { className: "dsk-subtitle" }, t("loading")) : status === "error" ? (0, import_react.createElement)("p", { className: "dsk-subtitle" }, format(t("loadError"), { message: "" })) : skills.length === 0 ? (0, import_react.createElement)("p", { className: "dsk-subtitle" }, t("empty")) : (0, import_react.createElement)("div", { className: "dsk-list" }, skills.map(renderRow));
  return (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("style", null, css),
    (0, import_react.createElement)(
      "div",
      { className: "dsk-page" },
      (0, import_react.createElement)(
        "div",
        { className: "dsk-head" },
        (0, import_react.createElement)(
          "div",
          null,
          (0, import_react.createElement)("h1", { className: "dsk-title" }, t("title")),
          (0, import_react.createElement)("p", { className: "dsk-subtitle" }, t("description"))
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsk-actions" },
          (0, import_react.createElement)("button", { className: "dsk-btn", onClick: () => void refresh() }, t("refresh")),
          (0, import_react.createElement)("button", { className: "dsk-btn", onClick: () => fileRef.current?.click() }, t("import")),
          (0, import_react.createElement)("button", { className: "dsk-btn dsk-btn-primary", onClick: openCreate }, t("create"))
        ),
        (0, import_react.createElement)("input", { ref: fileRef, type: "file", accept: ".md,.zip,.tar.gz,.tgz", style: { display: "none" }, onChange: (event) => void handleImport(event) })
      ),
      renderNotice(),
      editing !== null && editing.mode === "view" ? renderDetail() : null,
      editing !== null && editing.mode !== "view" ? renderForm() : null,
      body
    )
  );
}
function PromptSection({ t }) {
  const [persona, setPersona] = (0, import_react.useState)("");
  const [status, setStatus] = (0, import_react.useState)("loading");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  async function load() {
    setStatus("loading");
    try {
      const payload = await api("/prompt");
      setPersona(payload.persona ?? "");
      setStatus("ok");
    } catch (error) {
      setStatus("error");
      setNotice({ kind: "error", text: format(t("promptSaveFailed"), { message: error.message }) });
    }
  }
  (0, import_react.useEffect)(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      await api("/prompt", { method: "POST", body: JSON.stringify({ persona }) });
      setNotice({ kind: "ok", text: t("promptSaved") });
    } catch (error) {
      setNotice({ kind: "error", text: format(t("promptSaveFailed"), { message: error.message }) });
    } finally {
      setBusy(false);
    }
  }
  const body = status === "loading" ? (0, import_react.createElement)("p", { className: "dsk-subtitle" }, t("promptLoading")) : (0, import_react.createElement)("textarea", { className: "dsk-input dsk-textarea", style: { minHeight: 380 }, value: persona, onChange: (event) => setPersona(event.target.value), placeholder: "You are a coding agent..." });
  return (0, import_react.createElement)(
    import_react.Fragment,
    null,
    (0, import_react.createElement)("style", null, css),
    (0, import_react.createElement)(
      "div",
      { className: "dsk-page" },
      (0, import_react.createElement)(
        "div",
        { className: "dsk-head" },
        (0, import_react.createElement)(
          "div",
          null,
          (0, import_react.createElement)("h1", { className: "dsk-title" }, t("promptTitle")),
          (0, import_react.createElement)("p", { className: "dsk-subtitle" }, t("promptDescription"))
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsk-actions" },
          (0, import_react.createElement)("button", { className: "dsk-btn", onClick: () => void load() }, t("promptReload")),
          (0, import_react.createElement)("button", { className: "dsk-btn dsk-btn-primary", disabled: busy || status !== "ok", onClick: () => void save() }, t("promptSave"))
        )
      ),
      notice !== null ? (0, import_react.createElement)("p", { className: `dsk-notice ${notice.kind === "error" ? "dsk-notice-err" : "dsk-notice-ok"}` }, notice.text) : null,
      body
    )
  );
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-skills: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "skills-manager",
    order: 110,
    label: () => t("title"),
    locale: NS
  }, SkillsSection));
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "rules-prompt",
    order: 130,
    label: () => t("promptTitle"),
    locale: NS
  }, PromptSection));
}
var inject = [
  "slots",
  "locale"
];

    return module.exports;
  }
});
