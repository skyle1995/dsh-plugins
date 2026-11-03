/**
 * dsh-plugin-file-actions —— 文件操作服务：复制 / 剪切（移动）/ 重命名 / 删除 /
 * 压缩 / 文本编辑（读取 / 保存 / 一键格式化）。
 *
 * 设计要点：
 * - 服务键 `fileActions`（ctx.fileActions），注入 fs / sessions / sandboxPolicy
 *   （标准 profile 均提供，与官方 workspaceFiles 服务相同的注入面）；
 * - 全部写操作都约束在「会话工作区」内：客户端只提交工作区绝对路径
 *   （浏览器文件树 DOM 里的 data-files-path），宿主用 fs.resolve + fs.contains
 *   逐条校验，越界一律拒绝；工作区根目录本身禁止删除/移动；
 * - 复制/移动目标必须是工作区内已存在的目录，同名冲突报
 *   file-actions/exists；跨设备移动（EXDEV）自动退化为复制 + 删除；
 * - 重命名只接受单段新名字（路径分隔符 / 空名 / "." / ".." 一律拒绝），
 *   在自身目录内生效，文件与目录均可；仅改大小写时按同一 inode 放行；
 * - 压缩用自带的 ZIP 写入器（lib/zip.js，无第三方依赖，deflate + CRC32）；
 * - 文本编辑的读取/保存受 maxEditBytes 上限约束（默认 1MB），拒绝含 NUL
 *   的非文本文件；一键格式化由 prettier 按扩展名推断 parser（babel /
 *   typescript / json / css / html / vue / markdown / yaml / graphql 等）；
 * - 浏览器半区经 Web 组合的 webServer 消费 /api/dsh-file-actions 路由。
 *
 * @module dsh-plugin-file-actions
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { cp, lstat, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { format as prettierFormat } from "prettier";
import { createZipBuffer } from "./zip.js";

/** 浏览器半区使用的 HTTP 路由前缀。 */
export const FILE_ACTIONS_API = "/api/dsh-file-actions";

/** 默认单文件压缩上限（字节）。 */
export const DEFAULT_MAX_ZIP_FILE_BYTES = 256 * 1024 * 1024;

/** 默认文本编辑文件大小上限（字节）。 */
export const DEFAULT_MAX_EDIT_BYTES = 1024 * 1024;

/** 带错误码的文件操作失败，code 形如 `file-actions/<kind>`。 */
export class FileActionsError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "FileActionsError";
		this.code = code;
	}
}

/** 生成压缩包文件名：单源用 `<name>.zip`，多源用 `archive.zip`。 */
export function zipNameFor(sourceNames) {
	if (sourceNames.length === 1) return `${basename(sourceNames[0])}.zip`;
	return "archive.zip";
}

/**
 * 规范化客户端提交的压缩包名：剥掉任何目录部分（防路径穿越），
 * 缺省 .zip 后缀自动补上；空名 / "." / ".." 返回空串（调用方回退预设名）。
 */
export function sanitizeZipName(name) {
	const value = String(name ?? "").trim().replace(/\\/g, "/");
	const base = value.split("/").pop() ?? "";
	if (base === "" || base === "." || base === "..") return "";
	if (!base.toLowerCase().endsWith(".zip")) return `${base}.zip`;
	return base;
}

/**
 * 规范化重命名提交的新名字：只接受单段名称（不含路径分隔符），
 * 非空、非 "." / ".."、不含 NUL；非法输入抛 FileActionsError。
 */
export function sanitizeEntryName(name) {
	const value = String(name ?? "").trim();
	if (value === "") throw new FileActionsError("file-actions/invalid-name", "新名字不能为空");
	if (value === "." || value === "..") throw new FileActionsError("file-actions/invalid-name", `新名字不合法："${value}"`);
	if (value.includes("\0")) throw new FileActionsError("file-actions/invalid-name", "新名字包含非法字符");
	if (value.includes("/") || value.includes("\\")) throw new FileActionsError("file-actions/invalid-name", "新名字不能包含路径分隔符，跨目录请用移动");
	return value;
}

