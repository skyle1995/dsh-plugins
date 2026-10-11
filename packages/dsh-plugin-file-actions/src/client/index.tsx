/**
 * dsh-plugin-file-actions 浏览器半区：文件列表（右侧 files 标签页）增强。
 *
 * - 右键菜单：剪切 / 复制 / 粘贴 / 复制路径 / 压缩 / 删除（删除需确认）；
 * - Ctrl/Cmd+点击 多选，选中行高亮；批量操作栏（剪切/复制/压缩/删除/
 *   复制路径/取消）悬浮在窗口底部；Delete 键直接进入删除确认；
 * - 文件树顶部（sidebar.right.tab.files.actions 官方槽位）追加「粘贴」按钮；
 * - 剪贴板为模块级内存缓冲（剪切项半透明标记，粘贴成功后清空）；切换
 *   工作区自动清空；
 * - 全部操作走宿主半区 /api/dsh-file-actions 路由，成功/失败均有 Toast。
 *
 * 行 DOM（官方 sidebar-files 渲染）：
 *   <li data-files-entry="file|directory|other" data-files-path="<绝对路径>">
 *   <div data-files-state="tree" data-files-root="<工作区根>"> 为树根。
 */
import { createElement as h, Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
	IconArchiveOutlineRegular,
	IconCheckCircleFillRegular,
	IconCloseCircleFillRegular,
	IconCloseOutlineRegular,
	IconCopyOutlineRegular,
	IconEditOutlineRegular,
	IconFolderOpenOutlineRegular,
	IconLinkOutlineRegular,
	IconTrashOutlineRegular,
	IconWarningOutlineRegular,
	IconCheckOutlineRegular,
	IconRefreshOutlineRegular,
	useCodeHighlighter,
	languageForPath,
	Menu,
	MenuItemButton,
	Modal,
	Button,
	RiskConfirmation,
	modalSelector,
	writeClipboard,
} from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-file-actions";
const API = "/api/dsh-file-actions";
/** 右侧栏控制器与 tab 类型注册表（apply 时注入）。 */
let sidebarRight = null;
let sidebarRightTabs = null;
/** 我们自己的 DOM 标记：全局监听器据此跳过自身 UI。 */
const OWN_UI = "[data-dfa-ui], .dfa-menu";

const zh = {
	"menu.paste": "粘贴",
	"menu.pasteN": "粘贴 {count} 项",
	"menu.cut": "剪切",
	"menu.cutN": "剪切 {count} 项",
	"menu.copy": "复制",
	"menu.copyN": "复制 {count} 项",
	"menu.copyPath": "复制路径",
	"menu.copyPathN": "复制 {count} 条路径",
	"menu.compress": "压缩为 ZIP",
	"menu.compressN": "压缩 {count} 项为 ZIP",
	"menu.delete": "删除",
	"menu.deleteN": "删除 {count} 项",
	"menu.clearSelection": "取消选择",
	"menu.hint": "按住 ⌘/Ctrl 点击可多选",
	"delete.title": "删除文件",
	"delete.description": "以下 {count} 项将被永久删除，此操作不可恢复：\n{preview}",
	"delete.acknowledge": "我已知晓删除不可恢复",
	"delete.cancel": "取消",
	"delete.confirm": "删除",
	"compress.title": "压缩为 ZIP",
	"compress.description": "压缩包文件名（可修改）：",
	"compress.cancel": "取消",
	"compress.confirm": "压缩",
	"menu.edit": "编辑",
	"edit.title": "编辑",
	"edit.loading": "加载中…",
	"edit.format": "格式化",
	"edit.revert": "恢复原始",
	"edit.save": "保存",
	"edit.reload": "重新加载",
	"edit.reloadConfirm": "重新加载会放弃未保存的修改，继续？",
	"edit.confirm": "确认",
	"edit.saved": "已保存 {name}",
	"edit.formatted": "已格式化",
	"edit.closedUnsaved": "已关闭未保存的编辑：{name}",
	"edit.unavailable": "无法解析该编辑地址",
	"edit.unknownFormat": "该文件类型暂不支持一键格式化",
	"edit.findPlaceholder": "查找",
	"edit.replacePlaceholder": "替换为",
	"edit.gotoPlaceholder": "行号",
	"edit.prev": "上一个",
	"edit.next": "下一个",
	"edit.replaceOne": "替换",
	"edit.replaceAll": "全部替换",
	"edit.goto": "跳转",
	"edit.closeBar": "关闭",
	"edit.menuUndo": "撤销",
	"edit.menuRedo": "重做",
	"edit.menuCut": "剪切",
	"edit.menuCopy": "复制",
	"edit.menuPaste": "粘贴",
	"edit.menuSelectAll": "全选",
	"edit.menuFind": "搜索",
	"edit.menuReplace": "替换",
	"edit.menuGoto": "跳转到行",
	"edit.pasteFailed": "粘贴失败：无法读取剪贴板",
	"toast.cut": "已剪切 {count} 项，右键目录或使用顶部「粘贴」按钮粘贴",
	"toast.copied": "已复制 {count} 项，右键目录或使用顶部「粘贴」按钮粘贴",
	"toast.pasted": "已粘贴 {count} 项",
	"toast.moved": "已移动 {count} 项",
	"toast.deleted": "已删除 {count} 项",
	"toast.compressed": "已压缩为 {name}",
	"toast.compressedSkipped": "已压缩为 {name}（跳过 {skipped} 项）",
	"toast.pathCopied": "路径已复制到剪贴板",
	"toast.clipboardFailed": "复制到剪贴板失败",
	"toast.dismiss": "关闭",
};

