/**
 * dsh-plugin-file-actions 浏览器半区：文件列表（右侧 files 标签页）增强。
 *
 * - 右键菜单：编辑 / 添加到会话 / 重命名 / 剪切 / 复制 / 粘贴 / 复制路径 / 压缩 / 删除
 *   （删除需确认）；重命名对文件与目录均适用，Enter 确认、Esc 取消；
 * - Ctrl/Cmd+点击 多选、Shift+点击 选中锚点到该行的连续区间（Ctrl/Cmd+Shift
 *   并入已有选择），选中行高亮；批量操作栏（剪切/复制/压缩/删除/复制路径/
 *   取消）悬浮在窗口底部；Delete 键直接进入删除确认，F2 重命名单选项；
 * - 文件树顶部（sidebar.right.tab.files.actions 官方槽位）追加「粘贴」按钮；
 * - 剪贴板为模块级内存缓冲（剪切项半透明标记，粘贴成功后清空）；切换
 *   工作区自动清空；
 * - 文件管理走宿主半区 /api/dsh-file-actions；添加到会话走客户端输入服务，均有 Toast。
 *
 * 行 DOM（官方 sidebar-files 渲染）：
 *   <li data-files-entry="file|directory|other" data-files-path="<绝对路径>">
 *   <div data-files-state="tree" data-files-root="<工作区根>"> 为树根。
 */
import { createElement as h, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
	IconArchiveOutlineRegular,
	IconCheckCircleFillRegular,
	IconCloseCircleFillRegular,
	IconCloseOutlineRegular,
	IconCopyOutlineRegular,
	IconEditOutlineRegular,
	IconFolderOpenOutlineRegular,
	IconLinkOutlineRegular,
	IconListPenOutlineRegular,
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
/** 会话引用操作的宿主上下文，随插件卸载释放。 */
let sessionContext = null;
/** 我们自己的 DOM 标记：全局监听器据此跳过自身 UI。 */
const OWN_UI = "[data-dfa-ui], .dfa-menu";

const zh = {
	"menu.addToSession": "添加到会话",
	"toast.addedToSession": "已添加到会话：{name}",
	"toast.sessionUnavailable": "当前会话不可用或已切换，请重新右键选择",
	"toast.sessionBusy": "当前输入框暂不可编辑，请稍后重试",
	"toast.referenceInvalid": "该路径无法作为当前工作区的文件引用",
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
	"menu.rename": "重命名",
	"menu.clearSelection": "取消选择",
	"menu.hint": "⌘/Ctrl 点击多选，Shift 点击选择连续区间",
	"delete.title": "删除文件",
	"delete.description": "以下 {count} 项将被永久删除，此操作不可恢复：\n{preview}",
	"delete.acknowledge": "我已知晓删除不可恢复",
	"delete.cancel": "取消",
	"delete.confirm": "删除",
	"compress.title": "压缩为 ZIP",
	"compress.description": "压缩包文件名（可修改）：",
	"compress.cancel": "取消",
	"compress.confirm": "压缩",
	"rename.title": "重命名",
        "rename.description": "为「{name}」输入新名字（仅限单段名称，不能跨目录）：",
	"rename.cancel": "取消",
	"rename.confirm": "重命名",
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
        "edit.formatStale": "格式化期间内容已修改，未覆盖当前编辑",
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
	"edit.wrap": "自动换行",
	"toast.cut": "已剪切 {count} 项，右键目录或使用顶部「粘贴」按钮粘贴",
	"toast.copied": "已复制 {count} 项，右键目录或使用顶部「粘贴」按钮粘贴",
	"toast.pasted": "已粘贴 {count} 项",
	"toast.moved": "已移动 {count} 项",
	"toast.deleted": "已删除 {count} 项",
	"toast.compressed": "已压缩为 {name}",
	"toast.compressedSkipped": "已压缩为 {name}（跳过 {skipped} 项）",
	"toast.renamed": "已重命名为 {name}",
	"toast.pathCopied": "路径已复制到剪贴板",
	"toast.clipboardFailed": "复制到剪贴板失败",
	"toast.dismiss": "关闭",
};

const en = {
	"menu.addToSession": "Add to conversation",
	"toast.addedToSession": "Added to conversation: {name}",
	"toast.sessionUnavailable": "Conversation unavailable or changed. Open the context menu again.",
	"toast.sessionBusy": "The composer is currently locked. Try again later.",
	"toast.referenceInvalid": "This path cannot be referenced in the current workspace.",
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
	"menu.rename": "Rename",
	"menu.clearSelection": "Clear selection",
	"menu.hint": "⌘/Ctrl+click to multi-select, Shift+click to select a range",
	"delete.title": "Delete files",
	"delete.description": "These {count} items will be permanently removed. This cannot be undone:\n{preview}",
	"delete.acknowledge": "I understand this cannot be undone",
	"delete.cancel": "Cancel",
	"delete.confirm": "Delete",
	"compress.title": "Compress to ZIP",
	"compress.description": "Archive file name (editable):",
	"compress.cancel": "Cancel",
	"compress.confirm": "Compress",
	"rename.title": "Rename",
        "rename.description": "Enter a new name for {name} (one filename only; moving between folders is not allowed):",
	"rename.cancel": "Cancel",
	"rename.confirm": "Rename",
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
        "edit.formatStale": "Content changed during formatting; current edits were kept",
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
	"edit.wrap": "Wrap",
	"toast.cut": "Cut {count} items — right-click a directory or use the Paste button to paste",
	"toast.copied": "Copied {count} items — right-click a directory or use the Paste button to paste",
	"toast.pasted": "Pasted {count} items",
	"toast.moved": "Moved {count} items",
	"toast.deleted": "Deleted {count} items",
	"toast.compressed": "Compressed to {name}",
	"toast.compressedSkipped": "Compressed to {name} ({skipped} skipped)",
	"toast.renamed": "Renamed to {name}",
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
 *             workspaceRoot: string, sessionId?: string }} MenuState
 * @typedef {{ paths: string[], workspaceRoot: string }} DeleteRequest
 * @typedef {{ paths: string[], workspaceRoot: string, name: string }} CompressRequest
 * @typedef {{ path: string, workspaceRoot: string, name: string }} RenameRequest
 * @typedef {{ id: number, text: string, kind: "ok" | "error" }} ToastItem
 */