/** 从扩展名推断 prettier parser（一键格式化用）；未知类型返回 null。 */
export function parserForPath(path) {
	const lower = String(path).toLowerCase();
	if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs") || lower.endsWith(".jsx")) return "babel";
	if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts") || lower.endsWith(".tsx")) return "typescript";
	if (lower.endsWith(".json")) return "json";
	if (lower.endsWith(".json5")) return "json5";
	if (lower.endsWith(".css")) return "css";
	if (lower.endsWith(".scss")) return "scss";
	if (lower.endsWith(".less")) return "less";
	if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
	if (lower.endsWith(".vue")) return "vue";
	if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
	if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
	if (lower.endsWith(".graphql") || lower.endsWith(".gql")) return "graphql";
	return null;
}

/**
 * 判断 child 是否等于 parent，或位于 parent 目录之内。
 * 用 node:path 的 relative 兼容 POSIX 与 Windows 两种路径分隔符。
 */
function isSameOrDescendant(parent, child) {
	const rel = relative(parent, child);
	return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** 在目标目录里给压缩包名加 "(2)" 等后缀，避免覆盖既有文件。 */
export async function uniqueZipPath(destination, name) {
	const exists = async (candidate) => {
		try {
			await lstat(candidate);
			return true;
		} catch {
			return false;
		}
	};
	let candidate = join(destination, name);
	if (!(await exists(candidate))) return { path: candidate, name };
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : "";
	for (let n = 2; ; n++) {
		candidate = join(destination, `${stem} (${n})${ext}`);
		if (!(await exists(candidate))) return { path: candidate, name: `${stem} (${n})${ext}` };
	}
}

/**
 * dsh-plugin-file-actions 的 Cordis 服务：工作区文件写操作 + Web 路由。
 * 服务键 `fileActions`（ctx.fileActions）。
 */
export class FileActionsService extends Service {
	static inject = ["fs", "sessions", "sandboxPolicy"];

	/** Cordis 配置契约：loader 据此校验 patch 配置并套用默认值。 */
	static Config = Schema.object({
		/** 压缩时单文件大小上限（字节），超限跳过并计入 skipped。 */
		maxZipFileBytes: Schema.number().min(1).default(DEFAULT_MAX_ZIP_FILE_BYTES),
		/** 文本编辑（读取/保存）的文件大小上限（字节）。 */
		maxEditBytes: Schema.number().min(1).default(DEFAULT_MAX_EDIT_BYTES),
	});

	constructor(ctx, config) {
		super(ctx, "fileActions");
		this.config = config;
		ctx.logger.info(`dsh-plugin-file-actions 已激活（maxZipFileBytes=${config.maxZipFileBytes}，maxEditBytes=${config.maxEditBytes}）`);
		// Web profile 中注册浏览器半区使用的路由。webServer 属于 Web 组合的
		// 作用域，不能从本行的注入面直接读取，因此用 ctx.inject 建一个以
		// webServer 为依赖的作用域子插件：Web 存在时注册路由，headless 等
		// profile 里保持休眠、不影响本服务。
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = ["copy", "move", "rename", "delete", "compress", "read", "save", "format"].map((operation) =>
					webCtx.webServer.register({
						kind: "exact",
						path: `${FILE_ACTIONS_API}/${operation}`,
						handler: (req, res) => this.handleRequest(req, res, operation),
					}),
				);
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "file-actions: HTTP routes");
			ctx.logger.info(`dsh-plugin-file-actions 路由已注册：${FILE_ACTIONS_API}/*`);
		});
	}

	/**
	 * 把客户端提交的工作区根路径解析为宿主侧的会话工作区：
	 * 优先匹配 live 会话的 header.cwd，其次匹配 sandboxPolicy.workspaceRoot；
	 * 两者都不匹配时拒绝（找不到对应会话，或不属于任何已知工作区）。
	 * @returns `{ workspaceRoot, source }`，source 为 "session" | "sandbox"。
	 */
	async resolveWorkspaceRoot(workspaceRoot) {
		const submitted = String(workspaceRoot ?? "").trim();
		if (submitted === "") throw new FileActionsError("file-actions/bad-request", "缺少工作区根目录");
		const resolveKey = async (path) => {
			try {
				const target = await this.ctx.fs.resolve(path, {});
				return this.ctx.fs.processPath(target);
			} catch {
				return null;
			}
		};
		const target = await resolveKey(submitted);
		if (target === null) throw new FileActionsError("file-actions/bad-request", "工作区根目录无法解析");
		const sessions = this.ctx.get("sessions");
		if (sessions !== undefined && typeof sessions.list === "function") {
			for (const session of sessions.list()) {
				const cwd = session?.header?.cwd;
				if (typeof cwd === "string" && cwd !== "") {
					const candidate = await resolveKey(cwd);
					if (candidate !== null && candidate === target) return { workspaceRoot: candidate, source: "session" };
				}
			}
		}
		const fallback = this.ctx.sandboxPolicy?.workspaceRoot;
		if (typeof fallback === "string" && fallback !== "") {
			const candidate = await resolveKey(fallback);
			if (candidate !== null && candidate === target) return { workspaceRoot: candidate, source: "sandbox" };
		}
		throw new FileActionsError("file-actions/no-workspace", "找不到与文件树对应的工作区（会话可能已关闭）");
	}

	/** 工作区根目录的 fs target（用于 contains 判定）。 */
	async workspaceTarget(workspaceRoot) {
		return this.ctx.fs.resolve(workspaceRoot, {});
	}

	/**
	 * 把一条工作区路径解析为宿主绝对路径，并校验其位于工作区内。
	 * @returns 宿主绝对路径。
	 */
	async confine(workspaceRoot, path, { signal } = {}) {
		const submitted = String(path ?? "").trim();
		if (submitted === "") throw new FileActionsError("file-actions/bad-request", "路径不能为空");
		const root = await this.workspaceTarget(workspaceRoot);
		let target;
		try {
			target = await this.ctx.fs.resolve(submitted, { cwd: workspaceRoot, signal });
		} catch (error) {
			throw new FileActionsError("file-actions/bad-request", `无法解析路径 "${submitted}"：${error.message}`, { cause: error });
		}
		if (!this.ctx.fs.contains(root, target)) {
			throw new FileActionsError("file-actions/outside-workspace", `"${submitted}" 位于工作区之外，操作被拒绝`);
		}
		return this.ctx.fs.processPath(target);
	}

	/** 校验目标目录存在且确为目录。 */
	async confineDirectory(workspaceRoot, destination) {
		const host = await this.confine(workspaceRoot, destination);
		let info;
		try {
			info = await lstat(host);
		} catch {
			throw new FileActionsError("file-actions/not-found", `目标目录不存在："${destination}"`);
		}
		if (!info.isDirectory()) throw new FileActionsError("file-actions/not-directory", `目标不是目录："${destination}"`);
		return host;
	}

	/** 校验一组源路径（非空、都在工作区内、不与工作区根相同）。 */
	async confineSources(workspaceRoot, sources) {
		if (!Array.isArray(sources) || sources.length === 0) {
			throw new FileActionsError("file-actions/bad-request", "缺少源路径");
		}
		const hostRoot = await this.confine(workspaceRoot, workspaceRoot);
		const hosts = [];
		for (const source of sources) {
			const host = await this.confine(workspaceRoot, source);
			if (host === hostRoot) throw new FileActionsError("file-actions/workspace-root", "工作区根目录本身不允许该操作");
			hosts.push(host);
		}
		return hosts;
	}

	/** 复制：把每个源复制进目标目录；同名冲突整体报错（不做部分写入）。 */
	async copyEntries({ workspaceRoot, sources, destination }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
		for (const host of hosts) {
			const target = join(hostDest, basename(host));
			if (isSameOrDescendant(host, target)) {
				throw new FileActionsError("file-actions/into-itself", `不能把 "${basename(host)}" 复制进其自身`);
			}
			if (await exists(target)) {
				throw new FileActionsError("file-actions/exists", `目标已存在同名项："${basename(host)}"`);
			}
		}
		for (const host of hosts) {
			await cp(host, join(hostDest, basename(host)), { recursive: true, errorOnExist: true });
		}
		return { count: hosts.length, destination: hostDest };
	}

	/** 移动（剪切）：优先 rename，跨设备（EXDEV 等）退化为复制 + 删除。 */
	async moveEntries({ workspaceRoot, sources, destination }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
		for (const host of hosts) {
			const target = join(hostDest, basename(host));
			if (isSameOrDescendant(host, target)) {
				throw new FileActionsError("file-actions/into-itself", `不能把 "${basename(host)}" 移动进其自身`);
			}
			if (await exists(target)) {
				throw new FileActionsError("file-actions/exists", `目标已存在同名项："${basename(host)}"`);
			}
		}
		for (const host of hosts) {
			const target = join(hostDest, basename(host));
			try {
				await rename(host, target);
			} catch (error) {
				if (error.code !== "EXDEV" && error.code !== "ENOTEMPTY" && error.code !== "EPERM" && error.code !== "EACCES") throw error;
				await cp(host, target, { recursive: true, errorOnExist: true });
				await rm(host, { recursive: true, force: true });
			}
		}
		return { count: hosts.length, destination: hostDest };
	}

	/**
	 * 重命名：在各项目所在目录内改名，文件与目录均可。
	 * 只接受单段新名字（跨目录移动请用 move）；目标已存在同名项时报
	 * file-actions/exists。大小写不敏感卷（macOS / Windows 默认）上「只改
	 * 大小写」时目标会命中同一 inode，此时按同一项处理而非冲突。
	 * @returns `{ name }`（最终生效的名字），原名未变时附 `unchanged: true`。
	 */
	async renameEntry({ workspaceRoot, path, name }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const [host] = await this.confineSources(root, [path]);
		const nextName = sanitizeEntryName(name);
		const target = join(dirname(host), nextName);
		if (target === host) return { name: nextName, unchanged: true };
		if (await exists(target)) {
			const [fromInfo, toInfo] = await Promise.all([lstat(host), lstat(target)]);
			const same = fromInfo.ino !== undefined && toInfo.ino !== undefined
				&& fromInfo.ino === toInfo.ino && fromInfo.dev === toInfo.dev;
			if (!same) throw new FileActionsError("file-actions/exists", `目标已存在同名项："${nextName}"`);
		}
		try {
			await rename(host, target);
		} catch (error) {
			if (error?.code === "ENOENT") throw new FileActionsError("file-actions/not-found", `要重命名的项不存在："${path}"`, { cause: error });
			throw error;
		}
		return { name: nextName, from: basename(host) };
	}

	/** 删除：逐条 rm（recursive）；不存在的路径记入 missing 而非报错。 */
	async deleteEntries({ workspaceRoot, paths }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const hosts = await this.confineSources(root, paths);
		let missing = 0;
		for (const host of hosts) {
			if (!(await exists(host))) {
				missing += 1;
				continue;
			}
			await rm(host, { recursive: true, force: true });
		}
		return { count: hosts.length, missing };
	}

	/** 压缩：把源打包进目标目录下的 .zip，返回最终文件名与统计。 */
	async compressEntries({ workspaceRoot, sources, destination, name }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
		const names = sources.map((source) => basename(String(source)));
		const base = sanitizeZipName(name) || zipNameFor(names);
		const { path, name: finalName } = await uniqueZipPath(hostDest, base);
		const { buffer, skipped } = await createZipBuffer(hosts, { maxFileBytes: this.config.maxZipFileBytes });
		await writeFile(path, buffer);
		return { name: finalName, count: hosts.length, skipped };
	}

	/** 绑定请求的工作区根：解析为宿主绝对路径并校验属于某会话/沙箱根。 */
	async bindWorkspace(workspaceRoot) {
		const { workspaceRoot: root } = await this.resolveWorkspaceRoot(workspaceRoot);
		return root;
	}

	/** 定位一个工作区内的普通文件（编辑类操作共用）。 */
	async locateTextFile(root, path) {
		const host = await this.confine(root, path);
		let info;
		try {
			info = await lstat(host);
		} catch {
			throw new FileActionsError("file-actions/not-found", `文件不存在："${path}"`);
		}
		if (!info.isFile()) throw new FileActionsError("file-actions/not-regular-file", `不是普通文件："${path}"`);
		return { host, info };
	}

	/** 读取文本内容（编辑用）：受 maxEditBytes 限制，拒绝含 NUL 的非文本。 */
	async readTextEntry({ workspaceRoot, path }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const { host, info } = await this.locateTextFile(root, path);
		if (info.size > this.config.maxEditBytes) {
			throw new FileActionsError("file-actions/too-large", `文件超过编辑上限（${this.config.maxEditBytes} 字节）`);
		}
		const data = await readFile(host);
		if (data.includes(0)) throw new FileActionsError("file-actions/not-text", `"${path}" 不是文本文件（含 NUL 字节）`);
		return { content: data.toString("utf8"), bytes: data.length, truncated: false };
	}

	/** 保存文本内容（编辑用）：UTF-8 覆盖写回，受 maxEditBytes 限制。 */
	async saveTextEntry({ workspaceRoot, path, content }) {
		const root = await this.bindWorkspace(workspaceRoot);
		const { host } = await this.locateTextFile(root, path);
		const data = Buffer.from(String(content ?? ""), "utf8");
		if (data.length > this.config.maxEditBytes) {
			throw new FileActionsError("file-actions/too-large", `内容超过编辑上限（${this.config.maxEditBytes} 字节）`);
		}
		await writeFile(host, data);
		return { bytes: data.length };
	}

	/** 一键格式化：按扩展名推断 prettier parser，格式化客户端提交的内容。 */
	async formatTextEntry({ workspaceRoot, path, content }) {
		await this.bindWorkspace(workspaceRoot);
		const parser = parserForPath(path);
		if (parser === null) throw new FileActionsError("file-actions/format-unsupported", "该文件类型暂不支持一键格式化");
		try {
			const formatted = await prettierFormat(String(content ?? ""), { parser });
			return { content: formatted, parser };
		} catch (error) {
			throw new FileActionsError("file-actions/format-failed", `格式化失败：${error.message}`, { cause: error });
		}
	}

	/** 统一路由处理器：解析 JSON 请求体并分发。 */
	async handleRequest(req, res, operation) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "POST") {
				payload(405, { ok: false, code: "file-actions/method", message: "method not allowed" });
				return;
			}
			let body = {};
			try {
				const chunks = [];
				for await (const chunk of req) chunks.push(chunk);
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
			} catch {
				payload(400, { ok: false, code: "file-actions/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			if (operation === "copy") {
				payload(200, { ok: true, ...(await this.copyEntries(body)) });
				return;
			}
			if (operation === "move") {
				payload(200, { ok: true, ...(await this.moveEntries(body)) });
				return;
			}
			if (operation === "rename") {
				payload(200, { ok: true, ...(await this.renameEntry(body)) });
				return;
			}
			if (operation === "delete") {
				payload(200, { ok: true, ...(await this.deleteEntries(body)) });
				return;
			}
			if (operation === "compress") {
				payload(200, { ok: true, ...(await this.compressEntries(body)) });
				return;
			}
			if (operation === "read") {
				payload(200, { ok: true, ...(await this.readTextEntry(body)) });
				return;
			}
			if (operation === "save") {
				payload(200, { ok: true, ...(await this.saveTextEntry(body)) });
				return;
			}
			if (operation === "format") {
				payload(200, { ok: true, ...(await this.formatTextEntry(body)) });
				return;
			}
			payload(404, { ok: false, code: "file-actions/unknown", message: "unknown operation" });
		} catch (error) {
			payload(400, { ok: false, code: error.code ?? "file-actions/failure", message: error.message });
		}
	}
}

async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

export default FileActionsService;
