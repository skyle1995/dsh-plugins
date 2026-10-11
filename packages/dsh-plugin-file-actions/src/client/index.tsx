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
import { createElement as h, Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
	Menu,
	MenuItemButton,
	RiskConfirmation,
	modalSelector,
	writeClipboard,
} from "@deepseek-ai/dsh-client-ui-primitives";

const NS = "dsh-plugin-file-actions";
const API = "/api/dsh-file-actions";
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
 * @typedef {{ id: number, text: string, kind: "ok" | "error" }} ToastItem
 */
const state = {
	clipboard: /** @type {Clipboard | null} */ (null),
	selection: /** @type {Set<string>} */ (new Set()),
	menu: /** @type {MenuState | null} */ (null),
	deleteRequest: /** @type {DeleteRequest | null} */ (null),
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

/** 把一组路径放进剪切/复制缓冲。 */
function stagePaths(paths, mode, workspaceRoot = currentTreeRoot()) {
	if (workspaceRoot === null || paths.length === 0) return;
	setClipboard({ mode, paths: [...paths], workspaceRoot });
	pushToast(t(mode === "cut" ? "toast.cut" : "toast.copied", { count: paths.length }));
}

/** 复制路径到系统剪贴板。 */
function copyPaths(paths) {
	void writeClipboard(paths.join("\n")).then((ok) => {
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

/** 压缩一组路径（打包进第一个源的父目录）。 */
function compressPaths(paths, workspaceRoot = currentTreeRoot()) {
	if (paths.length === 0 || workspaceRoot === null) return;
	const destination = dirnameOf(paths[0]);
	api("compress", { workspaceRoot, sources: paths, destination }).then((payload) => {
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
		const next = new Set(state.selection);
		for (const path of request.paths) next.delete(path);
		setState({ selection: next });
		syncSelectionMarks();
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
	const side = menu.y < window.innerHeight * 0.6 ? "bottom" : "top";
	const align = menu.x < window.innerWidth * 0.5 ? "start" : "end";
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
export const inject = ["slots", "locale"];
