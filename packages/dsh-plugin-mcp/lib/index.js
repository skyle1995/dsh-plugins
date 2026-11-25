/**
 * dsh-plugin-mcp —— 设置面板里的 MCP 服务器管理器。
 *
 * 设计要点：
 * - DSH 运行时（0.2.0-rc.2）内置 @deepseek-ai/dsh-mcp-client：每台 MCP 服务器
 *   是 cordis 树里一条 name 为该模块的条目，工具以 mcp__<serverName>__<tool>
 *   形式注册给模型。本插件不重新实现 MCP 客户端，而是把「增删改 / 启停 MCP
 *   服务器」的体验打包：状态存一份 JSON（mcp-servers.json），运行时把每条
 *   服务器投影成 loader 树里的受管条目（id 前缀 `mcp-managed-`）。
 * - 状态文件是唯一事实源：重启后 cordis.yml 会被 profile 引导重置为空根，
 *   本插件激活时按状态重建受管条目；运行时 `loader/config-update`（树写回 /
 *   补丁热重载）后重新投影，保证受管条目始终存在。
 * - 手工写在 cordis.patch.yml 里的 mcp-client 条目不受管、只读展示，不与
 *   受管条目冲突（serverName 冲突会在保存时拦截）。
 * - 浏览器半区通过 webServer 路由（Web 组合的作用域）读列表、保存、启停。
 *   服务键 `mcpManager`（ctx.mcpManager）。
 *
 * @module dsh-plugin-mcp
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { Config as McpClientConfig } from "@deepseek-ai/dsh-mcp-client";
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import presetCatalog from "../presets.json" with { type: "json" };

/** 内置 MCP 客户端桥接模块名（loader 条目 name）。 */
export const MCP_MODULE = "@deepseek-ai/dsh-mcp-client";

/** 受管条目的 id 前缀：与官方文档示例（mcp-<name>）区隔，避免误删手工条目。 */
export const MANAGED_ID_PREFIX = "mcp-managed-";

/** 状态文件名（与 profile 的 cordis.patch.yml 同级）。 */
export const STATE_FILENAME = "mcp-servers.json";

/** 根 include 条目的稳定 id（DSH profile 引导固定使用）。 */
export const INCLUDE_ENTRY_ID = "include";

/** 浏览器半区路由。 */
export const ROUTE_BASE = "/api/dsh-plugin-mcp";
export const SERVERS_ROUTE = `${ROUTE_BASE}/servers`;
export const OPERATION_ROUTE = `${ROUTE_BASE}/operation`;

/** serverName 约束：与 mcp-client 相同（[A-Za-z0-9_-]{1,32}）。 */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** 列表接口里敏感字段（env / headers 值）的掩码。 */
export const MASKED_VALUE = "••••••";

/**
 * 内置预设目录（随包发布的 presets.json；在线目录未加载时的兜底）。
 * 日常新增预设只需更新仓库里的 presets.json——在线目录按需拉取，
 * 无需更新插件本身。
 */
export const PRESETS = presetCatalog.presets;

/** 内置预设分类（同上，展示顺序即数组顺序）。 */
export const PRESET_CATEGORIES = presetCatalog.categories;

/** 预设 id → 分类 id。 */
export function categoryOf(presetId) {
	for (const category of PRESET_CATEGORIES) {
		if (category.presetIds.includes(presetId)) return category.id;
	}
	return "other";
}

/** 占位文本标记：所有预设占位值必须包含该短语，据此识别而非误伤普通参数。 */
export const PLACEHOLDER_MARKER = "在此填入";

/** 全部预设占位值：保存时这些值必须被用户替换（精确匹配）。 */
export const PLACEHOLDER_VALUES = new Set(
	PRESETS.flatMap((preset) => [
		...Object.values(preset.server.env ?? {}),
		...(preset.server.args ?? []).filter((value) => typeof value === "string"),
	]).filter((value) => value.includes(PLACEHOLDER_MARKER)),
);

/** 在线预设目录默认地址（dsh-plugins 仓库内的 presets.json，公开 raw）。 */
export const DEFAULT_PRESET_URL = "https://raw.githubusercontent.com/skyle1995/dsh-plugins/main/packages/dsh-plugin-mcp/presets.json";

/** 预设缓存文件名（与状态文件同级，拉取成功后落盘、断网时兜底）。 */
export const PRESET_CACHE_FILENAME = "presets-cache.json";

