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
var sidebarRight = null;
var sidebarRightTabs = null;
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
  "edit.title": "\u7F16\u8F91",
  "edit.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "edit.format": "\u683C\u5F0F\u5316",
  "edit.revert": "\u6062\u590D\u539F\u59CB",
  "edit.save": "\u4FDD\u5B58",
  "edit.reload": "\u91CD\u65B0\u52A0\u8F7D",
  "edit.reloadConfirm": "\u91CD\u65B0\u52A0\u8F7D\u4F1A\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u7EE7\u7EED\uFF1F",
  "edit.confirm": "\u786E\u8BA4",
  "edit.saved": "\u5DF2\u4FDD\u5B58 {name}",
  "edit.formatted": "\u5DF2\u683C\u5F0F\u5316",
  "edit.closedUnsaved": "\u5DF2\u5173\u95ED\u672A\u4FDD\u5B58\u7684\u7F16\u8F91\uFF1A{name}",
  "edit.unavailable": "\u65E0\u6CD5\u89E3\u6790\u8BE5\u7F16\u8F91\u5730\u5740",
  "edit.unknownFormat": "\u8BE5\u6587\u4EF6\u7C7B\u578B\u6682\u4E0D\u652F\u6301\u4E00\u952E\u683C\u5F0F\u5316",
  "edit.findPlaceholder": "\u67E5\u627E",
  "edit.replacePlaceholder": "\u66FF\u6362\u4E3A",
  "edit.gotoPlaceholder": "\u884C\u53F7",
  "edit.prev": "\u4E0A\u4E00\u4E2A",
  "edit.next": "\u4E0B\u4E00\u4E2A",
  "edit.replaceOne": "\u66FF\u6362",
  "edit.replaceAll": "\u5168\u90E8\u66FF\u6362",
  "edit.goto": "\u8DF3\u8F6C",
  "edit.closeBar": "\u5173\u95ED",
  "edit.menuUndo": "\u64A4\u9500",
  "edit.menuRedo": "\u91CD\u505A",
  "edit.menuCut": "\u526A\u5207",
  "edit.menuCopy": "\u590D\u5236",
  "edit.menuPaste": "\u7C98\u8D34",
  "edit.menuSelectAll": "\u5168\u9009",
  "edit.menuFind": "\u641C\u7D22",
  "edit.menuReplace": "\u66FF\u6362",
  "edit.menuGoto": "\u8DF3\u8F6C\u5230\u884C",
  "edit.pasteFailed": "\u7C98\u8D34\u5931\u8D25\uFF1A\u65E0\u6CD5\u8BFB\u53D6\u526A\u8D34\u677F",
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
  "edit.title": "Edit",
  "edit.loading": "Loading\u2026",
  "edit.format": "Format",
  "edit.revert": "Revert",
  "edit.save": "Save",
  "edit.reload": "Reload",
  "edit.reloadConfirm": "Reloading discards unsaved changes. Continue?",
  "edit.confirm": "Confirm",
  "edit.saved": "Saved {name}",
  "edit.formatted": "Formatted",
  "edit.closedUnsaved": "Closed with unsaved changes: {name}",
  "edit.unavailable": "Cannot parse this editor address",
  "edit.unknownFormat": "One-click formatting is not supported for this file type",
  "edit.findPlaceholder": "Find",
  "edit.replacePlaceholder": "Replace with",
  "edit.gotoPlaceholder": "Line number",
  "edit.prev": "Previous",
  "edit.next": "Next",
  "edit.replaceOne": "Replace",
  "edit.replaceAll": "Replace all",
  "edit.goto": "Go to",
  "edit.closeBar": "Close",
  "edit.menuUndo": "Undo",
  "edit.menuRedo": "Redo",
  "edit.menuCut": "Cut",
  "edit.menuCopy": "Copy",
  "edit.menuPaste": "Paste",
  "edit.menuSelectAll": "Select all",
  "edit.menuFind": "Find",
  "edit.menuReplace": "Replace",
  "edit.menuGoto": "Go to line",
  "edit.pasteFailed": "Paste failed: cannot read the clipboard",
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
  if (next.clipboard === state.clipboard && next.selection === state.selection && next.menu === state.menu && next.deleteRequest === state.deleteRequest && next.compressRequest === state.compressRequest && next.toasts === state.toasts && next.treeVisible === state.treeVisible) return;
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
function openEdit(path, workspaceRoot = currentTreeRoot()) {
  if (workspaceRoot === null || path === null || path === "") return;
  if (sidebarRight === null) {
    pushToast(t("edit.unavailable"), "error");
    return;
  }
  try {
    sidebarRight.openResource(editAddress(workspaceRoot, path), { kind: EDIT_KIND });
  } catch (error) {
    pushToast(error.message, "error");
  }
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
var EDIT_KIND = "file-editor";
var EDIT_ID = "dsh-plugin-file-actions";
var EDIT_PREFIX = "dsh-resource://file-edit/";
function editAddress(workspaceRoot, path) {
  return `${EDIT_PREFIX}${encodeURIComponent(workspaceRoot)}/${encodeURIComponent(path)}`;
}
function parseEditAddress(address) {
  const rest = String(address).slice(EDIT_PREFIX.length);
  const sep = rest.indexOf("/");
  if (sep < 0) return null;
  try {
    return {
      workspaceRoot: decodeURIComponent(rest.slice(0, sep)),
      path: decodeURIComponent(rest.slice(sep + 1))
    };
  } catch {
    return null;
  }
}
function applyIndent(content, textarea, delta) {
  const start = textarea.selectionStart ?? content.length;
  const end = textarea.selectionEnd ?? start;
  if (start === end) {
    return {
      next: content.slice(0, start) + "  " + content.slice(end),
      selStart: start + 2,
      selEnd: start + 2
    };
  }
  const lineStart = content.lastIndexOf("\n", start - 1) + 1;
  const rawEnd = content.indexOf("\n", end - 1);
  const blockEnd = rawEnd === -1 ? content.length : rawEnd;
  const block = content.slice(lineStart, blockEnd);
  const lines = block.split("\n");
  const shifts = lines.map((line) => delta > 0 ? 2 : -Math.min(2, /^ */.exec(line)[0].length));
  const shifted = lines.map((line, i) => delta > 0 ? "  " + line : line.replace(/^ {1,2}/, "")).join("\n");
  const beforeStart = block.slice(0, start - lineStart);
  const beforeEnd = block.slice(0, end - lineStart);
  const lineA = (beforeStart.match(/\n/g) ?? []).length;
  const lineB = (beforeEnd.match(/\n/g) ?? []).length;
  const startAtLineStart = start === lineStart || content.charCodeAt(start - 1) === 10;
  const selStart = start + (startAtLineStart ? 0 : shifts[lineA]);
  let selEnd = start + (end - start);
  for (let i = lineA; i <= lineB; i++) selEnd += shifts[i];
  return { next: content.slice(0, lineStart) + shifted + content.slice(blockEnd), selStart, selEnd };
}
function setSelectionAfterCommit(element, start, end) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (element !== null) {
      element.setSelectionRange(start, end);
      element.focus();
    }
  }));
}
function findMatchesIn(text, query, caseSensitive) {
  const matches = [];
  if (query === "") return matches;
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  let from = 0;
  for (; ; ) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    matches.push({ start: at, end: at + query.length });
    from = at + query.length;
  }
  return matches;
}
function lineStartPos(content, lineIndex) {
  if (lineIndex <= 0) return 0;
  let pos = -1;
  for (let i = 0; i < lineIndex; i++) pos = content.indexOf("\n", pos + 1);
  return pos === -1 ? content.length : pos + 1;
}
function styledText(text, style) {
  return style !== null && style !== void 0 ? (0, import_react.createElement)("span", { style }, text) : text;
}
function markedToken(text, offset, marks, style) {
  const out = [];
  let cursor = 0;
  for (const mark of marks) {
    const s = mark.start - offset;
    const e = mark.end - offset;
    if (e <= 0 || s >= text.length) continue;
    const cs = Math.max(s, 0);
    const ce = Math.min(e, text.length);
    if (cs > cursor) out.push(styledText(text.slice(cursor, cs), style));
    out.push((0, import_react.createElement)("span", { className: mark.current ? "dfa-code-find dfa-code-find-current" : "dfa-code-find" }, text.slice(cs, ce)));
    cursor = ce;
  }
  if (cursor < text.length) out.push(styledText(text.slice(cursor), style));
  return out;
}
var EDIT_LINE_HEIGHT = 20;
var EDIT_PAD_TOP = 8;
var EDIT_PAD_LEFT = 12;
var MINIMAP_WIDTH = 80;
var EDIT_OVERSCAN_MIN = 20;
function renderLineTokens(lineTokens, lineStart, marks) {
  const nodes = [];
  let index = lineStart;
  for (const token of lineTokens) {
    nodes.push(...markedToken(token.text, index, marks, token.style));
    index += token.text.length;
  }
  return nodes;
}
function HighlightEditor({ content, language, onContent, onSave, onOpenFind, onOpenReplace, onOpenGoto, findText, caseSensitive, findIndex, inputRef, onContextMenu }) {
  const highlight = (0, import_dsh_client_ui_primitives.useCodeHighlighter)(language);
  const [scroll, setScroll] = (0, import_react.useState)({ left: 0, top: 0 });
  const [viewport, setViewport] = (0, import_react.useState)({ width: 0, height: 0 });
  const [colorVersion, setColorVersion] = (0, import_react.useState)(0);
  const minimapRef = (0, import_react.useRef)(null);
  const draggingRef = (0, import_react.useRef)(false);
  const colorCacheRef = (0, import_react.useRef)({ content: "", colors: [] });
  (0, import_react.useEffect)(() => {
    const el = inputRef.current;
    if (el === null) return;
    const measure = () => {
      const h2 = el.clientHeight;
      setViewport((current) => Math.abs(current.height - h2) > 1 || Math.abs(current.width - el.clientWidth) > 1 ? { width: el.clientWidth, height: h2 } : current);
    };
    const onScrollNative = () => {
      measure();
      setScroll((current) => current.left === el.scrollLeft && current.top === el.scrollTop ? current : { left: el.scrollLeft, top: el.scrollTop });
    };
    el.addEventListener("scroll", onScrollNative, { passive: true });
    window.addEventListener("resize", measure);
    let frames = 0;
    const tick = () => {
      measure();
      frames += 1;
      if (frames < 3) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("scroll", onScrollNative);
      window.removeEventListener("resize", measure);
    };
  }, []);
  const [highlightContent, setHighlightContent] = (0, import_react.useState)(content);
  (0, import_react.useEffect)(() => {
    const timer = setTimeout(() => setHighlightContent(content), 120);
    return () => clearTimeout(timer);
  }, [content]);
  const lineStarts = (0, import_react.useMemo)(() => {
    const starts = [0];
    for (let i = 0; ; ) {
      const nl = highlightContent.indexOf("\n", i);
      if (nl === -1) break;
      starts.push(nl + 1);
      i = nl + 1;
    }
    return starts;
  }, [highlightContent]);
  const lineCount = (() => {
    let count = 1;
    for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) count += 1;
    return count;
  })();
  const viewportH = Math.max(viewport.height, inputRef.current?.clientHeight ?? 0, 1);
  const scrollHeightTotal = EDIT_PAD_TOP + lineCount * EDIT_LINE_HEIGHT + 48;
  const scrollMax = Math.max(scrollHeightTotal - viewportH, 0);
  const indicatorHeight = Math.max(viewportH * viewportH / scrollHeightTotal, 24);
  const indicatorTop = scrollMax > 0 ? scroll.top / scrollMax * (viewportH - indicatorHeight) : 0;
  const scrollMinimapTo = (clientY) => {
    const el = inputRef.current;
    if (el === null || minimapRef.current === null) return;
    const rect = minimapRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;
    const liveH = Math.max(el.clientHeight, viewportH);
    const liveMax = Math.max(scrollHeightTotal - liveH, 0);
    const liveIndicator = Math.max(liveH * liveH / scrollHeightTotal, 24);
    const y = clientY - rect.top;
    const travel = Math.max(liveH - liveIndicator, 1);
    const target = (y - liveIndicator / 2) / travel * liveMax;
    el.scrollTop = Math.max(0, Math.min(target, liveMax));
  };
  const firstLine = Math.min(Math.floor(scroll.top / EDIT_LINE_HEIGHT), Math.max(lineCount - 1, 0));
  const lastLine = Math.min(lineCount - 1, firstLine + Math.ceil(viewportH / EDIT_LINE_HEIGHT) + 1);
  const overscan = Math.max(EDIT_OVERSCAN_MIN, Math.ceil(viewportH / EDIT_LINE_HEIGHT / 2));
  const renderFirst = Math.max(0, firstLine - overscan);
  const renderLast = Math.min(lineCount - 1, lastLine + overscan);
  const renderLines = [];
  for (let i = renderFirst; i <= renderLast; i++) renderLines.push(i);
  const tokens = (0, import_react.useMemo)(() => {
    if (highlight === void 0 || highlight === null) return null;
    const start = lineStarts[renderFirst] ?? 0;
    const end = (lineStarts[renderLast + 1] ?? highlightContent.length + 1) - 1;
    const slice = highlightContent.slice(start, Math.max(end, start));
    const lines = highlight(slice);
    return lines === void 0 ? null : { lines };
  }, [highlight, highlightContent, lineStarts, renderFirst, renderLast]);
  const marks = (0, import_react.useMemo)(() => {
    const matches = findMatchesIn(highlightContent, findText, caseSensitive);
    const current = Math.min(Math.max(findIndex, 0), matches.length - 1);
    return matches.map((match, i) => ({ ...match, current: i === current }));
  }, [highlightContent, findText, caseSensitive, findIndex]);
  (0, import_react.useEffect)(() => {
    const cache = colorCacheRef.current;
    if (cache.content !== highlightContent) {
      cache.content = highlightContent;
      cache.colors = new Array(lineStarts.length).fill("");
    }
    if (tokens !== null) {
      let changed = false;
      for (let vi = renderFirst; vi <= renderLast && vi < lineStarts.length; vi++) {
        const line = tokens.lines[vi - renderFirst];
        if (line !== void 0 && line !== null) {
          let color = "";
          for (const token of line) {
            if (token.style !== null && token.style !== void 0 && token.style.color) {
              color = token.style.color;
              break;
            }
          }
          if (cache.colors[vi] !== color) {
            cache.colors[vi] = color;
            changed = true;
          }
        }
      }
      if (changed) setColorVersion((version) => version + 1);
    }
  }, [tokens, renderFirst, renderLast, highlightContent, lineStarts]);
  const lineColors = colorCacheRef.current.colors;
  (0, import_react.useEffect)(() => {
    const canvas = minimapRef.current;
    if (canvas === null || viewportH <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(MINIMAP_WIDTH * dpr));
    canvas.height = Math.max(1, Math.round(viewportH * dpr));
    const draw = canvas.getContext("2d");
    if (draw === null) return;
    draw.scale(dpr, dpr);
    draw.clearRect(0, 0, MINIMAP_WIDTH, viewportH);
    const count = Math.max(lineStarts.length, 1);
    const perLine = Math.min(viewportH / count, 4);
    const fallback = (() => {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--dsw-alias-label-secondary").trim();
      return value === "" ? "#7a8699" : value;
    })();
    for (let i = 0; i < count; i++) {
      const color = lineColors[i];
      draw.fillStyle = color !== void 0 && color !== "" ? color : fallback;
      draw.fillRect(0, Math.floor(i * perLine), MINIMAP_WIDTH, Math.max(1, Math.ceil(perLine)));
    }
  }, [lineStarts.length, viewportH, colorVersion]);
  return (0, import_react.createElement)("div", { className: "dfa-code-editor" }, [
    (0, import_react.createElement)("div", { className: "dfa-code-gutter", "aria-hidden": "true" }, [
      (0, import_react.createElement)(
        "div",
        { className: "dfa-code-gutter-canvas", style: { height: EDIT_PAD_TOP + lineCount * EDIT_LINE_HEIGHT } },
        renderLines.map((i) => (0, import_react.createElement)("span", {
          key: i,
          className: "dfa-code-gutter-num",
          style: { top: EDIT_PAD_TOP + i * EDIT_LINE_HEIGHT },
          children: String(i + 1)
        }))
      )
    ]),
    (0, import_react.createElement)("div", { className: "dfa-code-viewport" }, [
      (0, import_react.createElement)("pre", {
        className: "dfa-code-highlight",
        "aria-hidden": "true",
        style: { height: EDIT_PAD_TOP + lineStarts.length * EDIT_LINE_HEIGHT + 48, transform: `translateX(${-scroll.left}px)` },
        children: renderLines.map((i) => {
          const lineTokens = tokens?.lines?.[i - renderFirst];
          const plain = highlightContent.slice(lineStarts[i] ?? 0, (lineStarts[i + 1] ?? highlightContent.length + 1) - 1);
          const line = lineTokens !== void 0 && lineTokens !== null ? renderLineTokens(lineTokens, lineStarts[i] ?? 0, marks) : renderLineTokens([{ text: plain, style: null }], lineStarts[i] ?? 0, marks);
          return (0, import_react.createElement)("span", {
            key: i,
            className: "dfa-code-line",
            style: { top: EDIT_PAD_TOP + i * EDIT_LINE_HEIGHT, left: EDIT_PAD_LEFT },
            children: line
          });
        })
      }),
      (0, import_react.createElement)("div", {
        className: "dfa-code-minimap",
        "aria-hidden": "true",
        onPointerDown: (event) => {
          event.preventDefault();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          scrollMinimapTo(event.clientY);
        },
        onPointerMove: (event) => {
          if (draggingRef.current) scrollMinimapTo(event.clientY);
        },
        onPointerUp: () => {
          draggingRef.current = false;
        },
        onPointerCancel: () => {
          draggingRef.current = false;
        }
      }, [
        (0, import_react.createElement)("canvas", { ref: minimapRef, className: "dfa-code-minimap-canvas" }),
        (0, import_react.createElement)("div", { className: "dfa-code-minimap-indicator", style: { top: indicatorTop, height: indicatorHeight } })
      ]),
      (0, import_react.createElement)("textarea", {
        ref: inputRef,
        className: "dfa-code-input",
        value: content,
        spellCheck: false,
        wrap: "off",
        onChange: (event) => onContent(event.currentTarget.value),
        onContextMenu,
        onKeyDown: (event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            const el = event.currentTarget;
            const { next, selStart, selEnd } = applyIndent(content, el, event.shiftKey ? -2 : 2);
            onContent(next);
            setSelectionAfterCommit(el, selStart, selEnd);
            return;
          }
          const mod = event.metaKey || event.ctrlKey;
          const key = event.key.toLowerCase();
          if (mod && key === "s") {
            event.preventDefault();
            onSave();
          } else if (mod && key === "f") {
            event.preventDefault();
            onOpenFind();
          } else if (mod && key === "h") {
            event.preventDefault();
            onOpenReplace();
          } else if (mod && key === "g") {
            event.preventDefault();
            onOpenGoto();
          }
        }
      })
    ])
  ]);
}
function EditorTab(props) {
  const translate = props.t ?? t;
  const { useTabInfo } = props;
  const { tab } = useTabInfo();
  const parsed = parseEditAddress(tab.contentId);
  const [content, setContent] = (0, import_react.useState)("");
  const [original, setOriginal] = (0, import_react.useState)("");
  const [loaded, setLoaded] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [confirmingReload, setConfirmingReload] = (0, import_react.useState)(false);
  const [bar, setBar] = (0, import_react.useState)(null);
  const [findText, setFindText] = (0, import_react.useState)("");
  const [replaceText, setReplaceText] = (0, import_react.useState)("");
  const [caseSensitive, setCaseSensitive] = (0, import_react.useState)(false);
  const [findIndex, setFindIndex] = (0, import_react.useState)(0);
  const [gotoText, setGotoText] = (0, import_react.useState)("");
  const [menuAt, setMenuAt] = (0, import_react.useState)(null);
  const inputRef = (0, import_react.useRef)(null);
  const dirtyRef = (0, import_react.useRef)(false);
  const dirty = content !== original;
  dirtyRef.current = dirty;
  const name = parsed === null ? "" : basenameOf(parsed.path);
  const matches = (0, import_react.useMemo)(() => findMatchesIn(content, findText, caseSensitive), [content, findText, caseSensitive]);
  const currentMatch = Math.min(Math.max(findIndex, 0), matches.length - 1);
  const focusEditor = () => {
    const el = inputRef.current;
    if (el !== null) {
      el.focus();
      el.blur();
      el.focus();
    }
  };
  const selectRange = (start, end) => {
    const el = inputRef.current;
    if (el === null) return;
    el.setSelectionRange(start, end);
    el.focus();
    el.blur();
    el.focus();
  };
  const openFind = () => setBar("find");
  const openReplace = () => setBar("replace");
  const openGoto = () => {
    setGotoText(String(matches.length > 0 && currentMatch >= 0 ? content.slice(0, matches[currentMatch].start).split("\n").length : ""));
    setBar("goto");
  };
  const closeBar = () => {
    setBar(null);
    focusEditor();
  };
  const findNext = (step = 1) => {
    if (matches.length === 0) return;
    const next = (currentMatch + step + matches.length) % matches.length;
    setFindIndex(next);
    selectRange(matches[next].start, matches[next].end);
  };
  const replaceOne = () => {
    const match = matches[currentMatch];
    if (match === void 0) return;
    const next = content.slice(0, match.start) + replaceText + content.slice(match.end);
    setContent(next);
    setFindIndex(currentMatch);
    setSelectionAfterCommit(inputRef.current, match.start, match.start + replaceText.length);
  };
  const replaceAll = () => {
    if (findText === "") return;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = caseSensitive ? "g" : "gi";
    setContent(content.replace(new RegExp(escaped, flags), replaceText.replace(/\$/g, "$$$$")));
  };
  const doGoto = () => {
    const line = Number.parseInt(String(gotoText).trim(), 10);
    if (!Number.isFinite(line) || line < 1) return;
    const index = Math.min(line, content.split("\n").length) - 1;
    const pos = lineStartPos(content, index);
    selectRange(pos, pos);
  };
  const load = () => {
    if (parsed === null) return;
    setLoaded(false);
    setError(null);
    setConfirmingReload(false);
    api("read", { workspaceRoot: parsed.workspaceRoot, path: parsed.path }).then((payload) => {
      setContent(payload.content);
      setOriginal(payload.content);
      setLoaded(true);
    }).catch((readError) => {
      setError(readError.message);
    });
  };
  (0, import_react.useEffect)(() => {
    load();
  }, [parsed?.workspaceRoot, parsed?.path]);
  (0, import_react.useEffect)(() => {
    tab.actions.bindCommands({ refresh: load });
  }, [tab.actions]);
  (0, import_react.useEffect)(() => () => {
    if (dirtyRef.current && name !== "") pushToast(translate("edit.closedUnsaved", { name }));
  }, []);
  const save = () => {
    if (parsed === null || !loaded || saving) return;
    setSaving(true);
    api("save", { workspaceRoot: parsed.workspaceRoot, path: parsed.path, content }).then(() => {
      setSaving(false);
      setOriginal(content);
      pushToast(translate("edit.saved", { name }));
    }).catch((saveError) => {
      setSaving(false);
      pushToast(saveError.message, "error");
    });
  };
  const format2 = () => {
    if (parsed === null || !loaded) return;
    api("format", { workspaceRoot: parsed.workspaceRoot, path: parsed.path, content }).then((payload) => {
      setContent(payload.content);
      pushToast(translate("edit.formatted"));
    }).catch((formatError) => {
      pushToast(formatError.message, "error");
    });
  };
  const runCommand = (command) => {
    focusEditor();
    try {
      document.execCommand(command);
    } catch {
    }
  };
  const pasteFromClipboard = () => {
    const el = inputRef.current;
    if (el === null) return;
    void navigator.clipboard.readText().then((text) => {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      setContent(content.slice(0, start) + text + content.slice(end));
      setSelectionAfterCommit(el, start + text.length, start + text.length);
    }).catch(() => {
      pushToast(translate("edit.pasteFailed"), "error");
    });
  };
  if (parsed === null) return (0, import_react.createElement)(
    "div",
    { className: "dfa-editor-status" },
    (0, import_react.createElement)("p", { className: "dfa-editor-status-line", children: translate("edit.unavailable") })
  );
  const language = (0, import_dsh_client_ui_primitives.languageForPath)(parsed.path) ?? "plaintext";
  const menuSide = menuAt === null || menuAt.y < window.innerHeight * 0.6 ? "bottom" : "top";
  const menuAlign = menuAt === null || menuAt.x + 200 <= window.innerWidth - 12 ? "start" : "end";
  return (0, import_react.createElement)("div", { className: "dfa-editor-root", "data-dfa-ui": "editor" }, [
    (0, import_react.createElement)("div", { className: "dfa-editor-header" }, [
      (0, import_react.createElement)("span", { className: "dfa-editor-name", title: parsed.path, children: name }),
      dirty && (0, import_react.createElement)("span", { className: "dfa-editor-dirty", children: "\u2022" }),
      (0, import_react.createElement)("span", { className: "dfa-editor-spacer" }),
      confirmingReload ? (0, import_react.createElement)(import_react.Fragment, { children: [
        (0, import_react.createElement)("span", { className: "dfa-editor-confirm", children: translate("edit.reloadConfirm") }),
        editorButton(translate("edit.confirm"), load),
        editorButton(translate("edit.revert"), () => setConfirmingReload(false))
      ] }) : (0, import_react.createElement)(import_react.Fragment, { children: [
        editorButton(translate("edit.reload"), () => {
          if (dirty) setConfirmingReload(true);
          else load();
        }, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })),
        editorButton(translate("edit.format"), format2, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }), !loaded),
        editorButton(translate("edit.revert"), () => setContent(original), (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 }), !loaded || !dirty),
        editorButton(translate("edit.save"), save, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 }), !loaded || !dirty || saving, true)
      ] })
    ]),
    bar !== null && (0, import_react.createElement)("div", { className: "dfa-editor-bar" }, [
      bar !== "goto" && (0, import_react.createElement)(import_react.Fragment, { children: [
        (0, import_react.createElement)("input", {
          className: "dfa-editor-bar-input",
          type: "text",
          placeholder: translate("edit.findPlaceholder"),
          value: findText,
          autoFocus: true,
          onChange: (event) => {
            setFindText(event.currentTarget.value);
            setFindIndex(0);
          },
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              findNext(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeBar();
            }
          }
        }),
        (0, import_react.createElement)("span", { className: "dfa-editor-bar-count", children: findText === "" ? "" : matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "0" }),
        editorButton(translate("edit.prev"), () => findNext(-1), null, matches.length === 0),
        editorButton(translate("edit.next"), () => findNext(1), null, matches.length === 0),
        editorButton(caseSensitive ? "Aa" : "aa", () => setCaseSensitive(!caseSensitive), null, false)
      ] }),
      bar === "replace" && (0, import_react.createElement)(import_react.Fragment, { children: [
        (0, import_react.createElement)("input", {
          className: "dfa-editor-bar-input",
          type: "text",
          placeholder: translate("edit.replacePlaceholder"),
          value: replaceText,
          onChange: (event) => setReplaceText(event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              replaceOne();
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeBar();
            }
          }
        }),
        editorButton(translate("edit.replaceOne"), replaceOne, null, matches.length === 0),
        editorButton(translate("edit.replaceAll"), replaceAll, null, findText === "")
      ] }),
      bar === "goto" && (0, import_react.createElement)(import_react.Fragment, { children: [
        (0, import_react.createElement)("input", {
          className: "dfa-editor-bar-input dfa-editor-bar-goto",
          type: "number",
          min: 1,
          placeholder: translate("edit.gotoPlaceholder"),
          value: gotoText,
          autoFocus: true,
          onChange: (event) => setGotoText(event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              doGoto();
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeBar();
            }
          }
        }),
        editorButton(translate("edit.goto"), doGoto)
      ] }),
      editorButton(translate("edit.closeBar"), closeBar, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 }))
    ]),
    !loaded && error === null ? (0, import_react.createElement)(
      "div",
      { className: "dfa-editor-status" },
      (0, import_react.createElement)("p", { className: "dfa-editor-status-line", children: translate("edit.loading") })
    ) : error !== null ? (0, import_react.createElement)("div", { className: "dfa-editor-status" }, [
      (0, import_react.createElement)("p", { className: "dfa-editor-status-line", children: error }),
      (0, import_react.createElement)("button", { type: "button", className: "dfa-editor-retry", onClick: load, children: translate("edit.reload") })
    ]) : (0, import_react.createElement)(HighlightEditor, {
      content,
      language,
      onContent: setContent,
      onSave: save,
      onOpenFind: openFind,
      onOpenReplace: openReplace,
      onOpenGoto: openGoto,
      findText,
      caseSensitive,
      findIndex: currentMatch,
      inputRef,
      onContextMenu: (event) => {
        event.preventDefault();
        setMenuAt({ x: event.clientX, y: event.clientY });
      }
    }),
    menuAt !== null && (0, import_react.createElement)(import_dsh_client_ui_primitives.Menu, {
      open: true,
      portal: true,
      compact: true,
      autoFocus: true,
      side: menuSide,
      align: menuAlign,
      listClassName: "dfa-menu",
      onClose: () => setMenuAt(null),
      getAnchorRect: () => ({ left: menuAt.x, top: menuAt.y, right: menuAt.x, bottom: menuAt.y, width: 0, height: 0 }),
      anchor: (0, import_react.createElement)("span", { style: { position: "fixed", left: menuAt.x, top: menuAt.y, width: 0, height: 0 } }),
      children: [
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: () => runCommand("undo"), children: translate("edit.menuUndo") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: () => runCommand("redo"), children: translate("edit.menuRedo") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { separatorBefore: true, onSelect: () => runCommand("cut"), children: translate("edit.menuCut") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: () => runCommand("copy"), children: translate("edit.menuCopy") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: pasteFromClipboard, children: translate("edit.menuPaste") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: () => {
          const el = inputRef.current;
          if (el !== null) {
            el.focus();
            el.select();
          }
        }, children: translate("edit.menuSelectAll") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { separatorBefore: true, onSelect: openFind, children: translate("edit.menuFind") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: openReplace, children: translate("edit.menuReplace") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: openGoto, children: translate("edit.menuGoto") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { separatorBefore: true, onSelect: format2, children: translate("edit.format") }),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.MenuItemButton, { onSelect: save, disabled: !loaded || !dirty, children: translate("edit.save") })
      ]
    })
  ]);
}
function editorButton(label, onClick, icon = null, disabled = false, primary = false) {
  return (0, import_react.createElement)("button", {
    type: "button",
    className: primary ? "dfa-editor-btn dfa-editor-btn-primary" : "dfa-editor-btn",
    disabled,
    onClick,
    title: typeof label === "string" ? label : void 0,
    children: [icon, label].filter(Boolean)
  });
}
function EditorTabTitle({ useTabInfo }) {
  const { tab } = useTabInfo();
  return (0, import_react.createElement)(import_react.Fragment, { children: [
    (0, import_react.createElement)(import_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14, className: "dfa-tab-title-icon" }),
    (0, import_react.createElement)("span", { children: tab.title })
  ] });
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
.dfa-editor-root {
	flex-direction: column;
	flex: auto;
	height: 100%;
	min-height: 0;
	display: flex;
	background: var(--dsw-alias-bg-page, transparent);
}
.dfa-editor-header {
	box-sizing: border-box;
	border-bottom: .5px solid var(--dsw-alias-border-l3);
	flex: none;
	align-items: center;
	gap: 6px;
	height: 38px;
	padding: 0 6px 0 14px;
	display: flex;
	min-width: 0;
}
.dfa-editor-name {
	white-space: nowrap;
	text-overflow: ellipsis;
	min-width: 0;
	overflow: hidden;
	color: var(--dsw-alias-label-primary);
	font-size: var(--dsh-content-font-size-secondary, 13px);
}
.dfa-editor-dirty {
	color: var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary));
	font-size: 14px;
	flex: none;
	line-height: 1;
}
.dfa-editor-note {
	color: var(--dsw-alias-label-tertiary);
	font-size: 12px;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
	max-width: 40%;
	flex: none;
}
.dfa-editor-spacer {
	flex: auto;
}
.dfa-editor-confirm {
	color: var(--dsw-alias-label-secondary);
	font-size: 12px;
	white-space: nowrap;
}
.dfa-editor-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
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
	white-space: nowrap;
}
.dfa-editor-btn:hover:not(:disabled) {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
}
.dfa-editor-btn:disabled {
	color: var(--dsw-alias-label-caption);
	cursor: default;
}
.dfa-editor-btn svg {
	width: 14px;
	height: 14px;
	flex: none;
}
.dfa-editor-btn-primary {
	background: var(--dsw-alias-state-business-primary);
	color: var(--dsw-alias-text-on-business, #fff);
}
.dfa-editor-btn-primary:hover:not(:disabled) {
	background: var(--dsw-alias-state-business-hover, var(--dsw-alias-state-business-primary));
	color: var(--dsw-alias-text-on-business, #fff);
}
.dfa-editor-btn-primary:disabled {
	background: var(--dsw-alias-interactive-bg-hover);
	color: var(--dsw-alias-label-caption);
}
.dfa-editor-status {
	box-sizing: border-box;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 10px;
	height: 100%;
	padding: 12px 10px;
	display: flex;
}
.dfa-editor-status-line {
	color: var(--dsw-alias-label-secondary);
	font-size: var(--dsh-content-font-size-secondary, 13px);
	margin: 0;
	line-height: 1.6;
	text-align: center;
	overflow-wrap: anywhere;
}
.dfa-editor-retry {
	height: 32px;
	color: var(--dsw-alias-label-primary);
	font-size: var(--dsh-content-font-size-secondary, 13px);
	border: .5px solid var(--dsw-alias-border-l2);
	border-radius: var(--dsw-radius-md);
	cursor: pointer;
	background: transparent;
	flex: none;
	align-items: center;
	gap: 6px;
	padding: 0 14px 0 12px;
	font-family: inherit;
	display: inline-flex;
}
.dfa-editor-retry:hover {
	background: var(--dsw-alias-interactive-bg-hover);
}
.dfa-tab-title-icon {
	flex: none;
	color: var(--dsw-alias-label-secondary);
}
.dfa-code-editor {
	display: flex;
	flex: 1;
	min-height: 0;
	border-top: none;
	overflow: hidden;
}
.dfa-code-gutter {
	flex: none;
	width: 44px;
	overflow: hidden;
	position: relative;
	box-sizing: border-box;
	border-right: .5px solid var(--dsw-alias-border-l3);
	background: var(--dsw-alias-bg-layer-1, transparent);
}
.dfa-code-gutter-canvas {
	position: relative;
}
.dfa-code-gutter-num {
	position: absolute;
	right: 6px;
	color: var(--dsw-alias-label-caption);
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 20px;
	user-select: none;
	white-space: pre;
}
.dfa-code-viewport {
	flex: 1;
	min-width: 0;
	min-height: 0;
	position: relative;
	overflow: hidden;
}
.dfa-code-highlight {
	position: absolute;
	top: 0;
	left: 0;
	min-width: 100%;
	margin: 0;
	padding: 0;
	border: 0;
	pointer-events: none;
	color: var(--dsw-alias-label-primary);
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 20px;
	letter-spacing: normal;
}
.dfa-code-line {
	position: absolute;
	white-space: pre;
	line-height: 20px;
}
.dfa-code-input {
	position: absolute;
	left: 0;
	top: 0;
	right: 80px;
	bottom: 0;
	width: auto;
	height: 100%;
	box-sizing: border-box;
	resize: none;
	overflow: auto;
	outline: none;
	background: transparent;
	color: transparent;
	-webkit-text-fill-color: transparent;
	caret-color: var(--dsw-alias-label-primary);
	margin: 0;
	padding: 8px 12px 48px;
	border: 0;
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 20px;
	letter-spacing: normal;
	white-space: pre;
	tab-size: 2;
	word-break: normal;
	overflow-wrap: normal;
}
.dfa-code-input::selection {
	background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent);
}
.dfa-code-input::placeholder {
	color: var(--dsw-alias-label-caption);
	-webkit-text-fill-color: var(--dsw-alias-label-caption);
}
.dfa-code-input::-webkit-scrollbar {
	width: 0;
	height: 12px;
}
.dfa-code-input {
	scrollbar-width: thin;
}
.dfa-code-minimap {
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	width: 80px;
	overflow: hidden;
	border-left: .5px solid var(--dsw-alias-border-l3);
	background: var(--dsw-alias-bg-page, var(--dsw-alias-bg-layer-1, transparent));
	cursor: pointer;
	user-select: none;
}
.dfa-code-minimap-canvas {
	position: absolute;
	top: 0;
	left: 0;
	width: 80px;
	height: 100%;
	pointer-events: none;
}
.dfa-code-minimap-indicator {
	position: absolute;
	left: 0;
	width: 100%;
	box-sizing: border-box;
	background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 16%, transparent);
	border-left: 1px solid var(--dsw-alias-state-business-primary);
	pointer-events: none;
}
.dfa-code-find {
	background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary)) 35%, transparent);
	border-radius: 2px;
	outline: 1px solid color-mix(in srgb, var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary)) 55%, transparent);
}
.dfa-code-find-current {
	background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary)) 65%, transparent);
	outline-color: var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary));
}
.dfa-editor-bar {
	box-sizing: border-box;
	border-bottom: .5px solid var(--dsw-alias-border-l3);
	flex: none;
	align-items: center;
	gap: 4px;
	min-height: 36px;
	padding: 4px 8px 4px 14px;
	display: flex;
	flex-wrap: wrap;
	background: var(--dsw-alias-bg-layer-1, transparent);
}
.dfa-editor-bar-input {
	box-sizing: border-box;
	height: 26px;
	min-width: 120px;
	flex: 1 1 160px;
	max-width: 320px;
	border: .5px solid var(--dsw-alias-border-l4);
	border-radius: var(--dsw-radius-sm);
	background: transparent;
	color: var(--dsw-alias-label-primary);
	font: inherit;
	font-size: 13px;
	padding: 0 8px;
	outline: none;
}
.dfa-editor-bar-input:focus {
	border-color: var(--dsw-alias-state-business-primary);
}
.dfa-editor-bar-goto {
	flex: 0 1 90px;
	min-width: 60px;
}
.dfa-editor-bar-count {
	color: var(--dsw-alias-label-tertiary);
	font-size: 12px;
	white-space: nowrap;
	padding: 0 4px;
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
  sidebarRight = ctx.sidebarRight;
  sidebarRightTabs = ctx.sidebarRightTabs;
  ctx.effect(() => sidebarRightTabs.register({
    id: EDIT_ID,
    kind: EDIT_KIND,
    patterns: ["dsh-resource://file-edit/**"],
    priority: "fallback",
    canOpen: (address) => String(address).startsWith(EDIT_PREFIX),
    title: (address) => parseEditAddress(address)?.path !== void 0 ? basenameOf(parseEditAddress(address).path) : "Edit"
  }), "file-actions: editor tab type");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: EDIT_ID,
    locale: NS,
    inject: () => ({})
  }, EditorTab)), "file-actions: editor tab body");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: EDIT_ID,
    locale: NS,
    inject: () => ({})
  }, EditorTabTitle)), "file-actions: editor tab title");
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
var inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];

    return module.exports;
  }
});
