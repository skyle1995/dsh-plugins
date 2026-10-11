window.__ModuleLoader__.load({
  id: "dsh-plugin-file-actions",
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
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var NS = "dsh-plugin-file-actions";
var API = "/api/dsh-file-actions";
var OWN_UI = "[data-dfa-ui], .dfa-menu";
var zh = {
  "menu.paste": "\u7C98\u8D34",
  "menu.pasteN": "\u7C98\u8D34 {count} \u9879",
  "menu.cut": "\u526A\u5207",
  "menu.cutN": "\u526A\u5207 {count} \u9879",
  "menu.copy": "\u590D\u5236",
  "menu.copyN": "\u590D\u5236 {count} \u9879",
  "menu.copyPath": "\u590D\u5236\u8DEF\u5F84",
  "menu.copyPathN": "\u590D\u5236 {count} \u6761\u8DEF\u5F84",
  "menu.compress": "\u538B\u7F29\u4E3A ZIP",
  "menu.compressN": "\u538B\u7F29 {count} \u9879\u4E3A ZIP",
  "menu.delete": "\u5220\u9664",
  "menu.deleteN": "\u5220\u9664 {count} \u9879",
  "menu.clearSelection": "\u53D6\u6D88\u9009\u62E9",
  "menu.hint": "\u6309\u4F4F \u2318/Ctrl \u70B9\u51FB\u53EF\u591A\u9009",
  "delete.title": "\u5220\u9664\u6587\u4EF6",
  "delete.description": "\u4EE5\u4E0B {count} \u9879\u5C06\u88AB\u6C38\u4E45\u5220\u9664\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\uFF1A\n{preview}",
  "delete.acknowledge": "\u6211\u5DF2\u77E5\u6653\u5220\u9664\u4E0D\u53EF\u6062\u590D",
  "delete.cancel": "\u53D6\u6D88",
  "delete.confirm": "\u5220\u9664",
  "compress.title": "\u538B\u7F29\u4E3A ZIP",
  "compress.description": "\u538B\u7F29\u5305\u6587\u4EF6\u540D\uFF08\u53EF\u4FEE\u6539\uFF09\uFF1A",
  "compress.cancel": "\u53D6\u6D88",
  "compress.confirm": "\u538B\u7F29",
  "menu.edit": "\u7F16\u8F91",
  "edit.title": "\u7F16\u8F91\u6587\u4EF6",
  "edit.editing": "\u7F16\u8F91",
  "edit.preview": "\u9884\u89C8",
  "edit.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "edit.format": "\u683C\u5F0F\u5316",
  "edit.formatUnsupported": "\u8BE5\u6587\u4EF6\u7C7B\u578B\u6682\u4E0D\u652F\u6301\u4E00\u952E\u683C\u5F0F\u5316",
  "edit.revert": "\u6062\u590D\u539F\u59CB",
  "edit.save": "\u4FDD\u5B58",
  "edit.cancel": "\u53D6\u6D88",
  "edit.saved": "\u5DF2\u4FDD\u5B58 {name}",
  "edit.formatted": "\u5DF2\u683C\u5F0F\u5316",
  "edit.dirtyWarning": "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u786E\u5B9A\u653E\u5F03\u5E76\u5173\u95ED\u5417\uFF1F",
  "edit.discard": "\u653E\u5F03\u4FEE\u6539",
  "edit.keepEditing": "\u7EE7\u7EED\u7F16\u8F91",
  "toast.cut": "\u5DF2\u526A\u5207 {count} \u9879\uFF0C\u53F3\u952E\u76EE\u5F55\u6216\u4F7F\u7528\u9876\u90E8\u300C\u7C98\u8D34\u300D\u6309\u94AE\u7C98\u8D34",
  "toast.copied": "\u5DF2\u590D\u5236 {count} \u9879\uFF0C\u53F3\u952E\u76EE\u5F55\u6216\u4F7F\u7528\u9876\u90E8\u300C\u7C98\u8D34\u300D\u6309\u94AE\u7C98\u8D34",
  "toast.pasted": "\u5DF2\u7C98\u8D34 {count} \u9879",
  "toast.moved": "\u5DF2\u79FB\u52A8 {count} \u9879",
  "toast.deleted": "\u5DF2\u5220\u9664 {count} \u9879",
  "toast.compressed": "\u5DF2\u538B\u7F29\u4E3A {name}",
  "toast.compressedSkipped": "\u5DF2\u538B\u7F29\u4E3A {name}\uFF08\u8DF3\u8FC7 {skipped} \u9879\uFF09",
  "toast.pathCopied": "\u8DEF\u5F84\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F",
  "toast.clipboardFailed": "\u590D\u5236\u5230\u526A\u8D34\u677F\u5931\u8D25",
  "toast.dismiss": "\u5173\u95ED"
};
var en = {
  "menu.paste": "Paste",
  "menu.pasteN": "Paste {count} items",
  "menu.cut": "Cut",
  "menu.cutN": "Cut {count} items",
  "menu.copy": "Copy",
  "menu.copyN": "Copy {count} items",
  "menu.copyPath": "Copy path",
  "menu.copyPathN": "Copy {count} paths",
  "menu.compress": "Compress to ZIP",
  "menu.compressN": "Compress {count} items to ZIP",
  "menu.delete": "Delete",
  "menu.deleteN": "Delete {count} items",
  "menu.clearSelection": "Clear selection",
  "menu.hint": "Hold \u2318/Ctrl and click to multi-select",
  "delete.title": "Delete files",
  "delete.description": "These {count} items will be permanently removed. This cannot be undone:\n{preview}",
  "delete.acknowledge": "I understand this cannot be undone",
  "delete.cancel": "Cancel",
  "delete.confirm": "Delete",
  "compress.title": "Compress to ZIP",
  "compress.description": "Archive file name (editable):",
  "compress.cancel": "Cancel",
  "compress.confirm": "Compress",
  "menu.edit": "Edit",
  "edit.title": "Edit file",
  "edit.editing": "Edit",
  "edit.preview": "Preview",
  "edit.loading": "Loading\u2026",
  "edit.format": "Format",
  "edit.formatUnsupported": "One-click formatting is not supported for this file type",
  "edit.revert": "Revert",
  "edit.save": "Save",
  "edit.cancel": "Cancel",
  "edit.saved": "Saved {name}",
  "edit.formatted": "Formatted",
  "edit.dirtyWarning": "You have unsaved changes. Discard them and close?",
  "edit.discard": "Discard changes",
  "edit.keepEditing": "Keep editing",
  "toast.cut": "Cut {count} items \u2014 right-click a directory or use the Paste button to paste",
  "toast.copied": "Copied {count} items \u2014 right-click a directory or use the Paste button to paste",
  "toast.pasted": "Pasted {count} items",
  "toast.moved": "Moved {count} items",
  "toast.deleted": "Deleted {count} items",
  "toast.compressed": "Compressed to {name}",
  "toast.compressedSkipped": "Compressed to {name} ({skipped} skipped)",
  "toast.pathCopied": "Path copied to clipboard",
  "toast.clipboardFailed": "Failed to write clipboard",
  "toast.dismiss": "Dismiss"
};
function format(text, params) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
var state = {
  clipboard: (
    /** @type {Clipboard | null} */
    null
  ),
  selection: (
    /** @type {Set<string>} */
    /* @__PURE__ */ new Set()
  ),
  menu: (
    /** @type {MenuState | null} */
    null
  ),
  deleteRequest: (
    /** @type {DeleteRequest | null} */
    null
  ),
  compressRequest: (
    /** @type {CompressRequest | null} */
    null
  ),
  editRequest: (
    /** @type {EditRequest | null} */
    null
  ),
  toasts: (
    /** @type {ToastItem[]} */
    []
  ),
  treeVisible: false
};
var listeners = /* @__PURE__ */ new Set();
var toastSeq = 0;
function notify() {
  for (const listener of listeners) listener();
}
function setState(patch) {
  const next = { ...state, ...patch };
  if (next.clipboard === state.clipboard && next.selection === state.selection && next.menu === state.menu && next.deleteRequest === state.deleteRequest && next.compressRequest === state.compressRequest && next.editRequest === state.editRequest && next.toasts === state.toasts && next.treeVisible === state.treeVisible) return;
  Object.assign(state, next);
  notify();
}
function readState() {
  return state;
}
function useStore(selector) {
  return (0, import_react.useSyncExternalStore)(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(state)
  );
}
function currentTree() {
  const trees = document.querySelectorAll('[data-files-state="tree"]');
  for (const tree of trees) {
    if (tree.getBoundingClientRect().width > 0) return (
      /** @type {HTMLElement} */
      tree
    );
  }
  return null;
}
function currentTreeRoot() {
  return currentTree()?.getAttribute("data-files-root") ?? null;
}
function syncSelectionMarks() {
  const selection = readState().selection;
  for (const row of document.querySelectorAll("[data-files-path][data-files-entry]")) {
    const path = row.getAttribute("data-files-path");
    if (path !== null && selection.has(path)) row.setAttribute("data-files-selected", "true");
    else row.removeAttribute("data-files-selected");
  }
}
function syncCutMarks() {
  const clipboard = readState().clipboard;
  const cutPaths = clipboard !== null && clipboard.mode === "cut" ? new Set(clipboard.paths) : null;
  for (const row of document.querySelectorAll("[data-files-path][data-files-entry]")) {
    const path = row.getAttribute("data-files-path");
    if (cutPaths !== null && path !== null && cutPaths.has(path)) row.setAttribute("data-files-cut", "true");
    else row.removeAttribute("data-files-cut");
  }
}
function dirnameOf(path) {
  const normalized = String(path).replace(/[/\\]+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return normalized.startsWith("/") ? "/" : normalized;
  return normalized.slice(0, index);
}
function basenameOf(path) {
  return String(path).replace(/[/\\]+$/, "").split("/").pop() ?? String(path);
}
async function api(operation, body) {
  const response = await fetch(`${API}/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    const error = new Error(payload.message ?? `HTTP ${response.status}`);
    error.code = payload.code;
    throw error;
  }
  return payload;
}
var t = (key, params) => format(key, params ?? {});
function pushToast(text, kind = "ok") {
  const item = { id: ++toastSeq, text, kind };
  setState({ toasts: [...state.toasts, item] });
  setTimeout(() => {
    setState({ toasts: state.toasts.filter((entry) => entry.id !== item.id) });
  }, 4200);
}
function dismissToast(id) {
  setState({ toasts: state.toasts.filter((entry) => entry.id !== id) });
}
function toggleSelect(path) {
  const next = new Set(state.selection);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  setState({ selection: next });
  syncSelectionMarks();
}
function clearSelection() {
  if (state.selection.size === 0) return;
  setState({ selection: /* @__PURE__ */ new Set() });
  syncSelectionMarks();
}
function setClipboard(clipboard) {
  setState({ clipboard });
  syncCutMarks();
}
function openMenu(menu) {
  setState({ menu });
}
function closeMenu() {
  if (state.menu === null) return;
  setState({ menu: null });
}
function requestDelete(request) {
  setState({ deleteRequest: request });
}
function settleDelete() {
  if (state.deleteRequest === null) return;
  setState({ deleteRequest: null });
}
function requestCompress(request) {
  setState({ compressRequest: request });
}
function settleCompress() {
  if (state.compressRequest === null) return;
  setState({ compressRequest: null });
}
function requestEdit(request) {
  setState({ editRequest: request });
}
function settleEdit() {
  if (state.editRequest === null) return;
  setState({ editRequest: null });
}
function openEdit(path, workspaceRoot = currentTreeRoot()) {
  if (workspaceRoot === null || path === null || path === "") return;
  requestEdit({ path, workspaceRoot });
}
function stagePaths(paths, mode, workspaceRoot = currentTreeRoot()) {
  if (workspaceRoot === null || paths.length === 0) return;
  setClipboard({ mode, paths: [...paths], workspaceRoot });
  clearSelection();
  pushToast(t(mode === "cut" ? "toast.cut" : "toast.copied", { count: paths.length }));
}
function copyPaths(paths) {
  void (0, import_dsh_client_ui_primitives.writeClipboard)(paths.join("\n")).then((ok) => {
    if (ok) clearSelection();
    pushToast(ok ? t("toast.pathCopied") : t("toast.clipboardFailed"), ok ? "ok" : "error");
  });
}
function pasteInto(destination, workspaceRoot) {
  const clipboard = state.clipboard;
  if (clipboard === null || destination === null || destination === "") return;
  const operation = clipboard.mode === "cut" ? "move" : "copy";
  api(operation, { workspaceRoot, sources: clipboard.paths, destination }).then(() => {
    pushToast(t(clipboard.mode === "cut" ? "toast.moved" : "toast.pasted", { count: clipboard.paths.length }));
    if (clipboard.mode === "cut") setClipboard(null);
  }).catch((error) => {
    pushToast(error.message, "error");
  });
}
function presetZipName(paths) {
  if (paths.length === 1) return `${basenameOf(paths[0])}.zip`;
  return "archive.zip";
}
function compressPaths(paths, workspaceRoot = currentTreeRoot()) {
  if (paths.length === 0 || workspaceRoot === null) return;
  requestCompress({ paths: [...paths], workspaceRoot, name: presetZipName(paths) });
}
function performCompress(request, rawName) {
  let name = String(rawName ?? "").trim();
  if (name === "") name = request.name;
  if (!/\.zip$/i.test(name)) name += ".zip";
  api("compress", {
    workspaceRoot: request.workspaceRoot,
    sources: request.paths,
    destination: dirnameOf(request.paths[0]),
    name
  }).then((payload) => {
    clearSelection();
    pushToast(payload.skipped > 0 ? t("toast.compressedSkipped", { name: payload.name, skipped: payload.skipped }) : t("toast.compressed", { name: payload.name }));
  }).catch((error) => {
    pushToast(error.message, "error");
  });
}
function deletePaths(paths, workspaceRoot = currentTreeRoot()) {
  if (workspaceRoot === null || paths.length === 0) return;
  requestDelete({ paths: [...paths], workspaceRoot });
}
function performDelete(request) {
  api("delete", { workspaceRoot: request.workspaceRoot, paths: request.paths }).then((payload) => {
    clearSelection();
    pushToast(t("toast.deleted", { count: payload.count }));
  }).catch((error) => {
    pushToast(error.message, "error");
  });
}
function itemLabel(key, keyN, count) {
  return count > 1 ? t(keyN, { count }) : t(key);
}
function ContextMenu() {
  const menu = useStore((s) => s.menu);
  const selection = useStore((s) => s.selection);
  const clipboard = useStore((s) => s.clipboard);
  if (menu === null) return null;
  const clickedSelected = menu.path !== null && selection.has(menu.path);
  const targets = clickedSelected ? [...selection] : menu.path !== null ? [menu.path] : [];
  const MENU_MARGIN = 12;
  const MENU_EST_WIDTH = 200;
  const MENU_EST_HEIGHT = 240;
  const side = menu.y + MENU_EST_HEIGHT <= window.innerHeight - MENU_MARGIN ? "bottom" : "top";
  const align = menu.x + MENU_EST_WIDTH <= window.innerWidth - MENU_MARGIN ? "start" : "end";
  const pasteTarget = menu.scope === "body" ? menu.workspaceRoot : menu.entry === "directory" ? menu.path : null;
  return (0, import_react.createElement)(
    "div",
    { "data-dfa-ui": "menu", style: { pointerEvents: "none" } },
    (0, import_react.createElement)(import_dsh_client_ui_primitives.Menu, {
      open: true,
      portal: true,
      compact: true,
      autoFocus: true,
      side,
      align,
      listClassName: "dfa-menu",
      onClose: closeMenu,
      getAnchorRect: () => ({
        left: menu.x,
        top: menu.y,
        right: menu.x,
        bottom: menu.y,
        width: 0,
        height: 0
      }),
      anchor: (0, import_react.createElement)("span", { style: { position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0 } }),
      children: [
        pasteTarget !== null && (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
          icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 14 }),
          disabled: clipboard === null,
          onSelect: () => {
            closeMenu();
            pasteInto(pasteTarget, menu.workspaceRoot);
          },
          children: clipboard === null ? t("menu.paste") : itemLabel("menu.paste", "menu.pasteN", clipboard.paths.length)
        }),
        menu.scope === "body" && selection.size > 0 && (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
          icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 }),
          onSelect: () => {
            closeMenu();
            clearSelection();
          },
          children: t("menu.clearSelection")
        }),
        menu.scope === "row" && (0, import_react.createElement)(import_react.Fragment, { children: [
          menu.entry === "file" && targets.length === 1 && (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              openEdit(targets[0], menu.workspaceRoot);
            },
            children: t("menu.edit")
          }),
          (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              stagePaths(targets, "cut", menu.workspaceRoot);
            },
            children: itemLabel("menu.cut", "menu.cutN", targets.length)
          }),
          (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              stagePaths(targets, "copy", menu.workspaceRoot);
            },
            children: itemLabel("menu.copy", "menu.copyN", targets.length)
          }),
          (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconLinkOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              copyPaths(targets);
            },
            children: itemLabel("menu.copyPath", "menu.copyPathN", targets.length)
          }),
          (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              compressPaths(targets, menu.workspaceRoot);
            },
            children: itemLabel("menu.compress", "menu.compressN", targets.length)
          }),
          (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, {
            danger: true,
            separatorBefore: true,
            icon: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
            onSelect: () => {
              closeMenu();
              deletePaths(targets, menu.workspaceRoot);
            },
            children: itemLabel("menu.delete", "menu.deleteN", targets.length)
          })
        ] })
      ]
    })
  );
}
function BatchBar() {
  const selection = useStore((s) => s.selection);
  const treeVisible = useStore((s) => s.treeVisible);
  if (!treeVisible || selection.size === 0) return null;
  const paths = [...selection];
  return (0, import_react.createElement)("div", { className: "dfa-bar", "data-dfa-ui": "bar", role: "toolbar", style: { pointerEvents: "auto" } }, [
    (0, import_react.createElement)("span", { className: "dfa-bar-count" }, t("menu.hint")),
    (0, import_react.createElement)("span", { className: "dfa-bar-divider" }),
    barButton(import_dsh_client_ui_primitives.IconEditOutlineRegular, itemLabel("menu.cut", "menu.cutN", paths.length), () => stagePaths(paths, "cut")),
    barButton(import_dsh_client_ui_primitives.IconCopyOutlineRegular, itemLabel("menu.copy", "menu.copyN", paths.length), () => stagePaths(paths, "copy")),
    barButton(import_dsh_client_ui_primitives.IconArchiveOutlineRegular, itemLabel("menu.compress", "menu.compressN", paths.length), () => compressPaths(paths)),
    barButton(import_dsh_client_ui_primitives.IconLinkOutlineRegular, itemLabel("menu.copyPath", "menu.copyPathN", paths.length), () => copyPaths(paths)),
    barButton(import_dsh_client_ui_primitives.IconTrashOutlineRegular, itemLabel("menu.delete", "menu.deleteN", paths.length), () => deletePaths(paths), true),
    barButton(import_dsh_client_ui_primitives.IconCloseOutlineRegular, t("menu.clearSelection"), clearSelection)
  ]);
}
function barButton(icon, label, onClick, danger = false) {
  return (0, import_react.createElement)("button", {
    type: "button",
    className: danger ? "dfa-bar-btn dfa-bar-danger" : "dfa-bar-btn",
    title: label,
    onClick,
    children: [(0, import_react.createElement)(icon, { size: 14 }), (0, import_react.createElement)("span", { className: "dfa-bar-label", children: label })]
  });
}
function DeleteConfirm() {
  const request = useStore((s) => s.deleteRequest);
  const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (request !== null) setAcknowledged(false);
  }, [request]);
  const paths = request?.paths ?? [];
  const preview = [...paths.slice(0, 3), ...paths.length > 3 ? [`\u2026 (${paths.length - 3})`] : []].map((path) => `\xB7 ${path}`).join("\n");
  return (0, import_react.createElement)(import_dsh_client_ui_primitives.RiskConfirmation, {
    open: request !== null,
    title: t("delete.title"),
    description: format(t("delete.description"), { count: paths.length, preview }),
    acknowledgeLabel: t("delete.acknowledge"),
    cancelLabel: t("delete.cancel"),
    confirmLabel: t("delete.confirm"),
    acknowledged,
    onAcknowledgedChange: setAcknowledged,
    onCancel: settleDelete,
    onConfirm: () => {
      const pending = request;
      settleDelete();
      if (pending !== null) performDelete(pending);
    }
  });
}
function CompressDialog() {
  const request = useStore((s) => s.compressRequest);
  const [name, setName] = (0, import_react.useState)("");
  const inputRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (request === null) return;
    setName(request.name);
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input !== null) {
        input.focus();
        input.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [request]);
  const confirm = () => {
    const pending = request;
    settleCompress();
    if (pending !== null) performCompress(pending, name);
  };
  return (0, import_react.createElement)(import_dsh_client_ui_primitives.Modal, {
    open: request !== null,
    title: t("compress.title"),
    onClose: settleCompress,
    footer: (0, import_react.createElement)(import_react.Fragment, { children: [
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: settleCompress, children: t("compress.cancel") }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "primary", disabled: name.trim() === "", onClick: confirm, children: t("compress.confirm") })
    ] }),
    children: (0, import_react.createElement)("div", { className: "dfa-compress" }, [
      (0, import_react.createElement)("p", { className: "dfa-compress-desc", children: t("compress.description") }),
      (0, import_react.createElement)("input", {
        ref: inputRef,
        className: "dfa-compress-input",
        type: "text",
        value: name,
        spellCheck: false,
        onChange: (event) => setName(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key === "Enter" && name.trim() !== "") {
            event.preventDefault();
            confirm();
          }
        }
      })
    ])
  });
}
function applyIndent(content, textarea, delta) {
  const start = textarea.selectionStart ?? content.length;
  const end = textarea.selectionEnd ?? start;
  if (start === end) {
    const next2 = content.slice(0, start) + "  " + content.slice(end);
    queueMicrotask(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    });
    return next2;
  }
  const lineStart = content.lastIndexOf("\n", start - 1) + 1;
  const rawEnd = content.indexOf("\n", end - 1);
  const blockEnd = rawEnd === -1 ? content.length : rawEnd;
  const block = content.slice(lineStart, blockEnd);
  const shifted = delta > 0 ? block.replace(/^/gm, "  ") : block.replace(/^ {1,2}/gm, "");
  const next = content.slice(0, lineStart) + shifted + content.slice(blockEnd);
  queueMicrotask(() => {
    textarea.selectionStart = start + (start > lineStart ? delta : 0);
    textarea.selectionEnd = start + (start > lineStart ? delta : 0) + shifted.length - (start === lineStart ? 0 : block.length - (end - start));
  });
  return next;
}
function EditDialog() {
  const request = useStore((s) => s.editRequest);
  const [content, setContent] = (0, import_react.useState)("");
  const [original, setOriginal] = (0, import_react.useState)("");
  const [loaded, setLoaded] = (0, import_react.useState)(false);
  const [view, setView] = (0, import_react.useState)("edit");
  const [confirmingClose, setConfirmingClose] = (0, import_react.useState)(false);
  const [saving, setSaving] = (0, import_react.useState)(false);
  const textareaRef = (0, import_react.useRef)(null);
  const gutterRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (request === null) return;
    setContent("");
    setOriginal("");
    setLoaded(false);
    setView("edit");
    setConfirmingClose(false);
    api("read", { workspaceRoot: request.workspaceRoot, path: request.path }).then((payload) => {
      setContent(payload.content);
      setOriginal(payload.content);
      setLoaded(true);
    }).catch((error) => {
      pushToast(error.message, "error");
      settleEdit();
    });
  }, [request]);
  if (request === null) return null;
  const dirty = content !== original;
  const name = basenameOf(request.path);
  const lineCount = content.split("\n").length;
  const gutterText = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");
  const requestClose = () => {
    if (dirty && !confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    settleEdit();
  };
  const save = () => {
    if (!loaded || saving) return;
    setSaving(true);
    api("save", { workspaceRoot: request.workspaceRoot, path: request.path, content }).then((payload) => {
      setSaving(false);
      setOriginal(content);
      settleEdit();
      pushToast(t("edit.saved", { name }));
    }).catch((error) => {
      setSaving(false);
      pushToast(error.message, "error");
    });
  };
  const format2 = () => {
    if (!loaded) return;
    api("format", { workspaceRoot: request.workspaceRoot, path: request.path, content }).then((payload) => {
      setContent(payload.content);
      setView("edit");
      pushToast(t("edit.formatted"));
    }).catch((error) => {
      pushToast(error.message, "error");
    });
  };
  return (0, import_react.createElement)(import_dsh_client_ui_primitives.Modal, {
    open: true,
    title: `${t("edit.title")} \xB7 ${name}`,
    description: request.path,
    className: "dfa-edit-dialog",
    onClose: requestClose,
    footer: confirmingClose ? (0, import_react.createElement)(import_react.Fragment, { children: [
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: () => setConfirmingClose(false), children: t("edit.keepEditing") }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: settleEdit, children: t("edit.discard") })
    ] }) : (0, import_react.createElement)(import_react.Fragment, { children: [
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: requestClose, children: t("edit.cancel") }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: !loaded || !dirty, onClick: () => setContent(original), children: t("edit.revert") }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: !loaded, onClick: format2, children: t("edit.format") }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "primary", disabled: !loaded || !dirty || saving, onClick: save, children: t("edit.save") })
    ] }),
    children: confirmingClose ? (0, import_react.createElement)("div", { className: "dfa-edit-dirty" }, [
      (0, import_react.createElement)(import_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 18, className: "dfa-edit-dirty-icon" }),
      (0, import_react.createElement)("p", { children: t("edit.dirtyWarning") })
    ]) : (0, import_react.createElement)(import_react.Fragment, { children: [
      (0, import_react.createElement)("div", { className: "dfa-edit-toolbar" }, [
        (0, import_react.createElement)("div", { className: "dfa-edit-toggle", role: "tablist" }, [
          toggleButton(view === "edit", t("edit.editing"), () => setView("edit")),
          toggleButton(view === "preview", t("edit.preview"), () => setView("preview"))
        ])
      ]),
      !loaded ? (0, import_react.createElement)("p", { className: "dfa-edit-loading", children: t("edit.loading") }) : view === "edit" ? (0, import_react.createElement)("div", { className: "dfa-edit-body" }, [
        (0, import_react.createElement)("div", { ref: gutterRef, className: "dfa-edit-gutter", "aria-hidden": "true", children: gutterText }),
        (0, import_react.createElement)("textarea", {
          ref: textareaRef,
          className: "dfa-edit-textarea",
          value: content,
          spellCheck: false,
          wrap: "off",
          onChange: (event) => setContent(event.currentTarget.value),
          onScroll: (event) => {
            const gutter = gutterRef.current;
            if (gutter !== null) gutter.scrollTop = event.currentTarget.scrollTop;
          },
          onKeyDown: (event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              const el = event.currentTarget;
              setContent(applyIndent(content, el, event.shiftKey ? -2 : 2));
              return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              save();
            }
          }
        })
      ]) : (0, import_react.createElement)(
        "div",
        { className: "dfa-edit-preview" },
        (0, import_react.createElement)(import_dsh_client_ui_primitives.CodeBlock, { code: content, lang: (0, import_dsh_client_ui_primitives.languageForPath)(request.path) ?? "plaintext", lineNumbers: true, showHeader: false, wrap: true })
      )
    ] })
  });
}
function toggleButton(active, label, onClick) {
  return (0, import_react.createElement)("button", {
    type: "button",
    role: "tab",
    "aria-selected": active,
    className: active ? "dfa-edit-toggle-btn dfa-edit-toggle-active" : "dfa-edit-toggle-btn",
    onClick,
    children: label
  });
}
function ToastStack() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (0, import_react.createElement)(
    "div",
    { className: "dfa-toasts", "data-dfa-ui": "toasts", role: "status", style: { pointerEvents: "auto" } },
    [...toasts].reverse().map(
      (toast) => (0, import_react.createElement)("div", { key: toast.id, className: toast.kind === "error" ? "dfa-toast dfa-toast-error" : "dfa-toast" }, [
        (0, import_react.createElement)(toast.kind === "error" ? import_dsh_client_ui_primitives.IconCloseCircleFillRegular : import_dsh_client_ui_primitives.IconCheckCircleFillRegular, { size: 16, className: "dfa-toast-icon" }),
        (0, import_react.createElement)("span", { className: "dfa-toast-text", children: toast.text }),
        (0, import_react.createElement)("button", { type: "button", className: "dfa-toast-close", "aria-label": t("toast.dismiss"), onClick: () => dismissToast(toast.id), children: (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 12 }) })
      ])
    )
  );
}
function PasteHeaderAction(props) {
  const clipboard = useStore((s) => s.clipboard);
  if (clipboard === null) return null;
  const root = String(props.absolutePath ?? "");
  return (0, import_react.createElement)("button", {
    type: "button",
    className: "dfa-header-btn",
    title: t("menu.paste"),
    onClick: () => pasteInto(root, root),
    children: [(0, import_react.createElement)(import_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 14 }), (0, import_react.createElement)("span", { children: t("menu.paste") })]
  });
}
var CSS = `
[data-files-path][data-files-entry][data-files-selected="true"] > button,
[data-files-path][data-files-entry][data-files-selected="true"] > button:hover {
	background: var(--dsw-alias-interactive-bg-hover);
	box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary);
}
[data-files-path][data-files-entry][data-files-selected="true"] > button::after {
	content: "\u2713";
	margin-left: auto;
	font-size: 12px;
	color: var(--dsw-alias-state-business-primary);
	flex: none;
}
[data-files-path][data-files-entry][data-files-cut="true"] > button {
	opacity: .55;
}
.dfa-menu {
	min-width: 168px;
}
.dfa-bar {
	position: fixed;
	left: 50%;
	bottom: 24px;
	transform: translateX(-50%);
	z-index: 60;
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 10px;
	border: .5px solid var(--dsw-alias-border-l3);
	border-radius: var(--dsw-radius-lg);
	background: var(--dsw-alias-bg-elevated, var(--dsw-specific-sidebar-fill));
	box-shadow: var(--dsw-shadow-card, 0 8px 24px rgb(0 0 0 / .18));
	color: var(--dsw-alias-label-primary);
	font-size: var(--dsh-content-font-size-secondary, 13px);
	max-width: min(720px, calc(100vw - 32px));
	flex-wrap: wrap;
	justify-content: center;
}
.dfa-bar-count {
	color: var(--dsw-alias-label-tertiary);
	font-size: 12px;
	padding: 0 6px;
	white-space: nowrap;
}
.dfa-bar-divider {
	width: 1px;
	height: 16px;
	background: var(--dsw-alias-border-l3);
	margin: 0 4px;
}
.dfa-bar-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: none;
	border-radius: var(--dsw-radius-sm);
	background: transparent;
	color: var(--dsw-alias-label-secondary);
	cursor: pointer;
	font: inherit;
	padding: 5px 8px;
	line-height: 1.4;
}
.dfa-bar-btn:hover {
	background: var(--dsw-alias-interactive-bg-hover);
	color: var(--dsw-alias-label-primary);
}
.dfa-bar-danger:not(:hover) {
	color: var(--dsw-alias-state-error-primary);
}
.dfa-header-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	width: auto;
	height: 28px;
	border: none;
	border-radius: var(--dsw-radius-sm);
	background: transparent;
	color: var(--dsw-alias-label-secondary);
	cursor: pointer;
	font: inherit;
	font-size: 13px;
	padding: 0 8px;
	line-height: 1;
}
.dfa-header-btn:hover {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
}
.dfa-header-btn svg {
	width: 15px;
	height: 15px;
}
.dfa-compress-desc {
	margin: 0 0 10px;
	color: var(--dsw-alias-label-secondary);
	font-size: 13px;
	line-height: 1.5;
}
.dfa-compress-input {
	box-sizing: border-box;
	width: 100%;
	height: 32px;
	padding: 0 10px;
	border: .5px solid var(--dsw-alias-border-l4);
	border-radius: var(--dsw-radius-md);
	background: transparent;
	color: var(--dsw-alias-label-primary);
	font: inherit;
	font-size: 13px;
	line-height: 1.5;
	outline: none;
}
.dfa-compress-input:focus {
	border-color: var(--dsw-alias-state-business-primary);
}
.dfa-edit-dialog {
	width: min(920px, calc(100vw - 64px));
	max-width: none;
}
.dfa-edit-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 10px;
}
.dfa-edit-toggle {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 2px;
	border: .5px solid var(--dsw-alias-border-l3);
	border-radius: var(--dsw-radius-md);
}
.dfa-edit-toggle-btn {
	border: none;
	background: transparent;
	color: var(--dsw-alias-label-secondary);
	cursor: pointer;
	font: inherit;
	font-size: 13px;
	padding: 3px 12px;
	border-radius: var(--dsw-radius-sm);
	line-height: 1.5;
}
.dfa-edit-toggle-btn:hover {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
}
.dfa-edit-toggle-active,
.dfa-edit-toggle-active:hover {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
}
.dfa-edit-loading {
	margin: 24px 0;
	color: var(--dsw-alias-label-tertiary);
	font-size: 13px;
	text-align: center;
}
.dfa-edit-body {
	display: flex;
	height: min(62vh, 560px);
	min-height: 220px;
	border: .5px solid var(--dsw-alias-border-l3);
	border-radius: var(--dsw-radius-md);
	overflow: hidden;
	background: var(--dsw-alias-bg-page, transparent);
}
.dfa-edit-gutter {
	flex: none;
	width: 44px;
	overflow: hidden;
	padding: 8px 6px 8px 0;
	box-sizing: border-box;
	text-align: right;
	color: var(--dsw-alias-label-caption);
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 12px;
	line-height: 1.6;
	user-select: none;
	white-space: pre;
	border-right: .5px solid var(--dsw-alias-border-l3);
}
.dfa-edit-textarea {
	flex: 1;
	min-width: 0;
	border: none;
	outline: none;
	resize: none;
	padding: 8px 12px;
	background: transparent;
	color: var(--dsw-alias-label-primary);
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 1.6;
	white-space: pre;
	overflow: auto;
	tab-size: 2;
}
.dfa-edit-preview {
	max-height: min(62vh, 560px);
	min-height: 220px;
	overflow: auto;
	border: .5px solid var(--dsw-alias-border-l3);
	border-radius: var(--dsw-radius-md);
}
.dfa-edit-dirty {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 4px 2px;
	color: var(--dsw-alias-label-primary);
}
.dfa-edit-dirty-icon {
	flex: none;
	margin-top: 2px;
	color: var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary));
}
.dfa-edit-dirty p {
	margin: 0;
	font-size: 13px;
	line-height: 1.6;
}
.dfa-toasts {
	position: fixed;
	right: 20px;
	bottom: 20px;
	z-index: 60;
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: flex-end;
}
.dfa-toast {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	max-width: 420px;
	padding: 8px 10px;
	border: .5px solid var(--dsw-alias-border-l3);
	border-radius: var(--dsw-radius-md);
	background: var(--dsw-alias-bg-elevated, var(--dsw-specific-sidebar-fill));
	box-shadow: var(--dsw-shadow-card, 0 8px 24px rgb(0 0 0 / .18));
	color: var(--dsw-alias-label-primary);
	font-size: var(--dsh-content-font-size-secondary, 13px);
	line-height: 1.5;
}
.dfa-toast-icon {
	flex: none;
	margin-top: 2px;
	color: var(--dsw-alias-state-success-primary);
}
.dfa-toast-error .dfa-toast-icon {
	color: var(--dsw-alias-state-error-primary);
}
.dfa-toast-text {
	overflow-wrap: anywhere;
	min-width: 0;
}
.dfa-toast-close {
	flex: none;
	border: none;
	background: transparent;
	color: var(--dsw-alias-label-tertiary);
	cursor: pointer;
	padding: 2px;
	border-radius: var(--dsw-radius-xs);
	line-height: 1;
}
.dfa-toast-close:hover {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
}
@media (prefers-reduced-motion: reduce) {
	.dfa-bar, .dfa-toast { box-shadow: none; }
}
`;
function injectStyles() {
  const tagId = "dsh-plugin-file-actions/client.css";
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-plugin-file-actions";
  tag.dataset.pluginCss = tagId;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
function apply(ctx) {
  injectStyles();
  t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "file-actions: dictionaries");
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-context-menu",
    locale: NS,
    inject: () => ({})
  }, ContextMenu));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-batch-bar",
    locale: NS,
    inject: () => ({})
  }, BatchBar));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-delete-confirm",
    locale: NS,
    inject: () => ({})
  }, DeleteConfirm));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-compress-dialog",
    locale: NS,
    inject: () => ({})
  }, CompressDialog));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-edit-dialog",
    locale: NS,
    inject: () => ({})
  }, EditDialog));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "file-actions-toasts",
    locale: NS,
    inject: () => ({})
  }, ToastStack));
  ctx.slots.inject("sidebar.right.tab.files.actions", () => ctx.slots.register({
    name: "sidebar.right.tab.files.actions",
    id: "file-actions-paste",
    order: 100,
    locale: NS,
    inject: () => ({})
  }, PasteHeaderAction));
  ctx.effect(() => {
    const onContextMenu = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(OWN_UI)) return;
      const tree = target.closest('[data-files-state="tree"]');
      if (tree === null) return;
      const row = target.closest("[data-files-path]");
      if (row !== null) {
        const entry = row.getAttribute("data-files-entry");
        if (entry !== "file" && entry !== "directory") return;
        const path = row.getAttribute("data-files-path");
        const workspaceRoot = tree.getAttribute("data-files-root");
        if (path === null || workspaceRoot === null) return;
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          toggleSelect(path);
          return;
        }
        event.preventDefault();
        openMenu({ x: event.clientX, y: event.clientY, path, entry, scope: "row", workspaceRoot });
        return;
      }
      if (target.closest("[data-files-body]")) {
        const workspaceRoot = tree.getAttribute("data-files-root");
        if (workspaceRoot === null) return;
        event.preventDefault();
        openMenu({ x: event.clientX, y: event.clientY, path: null, entry: null, scope: "body", workspaceRoot });
      }
    };
    const onClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(OWN_UI) || target.closest(import_dsh_client_ui_primitives.modalSelector)) return;
      if (event.ctrlKey || event.metaKey) {
        const row = target.closest("[data-files-path]");
        const tree = target.closest('[data-files-state="tree"]');
        if (row !== null && tree !== null) {
          const entry = row.getAttribute("data-files-entry");
          if (entry === "file" || entry === "directory") {
            const path = row.getAttribute("data-files-path");
            if (path !== null) {
              event.preventDefault();
              event.stopPropagation();
              toggleSelect(path);
              return;
            }
          }
        }
        return;
      }
      if (target.closest("[data-files-path]") !== null) {
        clearSelection();
        return;
      }
      if (target.closest('[data-files-state="tree"]') === null) clearSelection();
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape" && event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (editable) return;
      if (document.querySelector(import_dsh_client_ui_primitives.modalSelector) !== null) return;
      if (event.key === "Escape") {
        if (readState().menu === null) clearSelection();
        return;
      }
      const snapshot = readState();
      if (snapshot.selection.size > 0 && snapshot.treeVisible) {
        const root = currentTreeRoot();
        if (root !== null) {
          event.preventDefault();
          requestDelete({ paths: [...snapshot.selection], workspaceRoot: root });
        }
      }
    };
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    let scheduled = false;
    const observe = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const visible = currentTree() !== null;
        setState({ treeVisible: visible });
        if (!visible) {
          clearSelection();
          closeMenu();
          if (readState().clipboard !== null) setClipboard(null);
          return;
        }
        syncSelectionMarks();
        syncCutMarks();
        const clipboard = readState().clipboard;
        const root = currentTreeRoot();
        if (clipboard !== null && (root === null || root !== clipboard.workspaceRoot)) setClipboard(null);
      });
    };
    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true });
    observe();
    return () => {
      observer.disconnect();
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, "file-actions: global listeners");
}
var inject = ["slots", "locale"];

    return module.exports;
  }
});