/** 从一组预设收集占位值（含「在此填入」标记的 env 值 / 参数）。 */
export function placeholderValuesOf(presets) {
	return new Set(
		(presets ?? []).flatMap((preset) => [
			...Object.values(preset.server?.env ?? {}),
			...(preset.server?.args ?? []).filter((value) => typeof value === "string"),
		]).filter((value) => typeof value === "string" && value.includes(PLACEHOLDER_MARKER)),
	);
}

/**
 * 配置值的动态表达式语法：
 * - `$env:NAME` / `${env:NAME}` —— 引用 harness 进程环境变量（密钥不落盘）
 * - `$file:/path` / `${file:/path}` —— 读取文件首行（令牌文件；支持 ~）
 * 解析发生在投影时：改环境变量 / 文件内容后重新投影即生效；
 * 解析失败（变量未设置 / 文件不可读）记为 issue 并解析为空字符串。
 */
export const EXPR_FULL = /^\$(env|file):(.+)$/;
export const EXPR_INLINE = /\$\{(env|file):([^}]+)\}/g;

/** 解析一条引用；参数为类型、名称及问题列表，返回环境值或文件首行，失败返回空串并记问题。 */
function lookupRef(kind, arg, issues) {
	if (kind === "env") {
		const value = process.env[arg];
		if (value === undefined) issues.push(`env:${arg}`);
		return value ?? "";
	}
	if (kind === "file") {
                const path = arg === "~" ? resolveDshHomeFallback()
                        : arg.startsWith("~/") || arg.startsWith("~\\") ? join(resolveDshHomeFallback(), arg.slice(2)) : arg;
		try {
                        return readFileSync(path, "utf8").split("\n", 1)[0].trim();
		} catch {
			issues.push(`file:${arg}`);
			return "";
		}
	}
	return "";
}

/** 获取系统用户目录；无参数，返回原生用户目录，不依赖空 HOME 或当前目录兜底。 */
function resolveDshHomeFallback() {
        return homedir();
}

/**
 * 递归解析配置值中的表达式（字符串全值 / 内嵌、数组、对象均支持）。
 * @param value - 原始配置值。
 * @param issues - 收集解析失败的引用。
 * @returns 解析后的值（普通值原样返回）。
 */
export function resolveConfigValue(value, issues) {
	if (typeof value === "string") {
		const inline = value.replace(EXPR_INLINE, (_match, kind, arg) => lookupRef(kind, arg, issues));
		if (inline !== value) return inline;
		const full = value.match(EXPR_FULL);
		if (full !== null) return lookupRef(full[1], full[2], issues);
		return value;
	}
	if (Array.isArray(value)) return value.map((item) => resolveConfigValue(item, issues));
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveConfigValue(item, issues)]));
	}
	return value;
}

/**
 * 校验并规范化在线目录载荷。结构非法时抛 McpError（mcp/preset-invalid），
 * 调用方决定回退策略（缓存 / 内置）。
 * @param raw - 远程 JSON 解析结果。
 * @returns { version, categories, presets }。
 */
export function validatePresetCatalog(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new McpError("mcp/preset-invalid", "预设目录必须是对象");
	}
	const { categories, presets } = raw;
	if (!Array.isArray(categories) || categories.length === 0) {
		throw new McpError("mcp/preset-invalid", "预设目录缺少 categories 数组");
	}
	if (!Array.isArray(presets) || presets.length === 0) {
		throw new McpError("mcp/preset-invalid", "预设目录缺少 presets 数组");
	}
	const categoryIds = new Set();
	for (const category of categories) {
		if (category === null || typeof category !== "object" || typeof category.id !== "string" || category.id === "") {
			throw new McpError("mcp/preset-invalid", "分类缺少合法 id");
		}
		if (categoryIds.has(category.id)) throw new McpError("mcp/preset-invalid", `分类 id 重复：${category.id}`);
		categoryIds.add(category.id);
		if (!Array.isArray(category.presetIds)) throw new McpError("mcp/preset-invalid", `分类 ${category.id} 缺少 presetIds 数组`);
	}
	const presetIds = new Set();
	for (const preset of presets) {
		if (preset === null || typeof preset !== "object" || typeof preset.id !== "string" || preset.id === "") {
			throw new McpError("mcp/preset-invalid", "预设缺少合法 id");
		}
		if (presetIds.has(preset.id)) throw new McpError("mcp/preset-invalid", `预设 id 重复：${preset.id}`);
		presetIds.add(preset.id);
		const server = preset.server;
		if (server === null || typeof server !== "object" || typeof server.serverName !== "string" || server.serverName === "") {
			throw new McpError("mcp/preset-invalid", `预设 ${preset.id} 缺少 server.serverName`);
		}
		if (server.transport !== "stdio" && server.transport !== "streamable-http") {
			throw new McpError("mcp/preset-invalid", `预设 ${preset.id} 的 transport 非法`);
		}
	}
	return { version: Number.isInteger(raw.version) ? raw.version : 1, categories, presets };
}

