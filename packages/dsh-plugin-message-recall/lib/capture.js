/**
 * dsh-plugin-message-recall 变更捕获纯逻辑：在文件工具执行前，把目标路径的
 * 「变更前」内容按轮次记录下来，供撤回时还原。
 *
 * 本模块只依赖 Node 内置模块，可脱离 Cordis 单独测试。
 *
 * - mutationPath：与官方 dsh-workspace-changes 相同的判定口径——只捕获
 *   `write`、`edit` 以及有修改作用的 `str_replace_editor` 命令；读取类调用
 *   与参数不完整的调用不捕获；
 * - canonicalPath：尽量解析符号链接得到稳定路径；文件尚不存在时退回到
 *   最近存在祖先 + 剩余路径段；
 * - captureFileAt：读取目标路径当前内容，返回 `content`（有内容）、
 *   `absent`（不存在）或 `oversized`（超过上限，无法还原）；
 * - 持久化形态：`$DASH_HOME/dsh-message-recall/<编码会话 id>/turn-<轮次>.json`，
 *   每轮一个文件，`{ turn, captures: { [绝对路径]: Capture } }`。
 *
 * @module dsh-plugin-message-recall/capture
 */
import { readFile } from "node:fs/promises";
import { realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** 捕获形态：文件存在且不超过上限时存全文；不存在时标记 absent；超大标记 oversized。 */
/** @typedef {{ kind: 'content', content: string } | { kind: 'absent' } | { kind: 'oversized' }} Capture */

/**
 * 复刻官方 dsh-workspace-changes 的 mutationPath 判定：返回一次文件工具调用
 * 即将修改的模型面向路径（相对路径按会话 cwd 解析），不修改的调用返回 undefined。
 *
 * @param {string} name - 线上工具名。
 * @param {unknown} args - 已解析的调用参数。
 * @returns {string | undefined}
 */
export function mutationPath(name, args) {
	if (typeof args !== "object" || args === null || Array.isArray(args)) return undefined;
	const record = args;
	switch (name) {
		case "write": return typeof record.content === "string" ? text(record.file_path) : undefined;
		case "edit": return typeof record.old_string === "string" && typeof record.new_string === "string" ? text(record.file_path) : undefined;
		case "str_replace_editor":
			return record.command === "create" || record.command === "str_replace" || record.command === "insert" ? text(record.path) : undefined;
		default: return undefined;
	}
}

function text(value) {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * 尽量把路径解析为规范（符号链接展开后的）绝对路径；文件尚不存在时退回
 * 最近存在的祖先目录。
 *
 * @param {string} absolute - 已拼接好的绝对路径。
 * @returns {Promise<string>}
 */
export async function canonicalPath(absolute) {
	try {
		return await realpath(absolute);
	} catch {
		let current = dirname(absolute);
		const rest = [basename(absolute)];
		for (;;) {
			try {
				const base = await realpath(current);
				return join(base, ...rest.reverse());
			} catch {
				rest.push(basename(current));
				const parent = dirname(current);
				if (parent === current) return absolute;
				current = parent;
			}
		}
	}
}

/**
 * 读取一个路径的当前状态，作为「变更前」捕获。
 *
 * @param {string} absolute - 规范绝对路径。
 * @param {number} maxFileBytes - 内容字节上限（含）。
 * @returns {Promise<Capture | undefined>} 既非文件也不存在（如目录）时为 undefined。
 */
export async function captureFileAt(absolute, maxFileBytes) {
	let content;
	try {
		content = await readFile(absolute);
	} catch (error) {
		if (error.code === "ENOENT") return { kind: "absent" };
		if (error.code === "EISDIR" || error.code === "ENOTDIR") return undefined;
		throw error;
	}
	if (content.length > maxFileBytes) return { kind: "oversized" };
	return { kind: "content", content: content.toString("utf8") };
}

/**
 * 官方 dsh-session-persistence-jsonl 的路径段编码（encodeSegment）复刻：
 * 用于在 captures 根目录下定位某会话的捕获目录。与 dsh-plugin-repo 的
 * session-archive 保持一致。
 *
 * @param {string} raw - 原始会话 id。
 * @returns {string} 安全的单级目录名。
 */
export function encodeSessionSegment(raw) {
	const text = String(raw);
	if (text.length === 0) throw new Error("session segment must not be empty");
	if (text === ".") return "~002E";
	if (text === "..") return "~002E~002E";
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		const ch = text[i];
		if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
		else out += "~" + code.toString(16).toUpperCase().padStart(4, "0");
	}
	return out;
}

/**
 * 合并磁盘与内存中的轮次捕获：`{ [轮次]: { [路径]: Capture } }`。
 * 同一轮次冲突时以内存（新写入）为准，磁盘保留旧轮次。
 *
 * @param {Record<string, Record<string, Capture>>} disk - 磁盘捕获。
 * @param {Record<string, Record<string, Capture>>} memory - 内存捕获。
 * @returns {Record<string, Record<string, Capture>>}
 */
export function mergeTurnCaptures(disk, memory) {
	const merged = {};
	for (const turn of Object.keys(disk ?? {})) {
		const paths = {};
		for (const path of Object.keys(disk[turn] ?? {})) paths[path] = disk[turn][path];
		merged[turn] = paths;
	}
	for (const turn of Object.keys(memory ?? {})) {
		const paths = merged[turn] ?? {};
		for (const path of Object.keys(memory[turn] ?? {})) paths[path] = memory[turn][path];
		merged[turn] = paths;
	}
	return merged;
}