const en = {
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
	"menu.hint": "Hold ⌘/Ctrl and click to multi-select",
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
	"edit.loading": "Loading…",
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
	"toast.cut": "Cut {count} items — right-click a directory or use the Paste button to paste",
	"toast.copied": "Copied {count} items — right-click a directory or use the Paste button to paste",
	"toast.pasted": "Pasted {count} items",
	"toast.moved": "Moved {count} items",
	"toast.deleted": "Deleted {count} items",
	"toast.compressed": "Compressed to {name}",
	"toast.compressedSkipped": "Compressed to {name} ({skipped} skipped)",
	"toast.pathCopied": "Path copied to clipboard",
	"toast.clipboardFailed": "Failed to write clipboard",
	"toast.dismiss": "Dismiss",
};

function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

// ─── 模块级状态（单实例 bundle，所有组件共享）─────────────────────────────
/**
 * @typedef {{ mode: "cut" | "copy", paths: string[], workspaceRoot: string }} Clipboard
 * @typedef {{ x: number, y: number, path: string | null,
 *             entry: "file" | "directory" | null, scope: "row" | "body",
 *             workspaceRoot: string }} MenuState
 * @typedef {{ paths: string[], workspaceRoot: string }} DeleteRequest
 * @typedef {{ paths: string[], workspaceRoot: string, name: string }} CompressRequest
 * @typedef {{ id: number, text: string, kind: "ok" | "error" }} ToastItem
 */
const state = {
	clipboard: /** @type {Clipboard | null} */ (null),
	selection: /** @type {Set<string>} */ (new Set()),
	menu: /** @type {MenuState | null} */ (null),
	deleteRequest: /** @type {DeleteRequest | null} */ (null),
	compressRequest: /** @type {CompressRequest | null} */ (null),
	toasts: /** @type {ToastItem[]} */ ([]),
	treeVisible: false,
};
const listeners = new Set();
let toastSeq = 0;

function notify() {
	for (const listener of listeners) listener();
}

function setState(patch) {
	const next = { ...state, ...patch };
	if (
		next.clipboard === state.clipboard
		&& next.selection === state.selection
		&& next.menu === state.menu
		&& next.deleteRequest === state.deleteRequest
		&& next.compressRequest === state.compressRequest
		&& next.toasts === state.toasts
		&& next.treeVisible === state.treeVisible
	) return;
	Object.assign(state, next);
	notify();
}

function readState() {
	return state;
}

/** React 订阅钩子：selector 必须返回稳定引用或原始值。 */
function useStore(selector) {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => selector(state),
	);
}

// ─── DOM 辅助 ─────────────────────────────────────────────────────────────
/** 当前可见文件树的根元素（工作区根路径）。 */
function currentTree() {
	const trees = document.querySelectorAll('[data-files-state="tree"]');
	for (const tree of trees) {
		if (tree.getBoundingClientRect().width > 0) return /** @type {HTMLElement} */ (tree);
	}
	return null;
}

/** 当前可见文件树的工作区根路径。 */
function currentTreeRoot() {
	return currentTree()?.getAttribute("data-files-root") ?? null;
}

/** 把多选状态同步到官方行 DOM（data-files-selected 标记）。 */
function syncSelectionMarks() {
	const selection = readState().selection;
	for (const row of document.querySelectorAll('[data-files-path][data-files-entry]')) {
		const path = row.getAttribute("data-files-path");
		if (path !== null && selection.has(path)) row.setAttribute("data-files-selected", "true");
		else row.removeAttribute("data-files-selected");
	}
}

/** 把剪切缓冲同步到官方行 DOM（data-files-cut 半透明标记）。 */
function syncCutMarks() {
	const clipboard = readState().clipboard;
	const cutPaths = clipboard !== null && clipboard.mode === "cut" ? new Set(clipboard.paths) : null;
	for (const row of document.querySelectorAll('[data-files-path][data-files-entry]')) {
		const path = row.getAttribute("data-files-path");
		if (cutPaths !== null && path !== null && cutPaths.has(path)) row.setAttribute("data-files-cut", "true");
		else row.removeAttribute("data-files-cut");
	}
}

/** 浏览器路径的 dirname（树里统一 "/" 分隔）。 */
function dirnameOf(path) {
	const normalized = String(path).replace(/[/\\]+$/, "");
	const index = normalized.lastIndexOf("/");
	if (index <= 0) return normalized.startsWith("/") ? "/" : normalized;
	return normalized.slice(0, index);
}

/** 路径短名（显示用）。 */
function basenameOf(path) {
	return String(path).replace(/[/\\]+$/, "").split("/").pop() ?? String(path);
}