/**
 * 拉取并校验在线预设目录。网络 / HTTP / JSON / 结构错误均抛
 * McpError（mcp/preset-fetch / mcp/preset-invalid），由调用方决定回退。
 * @param url - 目录地址。
 * @param timeoutMs - 超时（毫秒）。
 * @param fetchImpl - 可注入替身用于测试。
 * @returns 校验后的目录。
 */
export async function fetchPresetCatalog(url, timeoutMs, fetchImpl = fetch) {
	const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
	if (!response.ok) throw new McpError("mcp/preset-fetch", `预设目录 HTTP ${response.status}：${url}`);
	const text = await response.text();
	let raw;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new McpError("mcp/preset-fetch", `预设目录不是合法 JSON：${url}`);
	}
	return validatePresetCatalog(raw);
}

/** Fiber 状态（cordis）：2 = active。 */
const FIBER_ACTIVE = 2;
const FIBER_FAILED = 3;

/** 带错误码的管理错误，code 形如 `mcp/<kind>`。 */
export class McpError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "McpError";
		this.code = code;
	}
}

/** 受管条目的 loader id。 */
export function entryIdOf(serverName) {
	return `${MANAGED_ID_PREFIX}${serverName}`;
}

/**
 * 定位 profile 目录：读根 include 条目配置里的 cordis.yml 路径。
 * 回退到本条目父组所属树（即 include 实例）暴露的 filename。
 * 两者都拿不到时返回 null（headless 等极简环境）。
 *
 * @param ctx - 本插件服务的上下文。
 * @returns profile 目录绝对路径，或 null。
 */
export function profileDirOf(ctx) {
	try {
		const include = ctx.loader.resolve(INCLUDE_ENTRY_ID);
		const path = include?.options?.config?.path;
		if (typeof path === "string" && path.startsWith("file:")) return dirname(fileURLToPath(path));
	} catch {
		// 继续回退路径。
	}
	const tree = ctx.fiber?.entry?.parent?.tree;
	if (typeof tree?.filename === "string" && tree.filename !== "") return dirname(tree.filename);
	return null;
}

/**
 * 读取状态文件。容忍缺失与坏文件：坏文件时返回 corrupt 信息，
 * 上层据此拒绝覆盖写入，避免静默数据丢失。
 *
 * @param file - 状态文件绝对路径。
 * @returns { servers, corrupt }。
 */
export function loadStateFile(file) {
	let raw;
	try {
		raw = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") return { servers: [], corrupt: null };
		return { servers: [], corrupt: `状态文件无法解析：${error.message}` };
	}
	if (raw === null || typeof raw !== "object" || !Array.isArray(raw.servers)) {
		return { servers: [], corrupt: "状态文件格式错误：缺少 servers 数组" };
	}
	return {
		servers: raw.servers.filter((server) => server !== null && typeof server === "object" && typeof server.serverName === "string"),
		corrupt: null,
	};
}

/**
 * 原子写入状态文件（tmp + rename），权限 0600（env 可能含密钥）。
 * @param file - 状态文件绝对路径。
 * @param servers - 服务器列表。
 */
export function saveStateFile(file, servers) {
        writeJsonAtomic(file, { version: 1, servers });
}

/**
 * 原子写入 JSON，避免固定临时名的竞争与预置符号链接，确保 POSIX 权限为 0600。
 * @param file 目标路径；value 可序列化数据。
 * @returns 无返回值，失败保留原文件并清理本次临时目录。
 */
function writeJsonAtomic(file, value) {
	mkdirSync(dirname(file), { recursive: true });
        const temporary = mkdtempSync(join(dirname(file), ".dsh-mcp-"));
        try {
                const tmp = join(temporary, "state.json");
                const fd = openSync(tmp, "wx", 0o600);
                try {
                        writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
                        fsyncSync(fd);
                } finally {
                        closeSync(fd);
                }
                renameSync(tmp, file);
        } finally {
                rmSync(temporary, { recursive: true, force: true });
        }
}

/**
 * 校验并规范化一份服务器配置：剥离管理字段（disabled / note），按
 * transport 只保留相关字段，交给内置 mcp-client 的真实 Config schema
 * 校验（与 loader 激活时的校验完全一致），返回规范化配置。
 *
 * @param raw - 客户端提交的原始配置对象。
 * @returns { config, disabled, note }。
 * @throws McpError mcp/invalid-* —— 校验失败。
 */