const state = {
	clipboard: /** @type {Clipboard | null} */ (null),
	selection: /** @type {Set<string>} */ (new Set()),
	menu: /** @type {MenuState | null} */ (null),
	deleteRequest: /** @type {DeleteRequest | null} */ (null),
	compressRequest: /** @type {CompressRequest | null} */ (null),
	renameRequest: /** @type {RenameRequest | null} */ (null),
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
		&& next.renameRequest === state.renameRequest
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

/** 规范宿主路径；参数为路径，返回统一反斜杠的 Windows 路径，POSIX 路径原样保留。 */
function normalizeHostPath(path) {
        const value = String(path);
        return isWindowsHostPath(value) ? value.replaceAll("/", "\\") : value;
}

/** 判断宿主路径格式；参数为路径，返回是否具有 Windows 盘符或反斜杠路径语义，不依赖浏览器系统。 */
function isWindowsHostPath(path) {
        const value = String(path);
        const drive = value[1] === ":" && "abcdefghijklmnopqrstuvwxyz".includes(value[0]?.toLowerCase());
        return drive || (!value.startsWith("/") && value.includes("\\"));
}

/** 获取根前缀长度；参数为规范路径与分隔符，返回保留盘符、共享目录及扩展 UNC 根的字符数。 */
function pathRootLength(value, separator) {
        switch (true) {
                case value.slice(0, 8).toUpperCase() === "\\\\?\\UNC\\": {
                        const serverEnd = value.indexOf("\\", 8);
                        const shareEnd = serverEnd < 0 ? -1 : value.indexOf("\\", serverEnd + 1);
                        return shareEnd < 0 ? value.length : shareEnd + 1;
                }
                case value.startsWith("\\\\?\\") && value[5] === ":" && value[6] === "\\":
                        return 7;
                case value.startsWith(separator + separator): {
                        const serverEnd = value.indexOf(separator, 2);
                        const shareEnd = serverEnd < 0 ? -1 : value.indexOf(separator, serverEnd + 1);
                        return shareEnd < 0 ? value.length : shareEnd + 1;
                }
                case value[1] === ":" && value[2] === separator: return 3;
                default: return value.startsWith(separator) ? 1 : 0;
        }
}

/** 解析浏览器宿主路径；参数为路径，返回规范路径、父目录与短名，保留盘符、UNC 和 POSIX 根。 */
function pathParts(path) {
        const value = normalizeHostPath(path);
        const separator = value.startsWith("/") || !value.includes("\\") ? "/" : "\\";
        const rootLength = pathRootLength(value, separator);
        let end = value.length;
        while (end > rootLength && value[end - 1] === separator) end -= 1;
        const normalized = value.slice(0, end);
        if (end <= rootLength) {
                const root = value.startsWith(separator + separator) && !normalized.endsWith(separator) ? normalized + separator : normalized;
                return { dirname: root, basename: "", normalized: root };
        }
        const index = normalized.lastIndexOf(separator);
        return {
                dirname: index < 0 ? "." : normalized.slice(0, Math.max(rootLength, index)),
                basename: normalized.slice(index + 1),
                normalized,
        };
}

/** 比较宿主路径；参数为两条路径，返回分隔符及末尾目录分隔符规范后是否一致，不擅自折叠大小写。 */
function sameHostPath(left, right) {
        return pathParts(left).normalized === pathParts(right).normalized;
}

/** 校验客户端重命名单段名称；参数为新名字与源路径，返回是否为空、含 NUL 或目标平台分隔符。 */
function invalidRenameName(name, path) {
        return name.trim() === "" || name === "." || name === ".." || name.includes("\0")
                || name.includes("/") || isWindowsHostPath(path) && name.includes("\\");
}

/** 获取父目录；参数为宿主路径，返回兼容 Windows/macOS/Linux 的目录字符串。 */
function dirnameOf(path) {
        return pathParts(path).dirname;
}

/** 获取短名；参数为宿主路径，返回文件名，不把 POSIX 名称中的反斜杠当分隔符。 */
function basenameOf(path) {
        return pathParts(path).basename;
}

// ─── 宿主请求 ─────────────────────────────────────────────────────────────
/** 请求宿主接口；参数为操作、请求体与可选取消信号，返回成功响应或抛错误。 */
async function api(operation, body, signal = undefined) {
	const response = await fetch(`${API}/${operation}`, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify(body),
                signal,
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok || payload.ok !== true) {
		const error = new Error(payload.message ?? `HTTP ${response.status}`);
		error.code = payload.code;
                error.details = payload.details;
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

/** Shift 范围选择的锚点行；只影响交互，不影响渲染，故不进 state。 */
let selectionAnchor = null;

/** 当前工作区可见行的路径序列（DOM 顺序即树的展开顺序，折叠行跳过）。 */
function visibleRowPaths() {
	const tree = currentTree();
	if (tree === null) return [];
	const out = [];
	for (const row of tree.querySelectorAll("[data-files-path][data-files-entry]")) {
		const entry = row.getAttribute("data-files-entry");
		if (entry !== "file" && entry !== "directory") continue;
		if (row.getClientRects().length === 0) continue;
		const path = row.getAttribute("data-files-path");
		if (path !== null) out.push(path);
	}
	return out;
}

/**
 * Shift+点击：选中锚点到目标行的连续区间；additive（Ctrl/Cmd+Shift）时并入
 * 已有选择。锚点缺失或已不在可见树里时退化为「只选目标行」。
 * 锚点本身不随 Shift+点击移动，符合文件管理器的一贯行为。
 * @returns 是否成功选中（目标行不在可见树里时为 false）。
 */
function selectRange(path, additive) {
	const paths = visibleRowPaths();
	const to = paths.indexOf(path);
	if (to < 0) return false;
	let from = selectionAnchor === null ? to : paths.indexOf(selectionAnchor);
	if (from < 0) from = to;
	const next = additive ? new Set(state.selection) : new Set();
	const [lo, hi] = from <= to ? [from, to] : [to, from];
	for (let i = lo; i <= hi; i++) next.add(paths[i]);
	setState({ selection: next });
	syncSelectionMarks();
	return true;
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

function requestRename(request) {
	setState({ renameRequest: request });
}

function settleRename() {
	if (state.renameRequest === null) return;
	setState({ renameRequest: null });
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

/**
 * 创建宿主兼容的工作区引用；参数为路径、工作区根和入口类型，返回引用卡片或 null。
 * Windows 分隔符只在引用语法中转换，POSIX 文件名中的反斜杠保持原样。
 */
function sessionReference(path, workspaceRoot, entry) {
	const value = pathParts(path).normalized;
	const root = pathParts(workspaceRoot).normalized;
	const separator = isWindowsHostPath(root) ? "\\" : "/";
	const prefix = root.endsWith(separator) ? root : root + separator;
	if (!value.startsWith(prefix)) return null;
	let relative = value.slice(prefix.length);
	if (separator === "\\") relative = relative.replaceAll("\\", "/");
	if (relative === "" || relative.split("/").some((part) => part === "." || part === ".." || part === "")) return null;
	for (const character of relative) {
		const code = character.codePointAt(0);
		if (character === '"' || code < 32 || code >= 127 && code <= 159) return null;
	}
	const directory = entry === "directory";
	const referencePath = relative + (directory ? "/" : "");
	const mention = referencePath.trim() !== referencePath || [...referencePath].some((character) => character.trim() === "")
		? `@"${referencePath}"` : `@${referencePath}`;
	return {
		source: "reference", ref: mention, clipboardText: mention,
		label: basenameOf(path) + (directory ? "/" : ""),
		appearance: directory ? "folder" : "file",
	};
}

/** 添加单项到会话草稿；参数为右键菜单快照，无返回值，失败不清除选择或覆盖草稿。 */
function addToSession(menu) {
	try {
		const ctx = sessionContext;
		const sessionId = sidebarRight?.mounted?.getSnapshot();
		if (ctx === null || !menu.sessionId || menu.sessionId !== sessionId) throw new Error(t("toast.sessionUnavailable"));
		const scope = ctx.sessions.scope(sessionId);
		const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
		if (!scope || !cwd || !sameHostPath(cwd, menu.workspaceRoot)) throw new Error(t("toast.sessionUnavailable"));
		const reference = sessionReference(menu.path, menu.workspaceRoot, menu.entry);
		if (reference === null) throw new Error(t("toast.referenceInvalid"));
		const input = ctx.conversation.input.for(scope);
		const span = input.actions.captureInsertion();
		if (!input.insertReference(reference, { ...span, start: span.end })) throw new Error(t("toast.sessionBusy"));
		clearSelection();
		input.focus();
		pushToast(t("toast.addedToSession", { name: basenameOf(menu.path) }));
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

/** 复制路径到系统剪贴板；参数为路径数组，无返回值，规范 Windows 分隔符，成功后清除多选。 */
function copyPaths(paths) {
        void writeClipboard(paths.map(normalizeHostPath).join("\n")).then((ok) => {
		if (ok) clearSelection();
		pushToast(ok ? t("toast.pathCopied") : t("toast.clipboardFailed"), ok ? "ok" : "error");
	});
}

/** 粘贴到目标目录；参数为目标及工作区路径，无返回值，拒绝跨工作区并保留后来替换的剪贴板。 */
function pasteInto(destination, workspaceRoot) {
	const clipboard = state.clipboard;
	if (clipboard === null || destination === null || destination === "") return;
        if (workspaceRoot == null || !sameHostPath(workspaceRoot, clipboard.workspaceRoot)) return;
	const operation = clipboard.mode === "cut" ? "move" : "copy";
	api(operation, { workspaceRoot, sources: clipboard.paths, destination }).then(() => {
		pushToast(t(clipboard.mode === "cut" ? "toast.moved" : "toast.pasted", { count: clipboard.paths.length }));
                if (clipboard.mode === "cut" && state.clipboard === clipboard) setClipboard(null);
	}).catch((error) => {
                if (clipboard.mode === "cut" && state.clipboard === clipboard && Array.isArray(error.details?.completed)) {
                        const remaining = clipboard.paths.filter((path) => !error.details.completed.some((done) => sameHostPath(path, done)));
                        setClipboard(remaining.length === 0 ? null : { ...clipboard, paths: remaining });
                }
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

/** 打开重命名对话框（右键「重命名」/ F2），预填当前名字。 */
function renamePath(path, workspaceRoot = currentTreeRoot()) {
	if (workspaceRoot === null || path === null || path === "") return;
	requestRename({ path, workspaceRoot, name: basenameOf(path) });
}

/** 重命名确认后发宿主请求；参数为源请求及原始新名字，无返回值，保留合法空格，成功后清除多选。 */
function performRename(request, rawName) {
        const name = String(rawName ?? "");
        if (invalidRenameName(name, request.path) || name === request.name) return;
	api("rename", { workspaceRoot: request.workspaceRoot, path: request.path, name }).then((payload) => {
		clearSelection();
		pushToast(t("toast.renamed", { name: payload.name }));
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
	// 旧版 Menu 测量自身外层 span；固定其布局位置，避免只定位内部 anchor 后外层仍留在原点。
	return h("div", { "data-dfa-ui": "menu", style: { position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0, display: "flex", pointerEvents: "none" } },
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
							targets.length === 1 && h(MenuItemButton, {
								icon: h(IconLinkOutlineRegular, { size: 14 }),
								onSelect: () => {
									closeMenu();
									addToSession(menu);
								},
								children: t("menu.addToSession"),
							}),
				// 重命名：文件与目录都适用，且只在单目标时出现（多选重命名语义不明）
				targets.length === 1 && menu.path !== null && h(MenuItemButton, {
					icon: h(IconListPenOutlineRegular, { size: 14 }),
					onSelect: () => {
						closeMenu();
						renamePath(targets[0], menu.workspaceRoot);
					},
					children: t("menu.rename"),
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
		// 重命名只对单选项出现（多选重命名语义不明）
		paths.length === 1 && barButton(IconListPenOutlineRegular, t("menu.rename"), () => renamePath(paths[0])),
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

// ─── 重命名输入框 ─────────────────────────────────────────────────────────
function RenameDialog() {
	const request = useStore((s) => s.renameRequest);
	const [name, setName] = useState("");
	const inputRef = useRef(null);
	useEffect(() => {
		if (request === null) return;
		setName(request.name);
		const frame = requestAnimationFrame(() => {
			const input = inputRef.current;
			if (input === null) return;
			input.focus();
			// 预选主名（不含扩展名），与资源管理器的 F2 行为一致
			const dot = request.name.lastIndexOf(".");
			input.setSelectionRange(0, dot > 0 ? dot : request.name.length);
		});
		return () => cancelAnimationFrame(frame);
	}, [request]);
        const next = name;
        const invalid = invalidRenameName(next, request?.path ?? "");
	const confirm = () => {
		const pending = request;
		if (pending === null || invalid) return;
		settleRename();
		performRename(pending, next);
	};
	return h(Modal, {
		open: request !== null,
		title: t("rename.title"),
		onClose: settleRename,
		footer: h(Fragment, { children: [
			h(Button, { variant: "outline", onClick: settleRename, children: t("rename.cancel") }),
			h(Button, { variant: "primary", disabled: invalid, onClick: confirm, children: t("rename.confirm") }),
		] }),
		children: h("div", { className: "dfa-rename" }, [
			h("p", { className: "dfa-rename-desc", children: request === null ? "" : t("rename.description", { name: request.name }) }),
			h("input", {
				ref: inputRef,
				className: "dfa-rename-input",
				type: "text",
				value: name,
				spellCheck: false,
				onChange: (event) => setName(event.currentTarget.value),
				onKeyDown: (event) => {
					if (event.key === "Enter") {
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

/** 生成编辑标签地址；参数为工作区及文件路径，返回分隔符规范后的唯一资源地址。 */
function editAddress(workspaceRoot, path) {
        return `${EDIT_PREFIX}${encodeURIComponent(pathParts(workspaceRoot).normalized)}/${encodeURIComponent(pathParts(path).normalized)}`;
}

/** 解析编辑标签地址；参数为资源地址，返回规范后的工作区与路径，非法地址返回 null。 */
function parseEditAddress(address) {
        if (!String(address).startsWith(EDIT_PREFIX)) return null;
	const rest = String(address).slice(EDIT_PREFIX.length);
	const sep = rest.indexOf("/");
	if (sep < 0) return null;
	try {
		return {
                        workspaceRoot: pathParts(decodeURIComponent(rest.slice(0, sep))).normalized,
                        path: pathParts(decodeURIComponent(rest.slice(sep + 1))).normalized,
		};
	} catch {
		return null;
	}
}

/** 对选区跨行做缩进/反缩进；无选区时在光标处插入两个空格。
 *  返回新内容与新选区（React 提交后由调用方恢复，避免受控 textarea 重置光标）。 */
function applyIndent(content, textarea, delta) {
	const start = textarea.selectionStart ?? content.length;
	const end = textarea.selectionEnd ?? start;
	if (start === end) {
		return {
			next: content.slice(0, start) + "  " + content.slice(end),
			selStart: start + 2,
			selEnd: start + 2,
		};
	}
	const lineStart = content.lastIndexOf("\n", start - 1) + 1;
	const rawEnd = content.indexOf("\n", end - 1);
	const blockEnd = rawEnd === -1 ? content.length : rawEnd;
	const block = content.slice(lineStart, blockEnd);
	const lines = block.split("\n");
	// 每行的位移：缩进 +2；反缩进去掉最多 2 个行首空格。
	const shifts = lines.map((line) => (delta > 0 ? 2 : -Math.min(2, /^ */.exec(line)[0].length)));
	const shifted = lines.map((line, i) => (delta > 0 ? "  " + line : line.replace(/^ {1,2}/, ""))).join("\n");
	// start/end 所在行（block 内，0 基）：数换行符。
	const beforeStart = block.slice(0, start - lineStart);
	const beforeEnd = block.slice(0, end - lineStart);
	const lineA = (beforeStart.match(/\n/g) ?? []).length;
	const lineB = (beforeEnd.match(/\n/g) ?? []).length;
	const startAtLineStart = start === lineStart || content.charCodeAt(start - 1) === 10;
	// 选区起点：恰在行首时，该行插入发生在起点之后，起点不动；否则随本行位移。
	const selStart = start + (startAtLineStart ? 0 : shifts[lineA]);
	// 选区终点：a..b 各行的插入点都落在 [start, end] 内，全部计入。
	let selEnd = start + (end - start);
	for (let i = lineA; i <= lineB; i++) selEnd += shifts[i];
	return { next: content.slice(0, lineStart) + shifted + content.slice(blockEnd), selStart, selEnd };
}

/** React 提交后再恢复 textarea 选区（双 rAF，受控 textarea 值重置后仍有效）。 */
function setSelectionAfterCommit(element, start, end) {
	requestAnimationFrame(() => requestAnimationFrame(() => {
		if (element !== null) {
			element.setSelectionRange(start, end);
			element.focus();
		}
	}));
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

/** 编辑器排版常量：三层的 font-size 与 line-height 必须完全一致（CSS 同步声明）。 */
const EDIT_FONT_SIZE = 13;
const EDIT_LINE_HEIGHT = 20;
const EDIT_PAD_TOP = 8;
const EDIT_PAD_LEFT = 12;
/** 可见窗口上下各多渲染的行数下限（overscan 缓冲，滚动时减少空白与解析抖动）。 */
const EDIT_OVERSCAN_MIN = 20;
/** 超过该长度的行跳过 shiki 解析（渲染为纯文本）：压缩代码等超长行是卡顿主因。 */
const LONG_LINE_MAX = 4000;
/** wrap 模式整文件高亮的内容上限（超过降级纯文本）。 */
const WRAP_HIGHLIGHT_MAX = 200000;
/** 高亮层/行号栏高度上限（防病态行数撑爆布局）。 */
const MAX_LAYER_HEIGHT = 30000000;

/** 某行（0 基）的 token 序列按查找区间切分渲染。 */
function renderLineTokens(lineTokens, lineStart, marks) {
	const nodes = [];
	let index = lineStart;
	for (const token of lineTokens) {
		nodes.push(...markedToken(token.text, index, marks, token.style));
		index += token.text.length;
	}
	return nodes;
}

/** 编辑态实时高亮：透明文字 textarea 叠在 shiki（DSH 自带）高亮层上，滚动/排版完全同步。
 *  行号/高亮层只渲染可见窗口，shiki 也只解析可见窗口（大文件同样有高亮且不卡）。 */
function HighlightEditor({ content, language, onContent, onSave, onOpenFind, onOpenReplace, onOpenGoto, findText, caseSensitive, findIndex, inputRef, onContextMenu, wrap }) {
	const highlight = useCodeHighlighter(language);
	const [scroll, setScroll] = useState({ left: 0, top: 0 });
	const [viewport, setViewport] = useState({ width: 0, height: 0 });
	useLayoutEffect(() => {
		const el = inputRef.current;
		if (el === null) return;
		const disposers = [];
		const measure = () => {
			const h = el.clientHeight;
			setViewport((current) => (
				Math.abs(current.height - h) > 1 || Math.abs(current.width - el.clientWidth) > 1
					? { width: el.clientWidth, height: h }
					: current
			));
		};
		// 原生 scroll 监听（不依赖 React 事件委托），顺带校准视口尺寸。
		const onScrollNative = () => {
			measure();
			setScroll((current) => (
				current.left === el.scrollLeft && current.top === el.scrollTop
					? current
					: { left: el.scrollLeft, top: el.scrollTop }
			));
		};
		el.addEventListener("scroll", onScrollNative, { passive: true });
		window.addEventListener("resize", measure);
		// 尺寸兜底：tab 隐藏/显示、分栏调整时自动重测（滚动监听之外的独立来源）。
		if (typeof ResizeObserver !== "undefined") {
			const observer = new ResizeObserver(measure);
			observer.observe(el);
			disposers.push(() => observer.disconnect());
		}
		// 挂载后校准三帧（布局稳定后拿到真实高度）。
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
			for (const dispose of disposers) dispose();
		};
	}, []);
	// 防抖高亮：输入流畅，高亮层稍后跟上。
	const [highlightContent, setHighlightContent] = useState(content);
	useEffect(() => {
		const timer = setTimeout(() => setHighlightContent(content), 120);
		return () => clearTimeout(timer);
	}, [content]);
	// 行首偏移（供命中标记换算全局偏移）。
	const lineStarts = useMemo(() => {
		const starts = [0];
		for (let i = 0; ;) {
			const nl = highlightContent.indexOf("\n", i);
			if (nl === -1) break;
			starts.push(nl + 1);
			i = nl + 1;
		}
		return starts;
	}, [highlightContent]);
	const lineCount = useMemo(() => {
		let count = 1;
		for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) count += 1;
		return count;
	}, [content]);
	// 渲染时直接读 DOM 真相：不依赖测量时机（ResizeObserver/首帧竞态都免疫）。
	const viewportH = Math.max(viewport.height, inputRef.current?.clientHeight ?? 0, 1);
	const firstLine = Math.min(Math.floor(scroll.top / EDIT_LINE_HEIGHT), Math.max(lineCount - 1, 0));
	const lastLine = Math.min(lineCount - 1, firstLine + Math.ceil(viewportH / EDIT_LINE_HEIGHT) + 1);
	// overscan：可见窗口上下各多渲染/解析一段缓冲，小距离滚动不产生空白、
	// 不重算 token（窗口未越出缓冲区时 useMemo 直接复用上次结果）。
	const overscan = Math.max(EDIT_OVERSCAN_MIN, Math.ceil(viewportH / EDIT_LINE_HEIGHT / 2));
	const renderFirst = Math.max(0, firstLine - overscan);
	const renderLast = Math.min(lineCount - 1, lastLine + overscan);
	const renderLines = [];
	for (let i = renderFirst; i <= renderLast; i++) renderLines.push(i);
	// 只解析渲染窗口（可见区 + 上下缓冲）：大文件高亮成本与文件大小无关。
	const tokens = useMemo(() => {
		if (highlight === undefined || highlight === null) return null;
		if (wrap) {
			if (highlightContent.length > WRAP_HIGHLIGHT_MAX) return null;
			const lines = highlight(highlightContent);
			return lines === undefined ? null : { lines };
		}
		// 窗口内超长行替换为空行参与解析（保持行数对齐），渲染时回退纯文本。
		const sliceLines = [];
		const longFlags = [];
		for (let i = renderFirst; i <= renderLast; i++) {
			const endIndex = lineStarts[i + 1] ?? highlightContent.length + 1;
			const text = highlightContent.slice(lineStarts[i] ?? 0, endIndex - 1);
			const long = text.length > LONG_LINE_MAX;
			sliceLines.push(long ? "" : text);
			longFlags.push(long);
		}
		const slice = sliceLines.join("\n");
		const lines = highlight(slice);
		return lines === undefined ? null : { lines: lines.map((line, index) => (longFlags[index] ? null : line)) };
	}, [highlight, highlightContent, lineStarts, renderFirst, renderLast, wrap]);
	// 查找命中标记（基于高亮层内容，保证与可见文本对齐）。
	const marks = useMemo(() => {
		const matches = findMatchesIn(highlightContent, findText, caseSensitive);
		const current = Math.min(Math.max(findIndex, 0), matches.length - 1);
		return matches.map((match, i) => ({ ...match, current: i === current }));
	}, [highlightContent, findText, caseSensitive, findIndex]);
	return h("div", { className: "dfa-code-editor" }, [
		!wrap && h("div", { className: "dfa-code-gutter", "aria-hidden": "true" }, [
			h("div", { className: "dfa-code-gutter-canvas", style: { height: Math.min(EDIT_PAD_TOP + lineCount * EDIT_LINE_HEIGHT, MAX_LAYER_HEIGHT), transform: `translateY(${-scroll.top}px)` } },
				renderLines.map((i) => h("span", {
					key: i,
					className: "dfa-code-gutter-num",
					style: { top: EDIT_PAD_TOP + i * EDIT_LINE_HEIGHT },
					children: String(i + 1),
				}))),
		]),
		h("div", { className: "dfa-code-viewport" }, [
			wrap ? h("pre", {
				className: "dfa-code-highlight dfa-code-wrap",
				"aria-hidden": "true",
				style: { transform: `translate(${-scroll.left}px, ${-scroll.top}px)` },
				children: tokenNodes(tokens?.lines ?? null, highlightContent, marks),
			}) : h("pre", {
				className: "dfa-code-highlight",
				"aria-hidden": "true",
				style: { height: Math.min(EDIT_PAD_TOP + lineStarts.length * EDIT_LINE_HEIGHT + 48, MAX_LAYER_HEIGHT), transform: `translate(${-scroll.left}px, ${-scroll.top}px)` },
				children: renderLines.map((i) => {
					const lineTokens = tokens?.lines?.[i - renderFirst];
					const plain = highlightContent.slice(lineStarts[i] ?? 0, (lineStarts[i + 1] ?? highlightContent.length + 1) - 1);
					const line = lineTokens !== undefined && lineTokens !== null
						? renderLineTokens(lineTokens, lineStarts[i] ?? 0, marks)
						: renderLineTokens([{ text: plain, style: null }], lineStarts[i] ?? 0, marks);
					return h("span", {
						key: i,
						className: "dfa-code-line",
						style: { top: EDIT_PAD_TOP + i * EDIT_LINE_HEIGHT, left: EDIT_PAD_LEFT },
						children: line,
					});
				}),
			}),
h("textarea", {
				ref: inputRef,
				className: wrap ? "dfa-code-input dfa-code-input-wrap" : "dfa-code-input",
				value: content,
				spellCheck: false,
				wrap: wrap ? "soft" : "off",
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
        const [content, setContentState] = useState("");
	const [original, setOriginal] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const [confirmingReload, setConfirmingReload] = useState(false);
	const [wrap, setWrap] = useState(false);
	const [bar, setBar] = useState(null); // null | "find" | "replace" | "goto"
	const [findText, setFindText] = useState("");
	const [replaceText, setReplaceText] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [findIndex, setFindIndex] = useState(0);
	const [gotoText, setGotoText] = useState("");
	const [menuAt, setMenuAt] = useState(null); // 编辑框右键菜单坐标
	const inputRef = useRef(null);
	const dirtyRef = useRef(false);
        const contentRef = useRef("");
        const revisionRef = useRef(0);
        const requestRef = useRef(0);
        const readControllerRef = useRef(null);
        const versionRef = useRef(undefined);
        const savingRef = useRef(false);
        const formatRef = useRef(0);
        const addressRef = useRef(tab.contentId);
        addressRef.current = tab.contentId;
        /** 同步跟踪每次内容修改；参数为文本或更新函数，无返回值。 */
        const setContent = (next) => {
                const value = typeof next === "function" ? next(contentRef.current) : next;
                contentRef.current = value;
                revisionRef.current += 1;
                setContentState(value);
        };
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

        /** 加载当前文件；取消旧读取并忽略过期结果，无参数及返回值。 */
        const load = () => {
                if (parsed === null || savingRef.current) return;
                readControllerRef.current?.abort();
                const controller = new AbortController();
                readControllerRef.current = controller;
                const request = ++requestRef.current;
                const address = tab.contentId;
                formatRef.current += 1;
                versionRef.current = undefined;
		setLoaded(false);
		setError(null);
		setConfirmingReload(false);
                api("read", { workspaceRoot: parsed.workspaceRoot, path: parsed.path }, controller.signal).then((payload) => {
                        if (request !== requestRef.current || address !== addressRef.current) return;
			setContent(payload.content);
			setOriginal(payload.content);
                        versionRef.current = payload.version;
			setLoaded(true);
		}).catch((readError) => {
                        if (controller.signal.aborted || request !== requestRef.current || address !== addressRef.current) return;
			setError(readError.message);
		});
	};
	useEffect(() => {
                savingRef.current = false;
                setSaving(false);
		load();
                return () => {
                        readControllerRef.current?.abort();
                        requestRef.current += 1;
                        formatRef.current += 1;
                };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [parsed?.workspaceRoot, parsed?.path]);
	useEffect(() => {
		tab.actions.bindCommands({ refresh: load });
		// eslint-disable-next-line react-hooks/exhaustive-deps
        }, [tab.actions, parsed?.workspaceRoot, parsed?.path]);
        useEffect(() => {
                /** 页面关闭时保护未保存内容；参数为浏览器事件，无返回值。 */
                const beforeUnload = (event) => {
                        if (!dirtyRef.current) return;
                        event.preventDefault();
                        event.returnValue = "";
                };
                window.addEventListener("beforeunload", beforeUnload);
                return () => window.removeEventListener("beforeunload", beforeUnload);
        }, []);
	// 关闭 tab 时若还有未保存修改，提示用户。
	useEffect(() => () => {
		if (dirtyRef.current && name !== "") pushToast(translate("edit.closedUnsaved", { name }));
	}, []);

        /** 保存请求快照并更新版本；忽略已关闭或已切换文件的响应，无参数及返回值。 */
        const save = () => {
                if (parsed === null || !loaded || savingRef.current) return;
                savingRef.current = true;
		setSaving(true);
                const snapshot = contentRef.current;
                const request = requestRef.current;
                const address = tab.contentId;
                api("save", { workspaceRoot: parsed.workspaceRoot, path: parsed.path, content: snapshot, version: versionRef.current }).then((payload) => {
                        if (request !== requestRef.current || address !== addressRef.current) return;
                        savingRef.current = false;
			setSaving(false);
                        versionRef.current = payload.version;
                        setOriginal(snapshot);
			pushToast(translate("edit.saved", { name }));
		}).catch((saveError) => {
                        if (request !== requestRef.current || address !== addressRef.current) return;
                        savingRef.current = false;
			setSaving(false);
			pushToast(saveError.message, "error");
		});
	};
        /** 格式化内容快照；仅在文件和编辑版本未变化时应用，无参数及返回值。 */
        const format = () => {
		if (parsed === null || !loaded) return;
                const revision = revisionRef.current;
                const request = requestRef.current;
                const sequence = ++formatRef.current;
                const address = tab.contentId;
                api("format", { workspaceRoot: parsed.workspaceRoot, path: parsed.path, content: contentRef.current }).then((payload) => {
                        if (sequence !== formatRef.current || request !== requestRef.current || address !== addressRef.current) return;
                        if (revision !== revisionRef.current) {
                                pushToast(translate("edit.formatStale"));
                                return;
                        }
			setContent(payload.content);
			pushToast(translate("edit.formatted"));
		}).catch((formatError) => {
                        if (sequence !== formatRef.current || request !== requestRef.current || address !== addressRef.current) return;
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
                const request = requestRef.current;
                const address = tab.contentId;
		void navigator.clipboard.readText().then((text) => {
                        if (request !== requestRef.current || address !== addressRef.current) return;
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? start;
                        const current = contentRef.current;
                        setContent(current.slice(0, start) + text + current.slice(end));
			setSelectionAfterCommit(el, start + text.length, start + text.length);
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
				h("button", {
					type: "button",
					className: wrap ? "dfa-editor-btn dfa-editor-btn-active" : "dfa-editor-btn",
					"aria-pressed": wrap,
					title: translate("edit.wrap"),
					onClick: () => setWrap((value) => !value),
					children: translate("edit.wrap"),
				}),
				editorButton(translate("edit.reload"), () => {
					if (dirty) setConfirmingReload(true);
					else load();
                                }, h(IconRefreshOutlineRegular, { size: 14 }), saving),
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
				wrap,
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
		menuAt !== null && h("div", {
			"data-dfa-ui": "menu",
			// 与文件列表菜单相同，兼容通过外层 span 测量锚点的旧版 Menu。
			style: { position: "fixed", left: menuAt.x, top: menuAt.y, width: 0, height: 0, display: "flex", pointerEvents: "none" },
		}, h(Menu, {
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
		})),
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
.dfa-compress-desc,
.dfa-rename-desc {
	margin: 0 0 10px;
	color: var(--dsw-alias-label-secondary);
	font-size: 13px;
	line-height: 1.5;
}
.dfa-compress-input,
.dfa-rename-input {
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
.dfa-compress-input:focus,
.dfa-rename-input:focus {
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
.dfa-editor-btn-active,
.dfa-editor-btn-active:hover {
	color: var(--dsw-alias-label-primary);
	background: var(--dsw-alias-interactive-bg-hover);
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
	width: 14px;
	height: 12px;
}
.dfa-code-input::-webkit-scrollbar-track {
	background: transparent;
}
.dfa-code-input::-webkit-scrollbar-thumb {
	background: var(--dsw-alias-scrollbar-hover-l2, var(--dsw-alias-label-caption, #66778c));
	border-radius: 7px;
	border: 3px solid transparent;
	background-clip: padding-box;
}
.dfa-code-input::-webkit-scrollbar-thumb:hover {
	background: var(--dsw-alias-label-secondary, #8899aa);
	background-clip: padding-box;
}
.dfa-code-input-wrap {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	word-break: break-word;
}
.dfa-code-wrap {
	box-sizing: border-box;
	width: calc(100% - 14px);
	min-width: calc(100% - 14px);
	padding: 8px 12px 48px;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	word-break: break-word;
}
.dfa-code-input {
	scrollbar-width: auto;
	scrollbar-color: var(--dsw-alias-scrollbar-hover-l2, var(--dsw-alias-label-caption, #66778c)) transparent;
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
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "file-actions-rename-dialog",
		locale: NS,
		inject: () => ({}),
	}, RenameDialog));
	sidebarRight = ctx.sidebarRight;
	sidebarRightTabs = ctx.sidebarRightTabs;
		sessionContext = ctx;
		ctx.effect(() => () => {
			if (sessionContext === ctx) sessionContext = null;
		}, "file-actions: session reference cleanup");
	// 文件编辑 tab 类型：仅在显式指定 kind 时打开（patterns 只匹配本插件的
	// file-edit 地址，不影响普通文件点击 → 官方预览）。
	ctx.effect(() => sidebarRightTabs.register({
		id: EDIT_ID,
		kind: EDIT_KIND,
		patterns: ["dsh-resource://file-edit/**"],
		priority: "fallback",
		keepMounted: true,
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
				openMenu({ x: event.clientX, y: event.clientY, path, entry, scope: "row", workspaceRoot, sessionId: sidebarRight?.mounted?.getSnapshot() });
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
			const row = target.closest("[data-files-path]");
			const tree = target.closest('[data-files-state="tree"]');
			/** 该行对应的可操作路径（"other" 类入口返回 null）。 */
			const rowPathOf = () => {
				if (row === null || tree === null) return null;
				const entry = row.getAttribute("data-files-entry");
				if (entry !== "file" && entry !== "directory") return null;
				return row.getAttribute("data-files-path");
			};
			const rowPath = rowPathOf();
			// Shift+点击：选中锚点到该行的连续区间（Ctrl/Cmd+Shift 并入已有选择）。
			if (event.shiftKey && rowPath !== null) {
				event.preventDefault();
				event.stopPropagation();
				if (selectRange(rowPath, event.ctrlKey || event.metaKey) && selectionAnchor === null) selectionAnchor = rowPath;
				return;
			}
			if (event.ctrlKey || event.metaKey) {
				if (rowPath !== null) {
					event.preventDefault();
					event.stopPropagation();
					toggleSelect(rowPath);
					selectionAnchor = rowPath;
				}
				return;
			}
			// 无修饰键：普通点击行或点击文件树之外 → 清空多选（不阻止默认行为）。
			if (row !== null) {
				if (rowPath !== null) selectionAnchor = rowPath;
				clearSelection();
				return;
			}
			if (tree === null) clearSelection();
		};
		const onKeyDown = (event) => {
			if (event.key !== "Escape" && event.key !== "Delete" && event.key !== "Backspace" && event.key !== "F2") return;
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
			if (snapshot.selection.size === 0 || !snapshot.treeVisible) return;
			const root = currentTreeRoot();
			if (root === null) return;
			if (event.key === "F2") {
				// 重命名只对单选项开放（多选重命名语义不明，故不提供）
				if (snapshot.selection.size !== 1) return;
				event.preventDefault();
				renamePath([...snapshot.selection][0], root);
				return;
			}
			event.preventDefault();
			requestDelete({ paths: [...snapshot.selection], workspaceRoot: root });
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
					selectionAnchor = null;
					closeMenu();
					if (readState().clipboard !== null) setClipboard(null);
					return;
				}
				syncSelectionMarks();
				syncCutMarks();
				const clipboard = readState().clipboard;
				const root = currentTreeRoot();
                                if (clipboard !== null && (root === null || !sameHostPath(root, clipboard.workspaceRoot))) setClipboard(null);
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
export const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight", "sessions", "conversation"];