// ─── 宿主请求 ─────────────────────────────────────────────────────────────
async function api(operation, body) {
	const response = await fetch(`${API}/${operation}`, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify(body),
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok || payload.ok !== true) {
		const error = new Error(payload.message ?? `HTTP ${response.status}`);
		error.code = payload.code;
		throw error;
	}
	return payload;
}

// ─── 操作（模块级，供菜单/批量栏/头部按钮共享）────────────────────────────
let t = (key, params) => format(key, params ?? {});

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
	setState({ selection: new Set() });
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

/** 在右侧栏打开文件编辑 tab（单选文件右键菜单最上方的「编辑」）。 */
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

/** 把一组路径放进剪切/复制缓冲（操作完成即清除多选）。 */
function stagePaths(paths, mode, workspaceRoot = currentTreeRoot()) {
	if (workspaceRoot === null || paths.length === 0) return;
	setClipboard({ mode, paths: [...paths], workspaceRoot });
	clearSelection();
	pushToast(t(mode === "cut" ? "toast.cut" : "toast.copied", { count: paths.length }));
}

/** 复制路径到系统剪贴板（写入成功后清除多选）。 */
function copyPaths(paths) {
	void writeClipboard(paths.join("\n")).then((ok) => {
		if (ok) clearSelection();
		pushToast(ok ? t("toast.pathCopied") : t("toast.clipboardFailed"), ok ? "ok" : "error");
	});
}

/** 粘贴到目标目录（目录路径即工作区绝对路径）。 */
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

/** 压缩包预设命名：单源 `<名>.zip`，多源 `archive.zip`（与宿主端一致）。 */
function presetZipName(paths) {
	if (paths.length === 1) return `${basenameOf(paths[0])}.zip`;
	return "archive.zip";
}

/** 压缩一组路径：先弹命名输入框（自动填充预设名），确认后打包。 */
function compressPaths(paths, workspaceRoot = currentTreeRoot()) {
	if (paths.length === 0 || workspaceRoot === null) return;
	requestCompress({ paths: [...paths], workspaceRoot, name: presetZipName(paths) });
}

/** 命名确认后真正发压缩请求（成功后清除多选）。 */
function performCompress(request, rawName) {
	let name = String(rawName ?? "").trim();
	if (name === "") name = request.name;
	if (!/\.zip$/i.test(name)) name += ".zip";
	api("compress", {
		workspaceRoot: request.workspaceRoot,
		sources: request.paths,
		destination: dirnameOf(request.paths[0]),
		name,
	}).then((payload) => {
		clearSelection();
		pushToast(payload.skipped > 0 ? t("toast.compressedSkipped", { name: payload.name, skipped: payload.skipped }) : t("toast.compressed", { name: payload.name }));
	}).catch((error) => {
		pushToast(error.message, "error");
	});
}

/** 删除一组路径（先弹确认）。 */
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

/** 菜单/批量栏的标签：多项时带数量。 */
function itemLabel(key, keyN, count) {
	return count > 1 ? t(keyN, { count }) : t(key);
}

// ─── 右键菜单 ─────────────────────────────────────────────────────────────
function ContextMenu() {
	const menu = useStore((s) => s.menu);
	const selection = useStore((s) => s.selection);
	const clipboard = useStore((s) => s.clipboard);
	if (menu === null) return null;
	const clickedSelected = menu.path !== null && selection.has(menu.path);
	const targets = clickedSelected ? [...selection] : (menu.path !== null ? [menu.path] : []);
	// OS 式右键菜单定位：默认在指针右下方展开（菜单左上角对齐指针），
	// 仅当预估尺寸会超出屏幕时才向指针左侧 / 上方翻转；
	// Menu 组件内部还会按实际尺寸做边距钳制兜底。
	const MENU_MARGIN = 12;
	const MENU_EST_WIDTH = 200;
	const MENU_EST_HEIGHT = 240;
	const side = menu.y + MENU_EST_HEIGHT <= window.innerHeight - MENU_MARGIN ? "bottom" : "top";
	const align = menu.x + MENU_EST_WIDTH <= window.innerWidth - MENU_MARGIN ? "start" : "end";
	const pasteTarget = menu.scope === "body" ? menu.workspaceRoot : (menu.entry === "directory" ? menu.path : null);
	return h("div", { "data-dfa-ui": "menu", style: { pointerEvents: "none" } },
		h(Menu, {
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
				height: 0,
			}),
			anchor: h("span", { style: { position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0 } }),
			children: [
				pasteTarget !== null && h(MenuItemButton, {
					icon: h(IconFolderOpenOutlineRegular, { size: 14 }),
					disabled: clipboard === null,
					onSelect: () => {
						closeMenu();
						pasteInto(pasteTarget, menu.workspaceRoot);
					},
					children: clipboard === null ? t("menu.paste") : itemLabel("menu.paste", "menu.pasteN", clipboard.paths.length),
				}),
				menu.scope === "body" && selection.size > 0 && h(MenuItemButton, {
					icon: h(IconCloseOutlineRegular, { size: 14 }),
					onSelect: () => {
						closeMenu();
						clearSelection();
					},
					children: t("menu.clearSelection"),
				}),
				menu.scope === "row" && h(Fragment, { children: [
				menu.entry === "file" && targets.length === 1 && h(MenuItemButton, {
					icon: h(IconEditOutlineRegular, { size: 14 }),
					onSelect: () => {
						closeMenu();
						openEdit(targets[0], menu.workspaceRoot);
					},
					children: t("menu.edit"),
				}),
				h(MenuItemButton, {
						icon: h(IconEditOutlineRegular, { size: 14 }),
						onSelect: () => {
							closeMenu();
							stagePaths(targets, "cut", menu.workspaceRoot);
						},
						children: itemLabel("menu.cut", "menu.cutN", targets.length),
					}),
					h(MenuItemButton, {
						icon: h(IconCopyOutlineRegular, { size: 14 }),
						onSelect: () => {
							closeMenu();
							stagePaths(targets, "copy", menu.workspaceRoot);
						},
						children: itemLabel("menu.copy", "menu.copyN", targets.length),
					}),
					h(MenuItemButton, {
						icon: h(IconLinkOutlineRegular, { size: 14 }),
						onSelect: () => {
							closeMenu();
							copyPaths(targets);
						},
						children: itemLabel("menu.copyPath", "menu.copyPathN", targets.length),
					}),
					h(MenuItemButton, {
						icon: h(IconArchiveOutlineRegular, { size: 14 }),
						onSelect: () => {
							closeMenu();
							compressPaths(targets, menu.workspaceRoot);
						},
						children: itemLabel("menu.compress", "menu.compressN", targets.length),
					}),
					h(MenuItemButton, {
						danger: true,
						separatorBefore: true,
						icon: h(IconTrashOutlineRegular, { size: 14 }),
						onSelect: () => {
							closeMenu();
							deletePaths(targets, menu.workspaceRoot);
						},
						children: itemLabel("menu.delete", "menu.deleteN", targets.length),
					}),
				] }),
			],
		}),
	);
}