export function normalizeServer(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new McpError("mcp/invalid-server", "服务器配置必须是对象");
	}
	const { disabled, note, ...rest } = raw;
	const serverName = typeof rest.serverName === "string" ? rest.serverName.trim() : "";
	if (!SERVER_NAME_PATTERN.test(serverName)) {
		throw new McpError("mcp/invalid-name", "serverName 必须匹配 [A-Za-z0-9_-]{1,32}");
	}
	let candidate;
	if (rest.transport === "stdio") {
		const { url, headers, ...stdio } = rest;
		candidate = { ...stdio, serverName };
	} else if (rest.transport === "streamable-http") {
		const { command, args, env, cwd, ...http } = rest;
		candidate = { ...http, serverName };
	} else {
		throw new McpError("mcp/invalid-transport", "transport 必须是 stdio 或 streamable-http");
	}
	for (const key of Object.keys(candidate)) {
		const value = candidate[key];
		if (value === undefined || value === null || value === "") delete candidate[key];
	}
	let config;
	try {
		config = McpClientConfig(candidate);
	} catch (error) {
		const message = error?.issues?.map((issue) => issue.message).filter(Boolean).join("；") || error?.message || String(error);
		throw new McpError("mcp/invalid-config", `配置校验失败：${message}`, { cause: error });
	}
	return {
		config,
		disabled: disabled === true,
		note: typeof note === "string" ? note : "",
	};
}

/** 剥离管理字段，得到 loader 条目用的 mcp-client 配置。 */
export function entryConfigOf(server) {
	const { disabled, note, ...config } = server;
	return config;
}

