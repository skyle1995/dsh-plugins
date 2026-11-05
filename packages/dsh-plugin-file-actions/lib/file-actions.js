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
import { constants } from "node:fs";
import { copyFile, cp, link, lstat, mkdtemp, open, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { format as prettierFormat } from "prettier";
import { writeZipFile } from "./zip.js";

/** 浏览器半区使用的 HTTP 路由前缀。 */
export const FILE_ACTIONS_API = "/api/dsh-file-actions";

/** 默认单文件压缩上限（字节）。 */
export const DEFAULT_MAX_ZIP_FILE_BYTES = 256 * 1024 * 1024;

/** 默认文本编辑文件大小上限（字节）。 */
export const DEFAULT_MAX_EDIT_BYTES = 1024 * 1024;

/** 默认压缩总输入上限、条目数和批量路径数。 */
export const DEFAULT_MAX_ZIP_TOTAL_BYTES = 1024 * 1024 * 1024;
export const DEFAULT_MAX_ZIP_ENTRIES = 10000;
export const DEFAULT_MAX_BATCH_PATHS = 1000;

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
 * @param name 输入名称；platform 宿主平台，默认当前平台。
 * @returns 经过宿主名称校验的 ZIP 名称或空串。
 */
export function sanitizeZipName(name, platform = process.platform) {
        const input = String(name ?? "").trim();
        const value = platform === "win32" ? input.replaceAll("\\", "/") : input;
	const base = value.split("/").pop() ?? "";
	if (base === "" || base === "." || base === "..") return "";
        return sanitizeEntryName(base.toLowerCase().endsWith(".zip") ? base : `${base}.zip`, platform);
}

/**
 * 规范化重命名提交的新名字：只接受单段名称（不含路径分隔符），
 * 非空、非 "." / ".."、不含 NUL；非法输入抛 FileActionsError。
 * @param name 输入名称；platform 宿主平台，仅 Windows 应用保留名等额外限制。
 * @returns 不擅自裁剪空格的合法名称。
 */
export function sanitizeEntryName(name, platform = process.platform) {
        const value = String(name ?? "");
        if (value.trim() === "") throw new FileActionsError("file-actions/invalid-name", "新名字不能为空");
	if (value === "." || value === "..") throw new FileActionsError("file-actions/invalid-name", `新名字不合法："${value}"`);
	if (value.includes("\0")) throw new FileActionsError("file-actions/invalid-name", "新名字包含非法字符");
        if (value.includes("/") || platform === "win32" && value.includes("\\")) throw new FileActionsError("file-actions/invalid-name", "新名字不能包含路径分隔符，跨目录请用移动");
        if (platform === "win32") {
                const stem = value.split(".")[0].trimEnd().toUpperCase();
                const reserved = ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
                        ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
                        ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`), "COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³"];
                const invalid = [...value].some((char) => char.charCodeAt(0) < 32 || '<>:"|?*'.includes(char));
                if (invalid || reserved.includes(stem) || value.endsWith(".") || value.endsWith(" ")) {
                        throw new FileActionsError("file-actions/invalid-name", "名字包含 Windows 不支持的字符、保留名或末尾点/空格");
                }
        }
	return value;
}

/** 从扩展名推断 prettier parser（一键格式化用）；未知类型返回 null。 */
export function parserForPath(path) {
        switch (extname(String(path)).toLowerCase()) {
                case ".js": case ".mjs": case ".cjs": case ".jsx": return "babel";
                case ".ts": case ".mts": case ".cts": case ".tsx": return "typescript";
                case ".json": return "json";
                case ".json5": return "json5";
                case ".css": return "css";
                case ".scss": return "scss";
                case ".less": return "less";
                case ".html": case ".htm": return "html";
                case ".vue": return "vue";
                case ".md": case ".markdown": return "markdown";
                case ".yml": case ".yaml": return "yaml";
                case ".graphql": case ".gql": return "graphql";
                default: return null;
        }
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
                /** 压缩总输入大小上限（字节），超限终止且不留下压缩包。 */
                maxZipTotalBytes: Schema.number().min(1).default(DEFAULT_MAX_ZIP_TOTAL_BYTES),
                /** 压缩最大条目数（含目录，不能超过经典 ZIP 上限）。 */
                maxZipEntries: Schema.number().min(1).max(65535).default(DEFAULT_MAX_ZIP_ENTRIES),
                /** 单次批量操作的最大路径数。 */
                maxBatchPaths: Schema.number().min(1).default(DEFAULT_MAX_BATCH_PATHS),
	});

	constructor(ctx, config) {
		super(ctx, "fileActions");
		this.config = config;
                this.mutations = new Map();
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
                const submitted = String(workspaceRoot ?? "");
                if (submitted.trim() === "") throw new FileActionsError("file-actions/bad-request", "缺少工作区根目录");
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
                const submitted = String(path ?? "");
                if (submitted.trim() === "") throw new FileActionsError("file-actions/bad-request", "路径不能为空");
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
                if (sources.length > (this.config.maxBatchPaths ?? DEFAULT_MAX_BATCH_PATHS)) {
                        throw new FileActionsError("file-actions/too-many-paths", "批量路径数量超过上限");
                }
		const hostRoot = await this.confine(workspaceRoot, workspaceRoot);
		const hosts = [];
		for (const source of sources) {
			const host = await this.confine(workspaceRoot, source);
			if (host === hostRoot) throw new FileActionsError("file-actions/workspace-root", "工作区根目录本身不允许该操作");
                        if (!hosts.includes(host)) hosts.push(host);
		}
                // 同时选中父目录与其子项时只操作父目录，避免重复复制或移动。
                return hosts.filter((host) => !hosts.some((parent) => parent !== host && isSameOrDescendant(parent, host)));
	}

        /**
         * 串行化同一工作区的插件写操作，避免插件请求之间的预检查竞争。
         * @param root 已绑定工作区；action 异步操作。
         * @returns 操作结果；失败不会阻塞后续请求。
         */
        async withMutation(root, action) {
                const previous = this.mutations.get(root) ?? Promise.resolve();
                const pending = previous.catch(() => {}).then(action);
                this.mutations.set(root, pending);
                try {
                        return await pending;
                } finally {
                        if (this.mutations.get(root) === pending) this.mutations.delete(root);
                }
        }

        /**
         * 生成批量目标计划，按目标卷实际大小写和 Unicode 规则检查同名冲突。
         * @param hosts 源绝对路径；destination 目标目录。
         * @returns 已预检的 `{ host, target }` 数组，不执行业务文件写入。
         */
        async transferPlan(hosts, destination) {
                const probe = await mkdtemp(join(destination, ".dsh-name-check-"));
                let caseInsensitive;
                let unicodeEquivalent;
                try {
                        await writeFile(join(probe, "case"), "", { flag: "wx" });
                        await writeFile(join(probe, "é"), "", { flag: "wx" });
                        caseInsensitive = await exists(join(probe, "CASE"));
                        unicodeEquivalent = await exists(join(probe, "e\u0301"));
                } finally {
                        await rm(probe, { recursive: true, force: true });
                }
                const targets = new Set();
                const plan = [];
                for (const host of hosts) {
                        await lstat(host);
                        const name = basename(host);
                        const target = join(destination, name);
                        if (isSameOrDescendant(host, target)) {
                                throw new FileActionsError("file-actions/into-itself", `不能把 "${name}" 放进其自身`);
                        }
                        let key = unicodeEquivalent ? name.normalize("NFC") : name;
                        if (caseInsensitive) key = key.toLowerCase();
                        if (targets.has(key) || await exists(target)) {
                                throw new FileActionsError("file-actions/exists", `目标存在同名项或批量源名称重复："${name}"`);
                        }
                        targets.add(key);
                        plan.push({ host, target });
                }
                return plan;
        }

        /** 复制：参数为工作区、源列表与目标；预检冲突，运行时失败附已完成列表。 */
	async copyEntries({ workspaceRoot, sources, destination }) {
		const root = await this.bindWorkspace(workspaceRoot);
                return this.withMutation(root, async () => {
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
                const plan = await this.transferPlan(hosts, hostDest);
                const completed = [];
                for (const { host, target } of plan) {
                        try {
                                await cp(host, target, { recursive: true, force: false, errorOnExist: true });
                                completed.push(host);
                        } catch (error) {
                                throw transferFailure(error, completed, host, target);
                        }
		}
		return { count: hosts.length, destination: hostDest };
                });
	}

	/** 移动（剪切）：优先 rename，跨设备（EXDEV 等）退化为复制 + 删除。 */
	async moveEntries({ workspaceRoot, sources, destination }) {
		const root = await this.bindWorkspace(workspaceRoot);
                return this.withMutation(root, async () => {
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
                const plan = await this.transferPlan(hosts, hostDest);
                const completed = [];
                for (const { host, target } of plan) {
			try {
                                if (await exists(target)) throw new FileActionsError("file-actions/exists", "移动目标已被占用");
                                try {
                                        await rename(host, target);
                                } catch (error) {
                                        // 权限或占用错误不能退化为复制后删除，只有跨设备移动才退化。
                                        if (error.code !== "EXDEV") throw error;
                                        await cp(host, target, { recursive: true, force: false, errorOnExist: true });
                                        await rm(host, { recursive: true, force: true });
                                }
                                completed.push(host);
			} catch (error) {
                                throw transferFailure(error, completed, host, target);
			}
		}
		return { count: hosts.length, destination: hostDest };
                });
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
                return this.withMutation(root, async () => {
		const [host] = await this.confineSources(root, [path]);
		const nextName = sanitizeEntryName(name);
		const target = join(dirname(host), nextName);
		if (target === host) return { name: nextName, unchanged: true };
		if (await exists(target)) {
			const [fromInfo, toInfo] = await Promise.all([lstat(host), lstat(target)]);
                        const names = await readdir(dirname(host));
                        const separateEntries = names.includes(basename(host)) && names.includes(nextName);
                        const same = fromInfo.ino !== undefined && fromInfo.ino !== 0 && toInfo.ino !== undefined
				&& fromInfo.ino === toInfo.ino && fromInfo.dev === toInfo.dev;
                        if (!same || separateEntries) throw new FileActionsError("file-actions/exists", `目标已存在同名项："${nextName}"`);
		}
		try {
			await rename(host, target);
		} catch (error) {
			if (error?.code === "ENOENT") throw new FileActionsError("file-actions/not-found", `要重命名的项不存在："${path}"`, { cause: error });
			throw error;
		}
		return { name: nextName, from: basename(host) };
                });
	}

	/** 删除：逐条 rm（recursive）；不存在的路径记入 missing 而非报错。 */
	async deleteEntries({ workspaceRoot, paths }) {
		const root = await this.bindWorkspace(workspaceRoot);
                return this.withMutation(root, async () => {
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
                });
	}

	/** 压缩：把源打包进目标目录下的 .zip，返回最终文件名与统计。 */
	async compressEntries({ workspaceRoot, sources, destination, name }) {
		const root = await this.bindWorkspace(workspaceRoot);
                return this.withMutation(root, async () => {
		const hosts = await this.confineSources(root, sources);
		const hostDest = await this.confineDirectory(root, destination);
                const base = sanitizeZipName(name) || sanitizeEntryName(zipNameFor(hosts.map((host) => basename(host))));
                const temporary = await mkdtemp(join(hostDest, ".dsh-zip-"));
                try {
                        const archive = join(temporary, "archive.zip");
                        const { skipped } = await writeZipFile(hosts, archive, {
                                maxFileBytes: this.config.maxZipFileBytes,
                                maxTotalBytes: this.config.maxZipTotalBytes,
                                maxEntries: this.config.maxZipEntries,
                                excludePaths: [temporary],
                        });
                        for (;;) {
                                const { path, name: finalName } = await uniqueZipPath(hostDest, base);
                                try {
                                        // 硬链接发布已写完的文件，目标存在时不会覆盖（Windows/macOS/Linux）。
                                        try {
                                                await link(archive, path);
                                        } catch (error) {
                                                switch (error.code) {
                                                        // exFAT 等卷不支持硬链接，仍用排他复制保留不覆盖语义。
                                                        case "EPERM": case "ENOTSUP": case "EOPNOTSUPP": case "EXDEV": case "ENOSYS":
                                                                await copyFile(archive, path, constants.COPYFILE_EXCL);
                                                                break;
                                                        default: throw error;
                                                }
                                        }
                                        return { name: finalName, count: hosts.length, skipped };
                                } catch (error) {
                                        if (error.code !== "EEXIST") throw error;
                                }
                        }
                } finally {
                        await rm(temporary, { recursive: true, force: true });
                }
                });
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
                const data = await readLimitedText(host, this.config.maxEditBytes);
                return { content: data.toString("utf8"), bytes: data.length, truncated: false, version: textVersion(data) };
	}

        /** 保存：参数含可选读取版本；校验外部修改并原子替换，返回字节数及新版本。 */
        async saveTextEntry({ workspaceRoot, path, content, version }) {
		const root = await this.bindWorkspace(workspaceRoot);
                return this.withMutation(root, async () => {
                const { host, info } = await this.locateTextFile(root, path);
		const data = Buffer.from(String(content ?? ""), "utf8");
		if (data.length > this.config.maxEditBytes) {
			throw new FileActionsError("file-actions/too-large", `内容超过编辑上限（${this.config.maxEditBytes} 字节）`);
		}
                if (data.includes(0)) throw new FileActionsError("file-actions/not-text", "保存内容不能含 NUL 字节");
                const expected = textVersion(await readLimitedText(host, this.config.maxEditBytes));
                if (version !== undefined && version !== expected) {
                        throw new FileActionsError("file-actions/edit-conflict", "文件已被其他程序修改，请重新加载后再保存");
                }
                const temporary = await mkdtemp(join(dirname(host), ".dsh-save-"));
                try {
                        const next = join(temporary, "content");
                        const file = await open(next, "wx", info.mode & 0o777);
                        try {
                                await file.writeFile(data);
                                await file.chmod(info.mode & 0o777);
                                await file.sync();
                        } finally {
                                await file.close();
                        }
                        if (textVersion(await readLimitedText(host, this.config.maxEditBytes)) !== expected) {
                                throw new FileActionsError("file-actions/edit-conflict", "保存期间文件被修改，请重新加载");
                        }
                        await rename(next, host);
                } finally {
                        await rm(temporary, { recursive: true, force: true });
                }
                return { bytes: data.length, version: textVersion(data) };
                });
	}

	/** 一键格式化：按扩展名推断 prettier parser，格式化客户端提交的内容。 */
	async formatTextEntry({ workspaceRoot, path, content }) {
                const root = await this.bindWorkspace(workspaceRoot);
                await this.confine(root, path);
                const source = String(content ?? "");
                if (Buffer.byteLength(source, "utf8") > this.config.maxEditBytes) {
                        throw new FileActionsError("file-actions/too-large", "格式化内容超过编辑上限");
                }
		const parser = parserForPath(path);
		if (parser === null) throw new FileActionsError("file-actions/format-unsupported", "该文件类型暂不支持一键格式化");
		try {
                        const formatted = await prettierFormat(source, { parser, endOfLine: "auto" });
                        if (Buffer.byteLength(formatted, "utf8") > this.config.maxEditBytes) {
                                throw new FileActionsError("file-actions/too-large", "格式化结果超过编辑上限");
                        }
			return { content: formatted, parser };
		} catch (error) {
                        if (error instanceof FileActionsError) throw error;
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
                                let bytes = 0;
                                // JSON 转义最多放大约六倍，给路径与结构预留 64KB。
                                const limit = this.config.maxEditBytes * 6 + 65536;
                                for await (const chunk of req) {
                                        bytes += Buffer.byteLength(chunk);
                                        if (bytes > limit) throw new FileActionsError("file-actions/request-too-large", "请求体超过大小上限");
                                        chunks.push(Buffer.from(chunk));
                                }
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
                                if (body === null || typeof body !== "object" || Array.isArray(body)) {
                                        throw new FileActionsError("file-actions/bad-request", "请求体必须是 JSON 对象");
                                }
                        } catch (error) {
                                if (error instanceof FileActionsError) throw error;
				payload(400, { ok: false, code: "file-actions/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
                        let result;
                        switch (operation) {
                                case "copy": result = await this.copyEntries(body); break;
                                case "move": result = await this.moveEntries(body); break;
                                case "rename": result = await this.renameEntry(body); break;
                                case "delete": result = await this.deleteEntries(body); break;
                                case "compress": result = await this.compressEntries(body); break;
                                case "read": result = await this.readTextEntry(body); break;
                                case "save": result = await this.saveTextEntry(body); break;
                                case "format": result = await this.formatTextEntry(body); break;
                                default:
                                        payload(404, { ok: false, code: "file-actions/unknown", message: "unknown operation" });
                                        return;
			}
                        payload(200, { ok: true, ...result });
		} catch (error) {
                        const status = error.code === "file-actions/request-too-large" ? 413
                                : error.code === "file-actions/edit-conflict" ? 409 : 400;
                        payload(status, { ok: false, code: error.code ?? "file-actions/failure", message: error.message, details: error.details });
		}
	}
}

/** 检测路径是否存在；参数为宿主路径，返回布尔值，权限等错误原样抛出。 */
async function exists(path) {
	try {
		await lstat(path);
		return true;
        } catch (error) {
                if (error.code === "ENOENT") return false;
                throw error;
	}
}

/** 为批量运行失败生成错误；参数为原因与进度，返回附带部分结果的错误。 */
function transferFailure(cause, completed, source, target) {
        const error = new FileActionsError(cause.code ?? "file-actions/failure",
                `操作失败，已完成 ${completed.length} 项；"${basename(source)}" 可能部分写入：${cause.message}`, { cause });
        error.details = { completed, failed: source, target };
        return error;
}

/** 对原始文件字节生成版本标识；参数为 Buffer，返回 SHA-256 字符串。 */
function textVersion(data) {
        return createHash("sha256").update(data).digest("hex");
}

/** 有界读取 UTF-8 文本；参数为路径与字节上限，返回原始字节，拒绝二进制/非法编码。 */
async function readLimitedText(path, limit) {
        const file = await open(path, "r");
        try {
                const data = Buffer.alloc(limit + 1);
                let size = 0;
                while (size < data.length) {
                        const { bytesRead } = await file.read(data, size, data.length - size, null);
                        if (bytesRead === 0) break;
                        size += bytesRead;
                }
                if (size > limit) throw new FileActionsError("file-actions/too-large", "文件超过编辑大小上限");
                const result = data.subarray(0, size);
                if (result.includes(0)) throw new FileActionsError("file-actions/not-text", "文件含 NUL 字节，不是可编辑文本");
                try {
                        new TextDecoder("utf-8", { fatal: true }).decode(result);
                } catch {
                        throw new FileActionsError("file-actions/not-text", "文件不是有效 UTF-8 文本，请转换编码后编辑");
                }
                return result;
        } finally {
                await file.close();
        }
}

export default FileActionsService;