// ─── 批量操作栏 ───────────────────────────────────────────────────────────
function BatchBar() {
	const selection = useStore((s) => s.selection);
	const treeVisible = useStore((s) => s.treeVisible);
	if (!treeVisible || selection.size === 0) return null;
	const paths = [...selection];
	return h("div", { className: "dfa-bar", "data-dfa-ui": "bar", role: "toolbar", style: { pointerEvents: "auto" } }, [
		h("span", { className: "dfa-bar-count" }, t("menu.hint")),
		h("span", { className: "dfa-bar-divider" }),
		barButton(IconEditOutlineRegular, itemLabel("menu.cut", "menu.cutN", paths.length), () => stagePaths(paths, "cut")),
		barButton(IconCopyOutlineRegular, itemLabel("menu.copy", "menu.copyN", paths.length), () => stagePaths(paths, "copy")),
		barButton(IconArchiveOutlineRegular, itemLabel("menu.compress", "menu.compressN", paths.length), () => compressPaths(paths)),
		barButton(IconLinkOutlineRegular, itemLabel("menu.copyPath", "menu.copyPathN", paths.length), () => copyPaths(paths)),
		barButton(IconTrashOutlineRegular, itemLabel("menu.delete", "menu.deleteN", paths.length), () => deletePaths(paths), true),
		barButton(IconCloseOutlineRegular, t("menu.clearSelection"), clearSelection),
	]);
}

function barButton(icon, label, onClick, danger = false) {
	return h("button", {
		type: "button",
		className: danger ? "dfa-bar-btn dfa-bar-danger" : "dfa-bar-btn",
		title: label,
		onClick,
		children: [h(icon, { size: 14 }), h("span", { className: "dfa-bar-label", children: label })],
	});
}

// ─── 删除确认 ─────────────────────────────────────────────────────────────
function DeleteConfirm() {
	const request = useStore((s) => s.deleteRequest);
	const [acknowledged, setAcknowledged] = useState(false);
	useEffect(() => {
		if (request !== null) setAcknowledged(false);
	}, [request]);
	const paths = request?.paths ?? [];
	const preview = [...paths.slice(0, 3), ...(paths.length > 3 ? [`… (${paths.length - 3})`] : [])].map((path) => `· ${path}`).join("\n");
	return h(RiskConfirmation, {
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
		},
	});
}

// ─── 压缩命名输入框 ───────────────────────────────────────────────────────
function CompressDialog() {
	const request = useStore((s) => s.compressRequest);
	const [name, setName] = useState("");
	const inputRef = useRef(null);
	useEffect(() => {
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
	return h(Modal, {
		open: request !== null,
		title: t("compress.title"),
		onClose: settleCompress,
		footer: h(Fragment, { children: [
			h(Button, { variant: "outline", onClick: settleCompress, children: t("compress.cancel") }),
			h(Button, { variant: "primary", disabled: name.trim() === "", onClick: confirm, children: t("compress.confirm") }),
		] }),
		children: h("div", { className: "dfa-compress" }, [
			h("p", { className: "dfa-compress-desc", children: t("compress.description") }),
			h("input", {
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
				},
			}),
		]),
	});
}

// ─── 文件编辑 Tab（右侧栏）────────────────────────────────────────────────
/** 编辑 tab 的地址格式：dsh-resource://file-edit/<wsRoot>/<path>（各段 URL 编码）。 */
const EDIT_KIND = "file-editor";
const EDIT_ID = "dsh-plugin-file-actions";
const EDIT_PREFIX = "dsh-resource://file-edit/";

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
			path: decodeURIComponent(rest.slice(sep + 1)),
		};
	} catch {
		return null;
	}
}