/** 配置与启停状态的稳定比较（对象均为普通 JSON 值，序列化即深比较）。 */
export function configsEqual(left, right) {
	return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

/**
 * dsh-plugin-mcp 的 Cordis 服务：MCP 服务器状态管理与 loader 树投影。
 * 服务键 `mcpManager`，通过 `ctx.mcpManager` 使用。
 */
export class McpManagerService extends Service {
	static inject = ["loader"];

	/** Cordis 配置契约：loader 据此校验 patch 配置并套用默认值。 */
	static Config = Schema.object({
		/** 状态文件绝对路径；留空自动使用 <profileDir>/mcp-servers.json */
		stateFile: Schema.string().default(""),
		/** 在线预设目录地址；留空用默认（dsh-plugins 仓库 presets.json），"off" 禁用在线目录 */
		presetUrl: Schema.string().default(""),
		/** 在线目录拉取超时（毫秒） */
                presetFetchTimeoutMs: Schema.number().min(1).max(120000).default(10000),
	});

	constructor(ctx, config) {
		super(ctx, "mcpManager");
		this.config = config;
		this.stateFile = null;
		this.stateCorrupt = null;
		this.servers = [];
		this.conflicts = new Map();
		/** serverName 的受管条目 id → 动态表达式解析失败列表（如 env:GITHUB_TOKEN）。 */
		this.resolveIssues = new Map();
		this.syncScheduled = false;
		this.syncRunning = false;
                this.syncPending = null;
                this.presetPending = null;
                this.presetController = null;
                this.disposed = false;
                ctx.effect(() => () => {
                        this.disposed = true;
                        this.presetController?.abort();
                }, "dsh-plugin-mcp: lifecycle");
		// 活动预设目录：初始为内置（随包 presets.json），启动后异步拉取在线目录，
		// 失败回退缓存 / 内置。placeholderValues 与 categories 均随活动目录变化。
		this.presets = PRESETS;
		this.categories = PRESET_CATEGORIES;
		this.placeholderValues = PLACEHOLDER_VALUES;
		this.presetSource = "bundled";
		this.presetFetchedAt = null;
		this.presetError = null;
		this.presetUrl = config.presetUrl === "" ? DEFAULT_PRESET_URL : config.presetUrl === "off" ? null : config.presetUrl;
		this.presetCacheFile = null;

		const dir = profileDirOf(ctx);
		this.stateFile = config.stateFile !== "" ? config.stateFile : dir !== null ? join(dir, STATE_FILENAME) : null;
		if (this.stateFile === null) {
			ctx.logger.warn("dsh-plugin-mcp：无法定位 profile 目录且未配置 stateFile，MCP 服务器管理不可用");
			return;
		}
		const loaded = loadStateFile(this.stateFile);
		this.servers = loaded.servers;
		this.stateCorrupt = loaded.corrupt;
		ctx.logger.info(`dsh-plugin-mcp 已激活：状态文件 ${this.stateFile}（${this.servers.length} 台服务器）`);

		// 树写回 / 补丁热重载会整体重建 include 子树，受管条目可能被清掉；
		// 任何 config-update 后重新投影（幂等，微任务去抖，避免重入）。
		if (this.stateFile !== null) {
			this.presetCacheFile = join(dirname(this.stateFile), PRESET_CACHE_FILENAME);
		}
		if (this.presetUrl !== null) {
			void this.loadRemotePresets("activate");
		}

		ctx.on("loader/config-update", () => this.scheduleSync("loader/config-update"));
		void this.sync("activate").catch((error) => {
			ctx.logger.warn(`dsh-plugin-mcp 初始同步失败：${error?.message ?? error}`);
		});

		// Web profile 中注册浏览器半区路由（webServer 属于 Web 组合作用域，
		// headless 等 profile 里保持休眠）。
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = [
					webCtx.webServer.register({
						kind: "exact",
						path: SERVERS_ROUTE,
						handler: (req, res) => this.handleServersRequest(req, res),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: OPERATION_ROUTE,
						handler: (req, res) => this.handleOperationRequest(req, res),
					}),
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "dsh-plugin-mcp: HTTP routes");
			ctx.logger.info(`dsh-plugin-mcp 路由已注册：${SERVERS_ROUTE} 等`);
		});
	}

	/** 活动目录里的分类 id 查找。 */
	categoryOfActive(presetId) {
		for (const category of this.categories) {
			if (category.presetIds.includes(presetId)) return category.id;
		}
		return "other";
	}

	/** 应用一份已校验的目录（远程 / 缓存），更新占位值集合与来源状态。 */
	applyPresetCatalog(catalog, source) {
		this.presets = catalog.presets;
		this.categories = catalog.categories;
		this.placeholderValues = placeholderValuesOf(catalog.presets);
		this.presetSource = source;
		this.presetFetchedAt = new Date().toISOString();
		this.presetError = null;
	}

	/** 在线目录信息（GET 与刷新接口共用）。 */
	presetInfo() {
		return {
			presetUrl: this.presetUrl,
			presetSource: this.presetSource,
			presetFetchedAt: this.presetFetchedAt,
			presetError: this.presetError,
		};
	}

	/**
	 * 拉取在线预设目录：成功 → 生效并写缓存；失败 → 回退缓存文件，再回退内置。
	 * 永不抛出：错误只记录进 presetError，保证激活与列表接口可用。
         * @param reason 刷新原因。
         * @returns 合并后的刷新 Promise，卸载后不再应用结果。
	 */
        async loadRemotePresets(reason) {
                if (this.disposed || this.presetUrl === null) return;
                if (this.presetPending !== null) return this.presetPending;
                this.presetController = new AbortController();
                const signal = this.presetController.signal;
                const pending = this.fetchRemotePresets(reason, signal);
                this.presetPending = pending;
                try {
                        await pending;
                } finally {
                        if (this.presetPending === pending) {
                                this.presetPending = null;
                                this.presetController = null;
                        }
                }
        }

        /** 获取远程目录并回退缓存；参数为原因与卸载信号，返回空 Promise，卸载后不应用。 */
        async fetchRemotePresets(reason, signal) {
		try {
                        const catalog = await fetchPresetCatalog(this.presetUrl, this.config.presetFetchTimeoutMs, (url, init) => fetch(url, {
                                ...init, signal: AbortSignal.any([init.signal, signal]),
                        }));
                        if (this.disposed) return;
			this.applyPresetCatalog(catalog, "remote");
			if (this.presetCacheFile !== null) {
				try {
                                        writeJsonAtomic(this.presetCacheFile, catalog);
				} catch (error) {
					this.ctx.logger.warn(`dsh-plugin-mcp 预设缓存写入失败：${error?.message ?? error}`);
				}
			}
			this.ctx.logger.info(`dsh-plugin-mcp 在线预设已生效（${reason}）：${catalog.presets.length} 个预设`);
		} catch (error) {
                        if (this.disposed) return;
			this.presetError = error?.message ?? String(error);
			if (this.presetCacheFile !== null) {
				try {
					const cached = validatePresetCatalog(JSON.parse(readFileSync(this.presetCacheFile, "utf8")));
                                        if (this.presetSource === "bundled") {
                                                const failure = this.presetError;
                                                this.applyPresetCatalog(cached, "cache");
                                                this.presetError = failure;
                                        }
					this.ctx.logger.info(`dsh-plugin-mcp 预设回退缓存（${reason}）：${cached.presets.length} 个预设`);
					return;
				} catch {
					// 缓存不可用 → 保持内置。
				}
			}
			this.ctx.logger.warn(`dsh-plugin-mcp 在线预设拉取失败（${reason}），保持内置：${this.presetError}`);
		}
	}

	/** 手动刷新在线预设目录（POST refresh-presets 操作）。 */
	async refreshPresets() {
		if (this.presetUrl === null) throw new McpError("mcp/preset-off", "在线预设目录未启用（presetUrl: off）");
		this.presetError = null;
		await this.loadRemotePresets("refresh");
		return this.presetInfo();
	}

	/** 去抖的重新投影（config-update 在树写回期间同步发出，微任务延后执行）。 */
	scheduleSync(reason) {
                if (this.disposed || this.syncScheduled) return;
		this.syncScheduled = true;
		queueMicrotask(() => {
			this.syncScheduled = false;
                        if (this.disposed) return;
			void this.sync(reason).catch((error) => {
				this.ctx.logger.warn(`dsh-plugin-mcp 同步失败（${reason}）：${error?.message ?? error}`);
			});
		});
	}

        /** 串接投影请求，避免重入丢失状态；参数为日志原因，返回本次及此前投影完成的 Promise。 */
	async sync(reason) {
                if (this.disposed) return;
                const previous = this.syncPending ?? Promise.resolve();
                const pending = previous.catch(() => {}).then(() => {
                        if (!this.disposed) return this.drainSync(reason);
                });
                this.syncPending = pending;
		try {
                        await pending;
                } finally {
                        if (this.syncPending === pending) this.syncPending = null;
                }
        }

        /** 执行一次投影；参数为日志原因，返回空 Promise，完成或失败时复原运行标记。 */
        async drainSync(reason) {
                this.syncRunning = true;
                try {
                        await this.project();
		} catch (error) {
			this.ctx.logger.warn(`dsh-plugin-mcp 投影失败（${reason}）：${error?.message ?? error}`);
			throw error;
                } finally {
                        this.syncRunning = false;
		}
	}

	/**
	 * 解析受管条目。受管条目创建在根 include 条目的子树里（与 cordis.patch.yml
	 * 手工条目同级），从 loader 服务寻址需要 `include:<bareId>` 限定路径。
	 * @param bareId - 裸条目 id（mcp-managed-<serverName>）。
	 * @returns Entry，不存在时返回 null。
	 */
	resolveManagedEntry(bareId) {
		try {
			return this.ctx.loader.resolve(`${INCLUDE_ENTRY_ID}:${bareId}`);
		} catch {
			return null;
		}
	}

	/**
	 * 把状态投影进 loader 树：为每台受管服务器创建/更新
	 * `name: @deepseek-ai/dsh-mcp-client` 的条目，移除状态里已不存在的受管条目。
	 * 只在与现状有差异时才调用 Entry.update（无差异时它本身会短路返回），
	 * 避免无谓的 MCP 连接重启。
	 */
	async project() {
		const desired = new Map(this.servers.map((server) => [entryIdOf(server.serverName), server]));
		for (const id of [...this.conflicts.keys()]) {
			if (!desired.has(id)) this.conflicts.delete(id);
		}
		for (const bareId of [...this.resolveIssues.keys()]) {
			if (!desired.has(bareId)) this.resolveIssues.delete(bareId);
		}
		for (const [bareId, server] of desired) {
			const entry = this.resolveManagedEntry(bareId);
			if (entry !== null && entry.options.name !== MCP_MODULE) {
				this.conflicts.set(bareId, entry.options.name);
				continue;
			}
			this.conflicts.delete(bareId);
			// 动态解析：\$env: / \$file: / \${...} 表达式在投影时解析，
			// 解析失败记入 resolveIssues（列表接口展示「未解析」警告）。
			const issues = [];
			const config = resolveConfigValue(entryConfigOf(server), issues);
			this.resolveIssues.set(bareId, issues);
			const disabled = server.disabled === true;
			if (entry === null) {
				await this.ctx.loader.create({ id: bareId, name: MCP_MODULE, config, disabled }, INCLUDE_ENTRY_ID);
			} else if (!configsEqual(entry.options.config, config) || Boolean(entry.options.disabled) !== disabled) {
				await entry.update({ config, disabled });
			}
		}
		for (const entry of this.ctx.loader.entries()) {
			const { id, name } = entry.options;
			if (name === MCP_MODULE && id.startsWith(MANAGED_ID_PREFIX) && !desired.has(id)) {
				// EntryTree.remove 只支持顶层 id，嵌套子树里直接操作父组：
				// 父组持有 include 树，写回由 include 持久化到 cordis.yml。
				entry.parent.remove(id);
				entry.parent.tree.write();
			}
		}
	}

        /** 先落盘再提交内存状态与投影；参数为新列表，返回空 Promise，写盘失败不污染内存。 */
        async persist(servers = this.servers) {
		if (this.stateFile === null) throw new McpError("mcp/no-state", "MCP 服务器管理不可用：未定位状态文件");
		if (this.stateCorrupt !== null) throw new McpError("mcp/state-corrupt", `状态文件损坏（${this.stateCorrupt}）；请人工修复后重试`);
                saveStateFile(this.stateFile, servers);
                this.servers = servers;
		await this.sync("persist");
	}

	/** 新增或更新一台服务器（按 serverName upsert）。 */
	async saveServer(raw) {
		const { config, disabled, note } = normalizeServer(raw);
		// 预设占位值不能直接保存：用户必须先替换成真实值（如 Token / 路径）。
		for (const [key, value] of Object.entries(config.env ?? {})) {
			if (this.placeholderValues.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 ${key}：预设占位值不能直接保存`);
			}
		}
		for (const [index, value] of (config.args ?? []).entries()) {
			if (typeof value === "string" && this.placeholderValues.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 args[${index}]：预设占位值不能直接保存`);
			}
		}
		for (const [key, value] of Object.entries(config.headers ?? {})) {
			if (this.placeholderValues.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 ${key}：预设占位值不能直接保存`);
			}
		}
		// serverName 与手工 cordis.patch.yml 条目冲突时拒绝，避免加载期明确失败。
		const manual = this.manualEntries().find((entry) => entry.options.config?.serverName === config.serverName);
		if (manual !== undefined) {
			throw new McpError("mcp/name-conflict", `serverName「${config.serverName}」已被 cordis.patch.yml 中的条目 ${JSON.stringify(manual.options.id)} 占用`);
		}
		const server = { ...config, disabled, note };
                const next = [...this.servers];
                const index = next.findIndex((item) => item.serverName === server.serverName);
                if (index >= 0) next[index] = server;
                else next.push(server);
                await this.persist(next);
		return server;
	}

	/** 删除一台受管服务器。 */
	async removeServer(serverName) {
		const index = this.servers.findIndex((item) => item.serverName === serverName);
		if (index < 0) return false;
                const next = [...this.servers];
                next.splice(index, 1);
                await this.persist(next);
		return true;
	}

	/** 启停一台受管服务器。 */
	async setEnabled(serverName, enabled) {
		const server = this.servers.find((item) => item.serverName === serverName);
		if (server === undefined) return false;
		if ((server.disabled === true) === !enabled) return true;
                await this.persist(this.servers.map((item) => item === server ? { ...item, disabled: !enabled } : item));
		return true;
	}

	/** 状态文件里某台服务器的完整配置（编辑表单预填用）。 */
	findServer(serverName) {
		return this.servers.find((item) => item.serverName === serverName) ?? null;
	}

	/** loader 树里的手工 mcp-client 条目（id 不带受管前缀）。 */
	manualEntries() {
		const result = [];
		for (const entry of this.ctx.loader.entries()) {
			const { id, name } = entry.options;
			if (name === MCP_MODULE && !id.startsWith(MANAGED_ID_PREFIX)) result.push(entry);
		}
		return result;
	}

	/** 受管条目的运行状态。 */
	statusOf(bareId) {
		const entry = this.resolveManagedEntry(bareId);
		if (entry === null) return "pending";
		if (entry.disabled) return "disabled";
		const state = entry.fiber?.state;
		if (state === FIBER_ACTIVE) return "active";
		if (state === FIBER_FAILED) return "failed";
		if (state === undefined) return "starting";
		return "stopped";
	}

	/** 敏感字段掩码（env / headers 值），列表接口用。 */
	maskConfig(config) {
		const masked = { ...config };
		for (const key of ["env", "headers"]) {
			if (masked[key] === null || typeof masked[key] !== "object") continue;
			masked[key] = Object.fromEntries(Object.entries(masked[key]).map(([name]) => [name, MASKED_VALUE]));
		}
		return masked;
	}

	/** 供浏览器半区渲染的快照。 */
	snapshot() {
		const servers = this.servers.map((server) => {
			const id = entryIdOf(server.serverName);
			const conflictWith = this.conflicts.get(id) ?? null;
			return {
				id,
				serverName: server.serverName,
				transport: server.transport,
				config: this.maskConfig(entryConfigOf(server)),
				disabled: server.disabled === true,
				note: server.note ?? "",
				status: conflictWith !== null ? "conflict" : this.statusOf(id),
				conflictWith,
				resolveIssues: this.resolveIssues.get(id) ?? [],
			};
		});
		const manual = this.manualEntries().map((entry) => {
			const config = entry.options.config ?? {};
			return {
				id: entry.options.id,
				serverName: typeof config.serverName === "string" ? config.serverName : "",
				transport: typeof config.transport === "string" ? config.transport : "",
				disabled: entry.disabled === true,
				status: entry.disabled ? "disabled" : this.statusOf(entry.options.id),
			};
		});
		return { servers, manual };
	}

	/**
	 * 预设目录的浏览器视图：附带「是否已添加」状态（受管或手工同名）与分类 id。
	 * @returns 预设列表。
	 */
	presetsView() {
		const names = new Set([
			...this.servers.map((server) => server.serverName),
			...this.manualEntries().map((entry) => entry.options.config?.serverName).filter((name) => typeof name === "string"),
		]);
		return this.presets.map((preset) => ({ ...preset, category: this.categoryOfActive(preset.id), added: names.has(preset.server.serverName) }));
	}

	/** GET {SERVERS_ROUTE} —— 列表 + 手工条目 + 预设目录 + 状态文件信息。 */
	async handleServersRequest(req, res) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "GET" && req.method !== "HEAD") {
				payload(405, { ok: false, code: "mcp/method", message: "method not allowed" });
				return;
			}
			payload(200, {
				ok: true,
				stateFile: this.stateFile,
				corrupt: this.stateCorrupt,
				categories: this.categories.map(({ presetIds, ...category }) => category),
				presets: this.presetsView(),
				...this.presetInfo(),
				...this.snapshot(),
			});
		} catch (error) {
			payload(500, { ok: false, code: error.code ?? "mcp/list", message: error.message });
		}
	}

	/** POST 管理路由：save / remove / enable / detail。 */
	async handleOperationRequest(req, res) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "POST") {
				payload(405, { ok: false, code: "mcp/method", message: "method not allowed" });
				return;
			}
			let body = {};
			try {
				const chunks = [];
                                let bytes = 0;
                                for await (const chunk of req) {
                                        bytes += Buffer.byteLength(chunk);
                                        if (bytes > 1024 * 1024) throw new McpError("mcp/body-too-large", "请求体超过 1MB");
                                        chunks.push(Buffer.from(chunk));
                                }
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
                                if (body === null || typeof body !== "object" || Array.isArray(body)) throw new McpError("mcp/invalid-json", "请求体必须是 JSON 对象");
                        } catch (error) {
                                if (error instanceof McpError) throw error;
				payload(400, { ok: false, code: "mcp/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			const operation = String(body.operation ?? "");
                        switch (operation) {
                        case "save": {
				await this.saveServer(body.server ?? {});
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
                        case "remove": {
				const serverName = String(body.serverName ?? "").trim();
				if (serverName === "") {
					payload(400, { ok: false, code: "mcp/invalid-name", message: "缺少 serverName" });
					return;
				}
				await this.removeServer(serverName);
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
                        case "enable": {
				const serverName = String(body.serverName ?? "").trim();
				if (serverName === "") {
					payload(400, { ok: false, code: "mcp/invalid-name", message: "缺少 serverName" });
					return;
				}
				await this.setEnabled(serverName, body.enabled === true);
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
                        case "refresh-presets": {
				await this.refreshPresets();
				payload(200, { ok: true, categories: this.categories.map(({ presetIds, ...category }) => category), presets: this.presetsView(), ...this.presetInfo(), ...this.snapshot() });
				return;
			}
                        case "detail": {
				const serverName = String(body.serverName ?? "").trim();
				const server = serverName === "" ? null : this.findServer(serverName);
				if (server === null) {
					payload(404, { ok: false, code: "mcp/not-found", message: `找不到服务器「${serverName}」` });
					return;
				}
				payload(200, { ok: true, server: { ...server, id: entryIdOf(server.serverName) } });
				return;
			}
                        default:
                                payload(400, { ok: false, code: "mcp/unknown-operation", message: `未知操作：${operation}` });
                        }
		} catch (error) {
			if (error instanceof McpError) {
                                const status = error.code === "mcp/body-too-large" ? 413
                                        : error.code.startsWith("mcp/invalid") || error.code === "mcp/name-conflict" ? 400 : error.code === "mcp/state-corrupt" ? 409 : 500;
				payload(status, { ok: false, code: error.code, message: error.message });
				return;
			}
			payload(500, { ok: false, code: "mcp/internal", message: error.message });
		}
	}
}

export default McpManagerService;