/** 对选区跨行做缩进/反缩进；无选区时在光标处插入两个空格。 */
function applyIndent(content, textarea, delta) {
	const start = textarea.selectionStart ?? content.length;
	const end = textarea.selectionEnd ?? start;
	if (start === end) {
		const next = content.slice(0, start) + "  " + content.slice(end);
		queueMicrotask(() => {
			textarea.selectionStart = textarea.selectionEnd = start + 2;
		});
		return next;
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

/** 文本中的查找匹配（不区分大小写可选），按出现顺序返回区间。 */
function findMatchesIn(text, query, caseSensitive) {
	const matches = [];
	if (query === "") return matches;
	const hay = caseSensitive ? text : text.toLowerCase();
	const needle = caseSensitive ? query : query.toLowerCase();
	let from = 0;
	for (;;) {
		const at = hay.indexOf(needle, from);
		if (at === -1) break;
		matches.push({ start: at, end: at + query.length });
		from = at + query.length;
	}
	return matches;
}

/** 某行（0 基）在内容里的起始字符位置。 */
function lineStartPos(content, lineIndex) {
	if (lineIndex <= 0) return 0;
	let pos = -1;
	for (let i = 0; i < lineIndex; i++) pos = content.indexOf("\n", pos + 1);
	return pos === -1 ? content.length : pos + 1;
}

/** 带样式地输出一段 token 文本。 */
function styledText(text, style) {
	return style !== null && style !== undefined ? h("span", { style }, text) : text;
}

/** 把 token 文本按查找区间切分，命中区间加标记类。 */
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
		out.push(h("span", { className: mark.current ? "dfa-code-find dfa-code-find-current" : "dfa-code-find" }, text.slice(cs, ce)));
		cursor = ce;
	}
	if (cursor < text.length) out.push(styledText(text.slice(cursor), style));
	return out;
}

/** 把高亮 token 行渲染为与 textarea 完全对齐的 pre 内容（支持查找命中标记）。 */
function tokenNodes(tokens, content, marks = []) {
	const lines = tokens ?? content.split("\n").map((line) => [{ text: line, style: null }]);
	const nodes = [];
	let index = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? [];
		for (let j = 0; j < line.length; j++) {
			const token = line[j];
			nodes.push(...markedToken(token.text, index, marks, token.style));
			index += token.text.length;
		}
		if (i < lines.length - 1) {
			nodes.push("\n");
			index += 1;
		}
	}
	return nodes;
}

/** 编辑态实时高亮：透明文字 textarea 叠在 shiki（DSH 自带）高亮层上，滚动/排版完全同步。 */
function HighlightEditor({ content, language, onContent, onSave, findText, caseSensitive, findIndex, inputRef, onContextMenu }) {
	const highlight = useCodeHighlighter(language);
	const [scroll, setScroll] = useState({ left: 0, top: 0 });
	// 防抖高亮：输入流畅，高亮层稍后跟上（大文件不卡键）。
	const [highlightContent, setHighlightContent] = useState(content);
	useEffect(() => {
		const timer = setTimeout(() => setHighlightContent(content), 120);
		return () => clearTimeout(timer);
	}, [content]);
	const tokens = useMemo(() => highlight?.(highlightContent) ?? null, [highlight, highlightContent]);
	// 查找命中标记（基于高亮层内容，保证与可见文本对齐）。
	const marks = useMemo(() => {
		const matches = findMatchesIn(highlightContent, findText, caseSensitive);
		const current = Math.min(Math.max(findIndex, 0), matches.length - 1);
		return matches.map((match, i) => ({ ...match, current: i === current }));
	}, [highlightContent, findText, caseSensitive, findIndex]);
	const lineCount = content.split("\n").length;
	const gutterText = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");
	return h("div", { className: "dfa-code-editor" }, [
		h("div", {
			className: "dfa-code-gutter",
			"aria-hidden": "true",
			style: { transform: `translateY(${-scroll.top}px)` },
			children: gutterText,
		}),
		h("div", { className: "dfa-code-viewport" }, [
			h("pre", {
				className: "dfa-code-highlight",
				"aria-hidden": "true",
				style: { transform: `translate(${-scroll.left}px, ${-scroll.top}px)` },
				children: tokenNodes(tokens, highlightContent, marks),
			}),
			h("textarea", {
				ref: inputRef,
				className: "dfa-code-input",
				value: content,
				spellCheck: false,
				wrap: "off",
				onChange: (event) => onContent(event.currentTarget.value),
				onScroll: (event) => setScroll({ left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }),
				onContextMenu,
				onKeyDown: (event) => {
					if (event.key === "Tab") {
						event.preventDefault();
						const el = event.currentTarget;
						onContent(applyIndent(content, el, event.shiftKey ? -2 : 2));
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
				},
			}),
		]),
	]);
}

/** 右侧栏「文件编辑」tab 主体：工具栏 + 搜索/替换/跳转栏 + 高亮编辑器 + 右键菜单。 */
function EditorTab(props) {
	const translate = props.t ?? t;
	const { useTabInfo } = props;
	const { tab } = useTabInfo();
	const parsed = parseEditAddress(tab.contentId);
	const [content, setContent] = useState("");
	const [original, setOriginal] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const [confirmingReload, setConfirmingReload] = useState(false);
	const [bar, setBar] = useState(null); // null | "find" | "replace" | "goto"
	const [findText, setFindText] = useState("");
	const [replaceText, setReplaceText] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [findIndex, setFindIndex] = useState(0);
	const [gotoText, setGotoText] = useState("");
	const [menuAt, setMenuAt] = useState(null); // 编辑框右键菜单坐标
	const inputRef = useRef(null);
	const dirtyRef = useRef(false);
	const dirty = content !== original;
	dirtyRef.current = dirty;
	const name = parsed === null ? "" : basenameOf(parsed.path);
	const matches = useMemo(() => findMatchesIn(content, findText, caseSensitive), [content, findText, caseSensitive]);
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
		if (match === undefined) return;
		const next = content.slice(0, match.start) + replaceText + content.slice(match.end);
		setContent(next);
		setFindIndex(currentMatch);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (el !== null) {
				el.setSelectionRange(match.start, match.start + replaceText.length);
				el.focus();
			}
		});
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
	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [parsed?.workspaceRoot, parsed?.path]);
	useEffect(() => {
		tab.actions.bindCommands({ refresh: load });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tab.actions]);
	// 关闭 tab 时若还有未保存修改，提示用户。
	useEffect(() => () => {
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
	const format = () => {
		if (parsed === null || !loaded) return;
		api("format", { workspaceRoot: parsed.workspaceRoot, path: parsed.path, content }).then((payload) => {
			setContent(payload.content);
			pushToast(translate("edit.formatted"));
		}).catch((formatError) => {
			pushToast(formatError.message, "error");
		});
	};
	/** 编辑框右键菜单里的编辑指令（作用于 textarea）。 */
	const runCommand = (command) => {
		focusEditor();
		try {
			document.execCommand(command);
		} catch {
			// 老 API 被移除时静默失败。
		}
	};
	const pasteFromClipboard = () => {
		const el = inputRef.current;
		if (el === null) return;
		void navigator.clipboard.readText().then((text) => {
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? start;
			setContent(content.slice(0, start) + text + content.slice(end));
			requestAnimationFrame(() => {
				el.setSelectionRange(start + text.length, start + text.length);
				el.focus();
			});
		}).catch(() => {
			pushToast(translate("edit.pasteFailed"), "error");
		});
	};
	if (parsed === null) return h("div", { className: "dfa-editor-status" },
		h("p", { className: "dfa-editor-status-line", children: translate("edit.unavailable") }));
	const language = languageForPath(parsed.path) ?? "plaintext";
	const menuSide = menuAt === null || menuAt.y < window.innerHeight * 0.6 ? "bottom" : "top";
	const menuAlign = menuAt === null || menuAt.x + 200 <= window.innerWidth - 12 ? "start" : "end";
	return h("div", { className: "dfa-editor-root", "data-dfa-ui": "editor" }, [
		h("div", { className: "dfa-editor-header" }, [
			h("span", { className: "dfa-editor-name", title: parsed.path, children: name }),
			dirty && h("span", { className: "dfa-editor-dirty", children: "•" }),
			h("span", { className: "dfa-editor-spacer" }),
			confirmingReload ? h(Fragment, { children: [
				h("span", { className: "dfa-editor-confirm", children: translate("edit.reloadConfirm") }),
				editorButton(translate("edit.confirm"), load),
				editorButton(translate("edit.revert"), () => setConfirmingReload(false)),
			] }) : h(Fragment, { children: [
				editorButton(translate("edit.reload"), () => {
					if (dirty) setConfirmingReload(true);
					else load();
				}, h(IconRefreshOutlineRegular, { size: 14 })),
				editorButton(translate("edit.format"), format, h(IconEditOutlineRegular, { size: 14 }), !loaded),
				editorButton(translate("edit.revert"), () => setContent(original), h(IconCloseOutlineRegular, { size: 14 }), !loaded || !dirty),
				editorButton(translate("edit.save"), save, h(IconCheckOutlineRegular, { size: 14 }), !loaded || !dirty || saving, true),
			] }),
		]),
		bar !== null && h("div", { className: "dfa-editor-bar" }, [
			bar !== "goto" && h(Fragment, { children: [
				h("input", {
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
					},
				}),
				h("span", { className: "dfa-editor-bar-count", children: findText === "" ? "" : matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "0" }),
				editorButton(translate("edit.prev"), () => findNext(-1), null, matches.length === 0),
				editorButton(translate("edit.next"), () => findNext(1), null, matches.length === 0),
				editorButton(caseSensitive ? "Aa" : "aa", () => setCaseSensitive(!caseSensitive), null, false),
			] }),
			bar === "replace" && h(Fragment, { children: [
				h("input", {
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
					},
				}),
				editorButton(translate("edit.replaceOne"), replaceOne, null, matches.length === 0),
				editorButton(translate("edit.replaceAll"), replaceAll, null, findText === ""),
			] }),
			bar === "goto" && h(Fragment, { children: [
				h("input", {
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
					},
				}),
				editorButton(translate("edit.goto"), doGoto),
			] }),
			editorButton(translate("edit.closeBar"), closeBar, h(IconCloseOutlineRegular, { size: 14 })),
		]),
		!loaded && error === null ? h("div", { className: "dfa-editor-status" },
			h("p", { className: "dfa-editor-status-line", children: translate("edit.loading") }))
			: error !== null ? h("div", { className: "dfa-editor-status" }, [
				h("p", { className: "dfa-editor-status-line", children: error }),
				h("button", { type: "button", className: "dfa-editor-retry", onClick: load, children: translate("edit.reload") }),
			])
			: h(HighlightEditor, {
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
				},
			}),
		menuAt !== null && h(Menu, {
			open: true,
			portal: true,
			compact: true,
			autoFocus: true,
			side: menuSide,
			align: menuAlign,
			listClassName: "dfa-menu",
			onClose: () => setMenuAt(null),
			getAnchorRect: () => ({ left: menuAt.x, top: menuAt.y, right: menuAt.x, bottom: menuAt.y, width: 0, height: 0 }),
			anchor: h("span", { style: { position: "fixed", left: menuAt.x, top: menuAt.y, width: 0, height: 0 } }),
			children: [
				h(MenuItemButton, { onSelect: () => runCommand("undo"), children: translate("edit.menuUndo") }),
				h(MenuItemButton, { onSelect: () => runCommand("redo"), children: translate("edit.menuRedo") }),
				h(MenuItemButton, { separatorBefore: true, onSelect: () => runCommand("cut"), children: translate("edit.menuCut") }),
				h(MenuItemButton, { onSelect: () => runCommand("copy"), children: translate("edit.menuCopy") }),
				h(MenuItemButton, { onSelect: pasteFromClipboard, children: translate("edit.menuPaste") }),
				h(MenuItemButton, { onSelect: () => {
					const el = inputRef.current;
					if (el !== null) {
						el.focus();
						el.select();
					}
				}, children: translate("edit.menuSelectAll") }),
				h(MenuItemButton, { separatorBefore: true, onSelect: openFind, children: translate("edit.menuFind") }),
				h(MenuItemButton, { onSelect: openReplace, children: translate("edit.menuReplace") }),
				h(MenuItemButton, { onSelect: openGoto, children: translate("edit.menuGoto") }),
				h(MenuItemButton, { separatorBefore: true, onSelect: format, children: translate("edit.format") }),
				h(MenuItemButton, { onSelect: save, disabled: !loaded || !dirty, children: translate("edit.save") }),
			],
		}),
	]);
}

function editorButton(label, onClick, icon = null, disabled = false, primary = false) {
	return h("button", {
		type: "button",
		className: primary ? "dfa-editor-btn dfa-editor-btn-primary" : "dfa-editor-btn",
		disabled,
		onClick,
		title: typeof label === "string" ? label : undefined,
		children: [icon, label].filter(Boolean),
	});
}

/** 右侧栏「文件编辑」tab 的标题 chip。 */
function EditorTabTitle({ useTabInfo }) {
	const { tab } = useTabInfo();
	return h(Fragment, { children: [
		h(IconEditOutlineRegular, { size: 14, className: "dfa-tab-title-icon" }),
		h("span", { children: tab.title }),
	] });
}

// ─── Toast 堆栈 ───────────────────────────────────────────────────────────
function ToastStack() {
	const toasts = useStore((s) => s.toasts);
	if (toasts.length === 0) return null;
	return h("div", { className: "dfa-toasts", "data-dfa-ui": "toasts", role: "status", style: { pointerEvents: "auto" } },
		[...toasts].reverse().map((toast) =>
			h("div", { key: toast.id, className: toast.kind === "error" ? "dfa-toast dfa-toast-error" : "dfa-toast" }, [
				h(toast.kind === "error" ? IconCloseCircleFillRegular : IconCheckCircleFillRegular, { size: 16, className: "dfa-toast-icon" }),
				h("span", { className: "dfa-toast-text", children: toast.text }),
				h("button", { type: "button", className: "dfa-toast-close", "aria-label": t("toast.dismiss"), onClick: () => dismissToast(toast.id), children: h(IconCloseOutlineRegular, { size: 12 }) }),
			]),
		),
	);
}

// ─── 文件树头部「粘贴」按钮（官方 files.actions 槽位）────────────────────
function PasteHeaderAction(props) {
	const clipboard = useStore((s) => s.clipboard);
	if (clipboard === null) return null;
	const root = String(props.absolutePath ?? "");
	return h("button", {
		type: "button",
		className: "dfa-header-btn",
		title: t("menu.paste"),
		onClick: () => pasteInto(root, root),
		children: [h(IconFolderOpenOutlineRegular, { size: 14 }), h("span", { children: t("menu.paste") })],
	});
}

// ─── 样式（注入一次）──────────────────────────────────────────────────────
const CSS = `
[data-files-path][data-files-entry][data-files-selected="true"] > button,
[data-files-path][data-files-entry][data-files-selected="true"] > button:hover {
	background: var(--dsw-alias-interactive-bg-hover);
	box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary);
}
[data-files-path][data-files-entry][data-files-selected="true"] > button::after {
	content: "✓";
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
	box-sizing: border-box;
	padding: 8px 6px 8px 0;
	text-align: right;
	color: var(--dsw-alias-label-caption);
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 1.6;
	user-select: none;
	white-space: pre;
	border-right: .5px solid var(--dsw-alias-border-l3);
	background: var(--dsw-alias-bg-layer-1, transparent);
}
.dfa-code-viewport {
	flex: 1;
	min-width: 0;
	min-height: 0;
	position: relative;
	overflow: hidden;
}
.dfa-code-highlight,
.dfa-code-input {
	margin: 0;
	padding: 8px 12px 48px;
	border: 0;
	font-family: var(--dsh-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
	font-size: 13px;
	line-height: 1.6;
	letter-spacing: normal;
	white-space: pre;
	tab-size: 2;
	word-break: normal;
	overflow-wrap: normal;
}
.dfa-code-highlight {
	position: absolute;
	top: 0;
	left: 0;
	min-width: 100%;
	box-sizing: border-box;
	pointer-events: none;
	color: var(--dsw-alias-label-primary);
}
.dfa-code-input {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	box-sizing: border-box;
	resize: none;
	overflow: auto;
	outline: none;
	background: transparent;
	color: transparent;
	-webkit-text-fill-color: transparent;
	caret-color: var(--dsw-alias-label-primary);
}
.dfa-code-input::selection {
	background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent);
}
.dfa-code-input::placeholder {
	color: var(--dsw-alias-label-caption);
	-webkit-text-fill-color: var(--dsw-alias-label-caption);
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

// ─── 插件入口 ─────────────────────────────────────────────────────────────
export function apply(ctx) {
	injectStyles();
	t = ctx.locale.bind(NS);
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "file-actions: dictionaries");
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-context-menu",
		locale: NS,
		inject: () => ({}),
	}, ContextMenu));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-batch-bar",
		locale: NS,
		inject: () => ({}),
	}, BatchBar));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-delete-confirm",
		locale: NS,
		inject: () => ({}),
	}, DeleteConfirm));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-compress-dialog",
		locale: NS,
		inject: () => ({}),
	}, CompressDialog));
	sidebarRight = ctx.sidebarRight;
	sidebarRightTabs = ctx.sidebarRightTabs;
	// 文件编辑 tab 类型：仅在显式指定 kind 时打开（patterns 只匹配本插件的
	// file-edit 地址，不影响普通文件点击 → 官方预览）。
	ctx.effect(() => sidebarRightTabs.register({
		id: EDIT_ID,
		kind: EDIT_KIND,
		patterns: ["dsh-resource://file-edit/**"],
		priority: "fallback",
		canOpen: (address) => String(address).startsWith(EDIT_PREFIX),
		title: (address) => parseEditAddress(address)?.path !== undefined ? basenameOf(parseEditAddress(address).path) : "Edit",
	}), "file-actions: editor tab type");
	ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab",
		key: EDIT_ID,
		locale: NS,
		inject: () => ({}),
	}, EditorTab)), "file-actions: editor tab body");
	ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
		name: "sidebar.right.pane.tab.title",
		key: EDIT_ID,
		locale: NS,
		inject: () => ({}),
	}, EditorTabTitle)), "file-actions: editor tab title");
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-toasts",
		locale: NS,
		inject: () => ({}),
	}, ToastStack));
	ctx.slots.inject("sidebar.right.tab.files.actions", () => ctx.slots.register({
		name: "sidebar.right.tab.files.actions",
		id: "file-actions-paste",
		order: 100,
		locale: NS,
		inject: () => ({}),
	}, PasteHeaderAction));

	// 全局事件监听：右键菜单、Ctrl/Cmd 多选、Delete 删除、Escape 取消。
	ctx.effect(() => {
		const onContextMenu = (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (target.closest(OWN_UI)) return;
			const tree = target.closest('[data-files-state="tree"]');
			if (tree === null) return;
			const row = target.closest('[data-files-path]');
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
			if (target.closest(OWN_UI) || target.closest(modalSelector)) return;
			if (event.ctrlKey || event.metaKey) {
				const row = target.closest('[data-files-path]');
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
			// 无修饰键：普通点击行或点击文件树之外 → 清空多选（不阻止默认行为）。
			if (target.closest('[data-files-path]') !== null) {
				clearSelection();
				return;
			}
			if (target.closest('[data-files-state="tree"]') === null) clearSelection();
		};
		const onKeyDown = (event) => {
			if (event.key !== "Escape" && event.key !== "Delete" && event.key !== "Backspace") return;
			const target = event.target;
			const editable = target instanceof HTMLElement
				&& (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
			if (editable) return;
			if (document.querySelector(modalSelector) !== null) return; // 模态框打开时不处理
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

		// 观察文件树 DOM：树出现/消失、行挂载时同步标记与剪贴板。
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

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];
