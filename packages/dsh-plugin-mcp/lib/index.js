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
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
 * 热门 MCP 服务器预设：官方 @modelcontextprotocol 参考服务器 + 逆向 / 安全
 * 分析工具（Reqable、IDA Pro、Ghidra、Binary Ninja、Frida、JADX、VirusTotal）。
 * `inputs` 列出需要用户补全的字段路径（如 "env.GITHUB_TOKEN"、"args[0]"）：
 * 对应值在 `server` 里是占位文本，保存时会被拦截，必须先改成真实值。
 * 无 `inputs` 的预设零配置，可一键直接添加；前置条件（工具本体 / 插件）
 * 写在 description 里。
 */
export const PRESETS = [
	{
		id: "github",
		name: "GitHub",
		description: {
			zh: "GitHub 仓库管理：创建 Issue / PR、搜索代码与仓库。",
			en: "GitHub repos: create issues/PRs, search code and repositories.",
		},
		server: {
			serverName: "github",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-github"],
			env: { GITHUB_TOKEN: "在此填入你的 GitHub Token（Settings → Developer settings → Personal access tokens）" },
		},
		inputs: ["env.GITHUB_TOKEN"],
	},
	{
		id: "filesystem",
		name: "Filesystem",
		description: {
			zh: "安全的文件系统访问：读写 / 搜索 / 列目录（限定允许目录）。",
			en: "Secure filesystem access: read/write/search/list within allowed directories.",
		},
		server: {
			serverName: "filesystem",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-filesystem", "/在此填入允许访问的目录绝对路径"],
		},
		inputs: ["args[2]"],
	},
	{
		id: "memory",
		name: "Memory",
		description: {
			zh: "知识图谱记忆：跨会话记住实体与关系。",
			en: "Knowledge-graph memory: remember entities and relations across sessions.",
		},
		server: {
			serverName: "memory",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-memory"],
		},
	},
	{
		id: "sequential-thinking",
		name: "Sequential Thinking",
		description: {
			zh: "结构化分步思考：复杂推理的思维链工具。",
			en: "Structured step-by-step thinking for complex reasoning.",
		},
		server: {
			serverName: "sequential-thinking",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
		},
	},
	{
		id: "time",
		name: "Time",
		description: {
			zh: "时间与时区：获取当前时间、换算时区。",
			en: "Time and timezones: current time and zone conversion.",
		},
		server: {
			serverName: "time",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-time"],
		},
	},
	{
		id: "fetch",
		name: "Fetch",
		description: {
			zh: "网页抓取：把 URL 内容转成 Markdown。",
			en: "Web fetching: convert URLs to Markdown content.",
		},
		server: {
			serverName: "fetch",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-fetch"],
		},
	},
	{
		id: "brave-search",
		name: "Brave Search",
		description: {
			zh: "Brave 网络搜索：网页 / 本地 / 新闻检索。",
			en: "Brave web search: web/local/news queries.",
		},
		server: {
			serverName: "brave-search",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-brave-search"],
			env: { BRAVE_API_KEY: "在此填入你的 Brave Search API Key" },
		},
		inputs: ["env.BRAVE_API_KEY"],
	},
	{
		id: "puppeteer",
		name: "Puppeteer",
		description: {
			zh: "浏览器自动化：导航、截图、点击、执行 JS。",
			en: "Browser automation: navigate, screenshot, click, run JS.",
		},
		server: {
			serverName: "puppeteer",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-puppeteer"],
		},
	},
	{
		id: "gitlab",
		name: "GitLab",
		description: {
			zh: "GitLab 仓库管理：Issue / MR / 仓库操作。",
			en: "GitLab repos: issues, merge requests, and repo operations.",
		},
		server: {
			serverName: "gitlab",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-gitlab"],
			env: { GITLAB_PERSONAL_ACCESS_TOKEN: "在此填入你的 GitLab Personal Access Token" },
		},
		inputs: ["env.GITLAB_PERSONAL_ACCESS_TOKEN"],
	},
	{
		id: "slack",
		name: "Slack",
		description: {
			zh: "Slack 工作区：频道 / 消息 / 线程 / 用户管理。",
			en: "Slack workspace: channels, messages, threads, users.",
		},
		server: {
			serverName: "slack",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-slack"],
			env: {
				SLACK_BOT_TOKEN: "在此填入你的 Slack Bot Token（xoxb-...）",
				SLACK_TEAM_ID: "在此填入你的 Slack Team ID",
			},
		},
		inputs: ["env.SLACK_BOT_TOKEN", "env.SLACK_TEAM_ID"],
	},
	{
		id: "sentry",
		name: "Sentry",
		description: {
			zh: "Sentry 错误追踪：查询 issue 与事件。",
			en: "Sentry error tracking: query issues and events.",
		},
		server: {
			serverName: "sentry",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-sentry"],
			env: { SENTRY_TOKEN: "在此填入你的 Sentry Auth Token" },
		},
		inputs: ["env.SENTRY_TOKEN"],
	},
	{
		id: "postgres",
		name: "PostgreSQL",
		description: {
			zh: "PostgreSQL 数据库：只读查询与 schema 检查。",
			en: "PostgreSQL database: read-only queries and schema inspection.",
		},
		server: {
			serverName: "postgres",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@localhost:5432/dbname（在此填入你的连接串）"],
		},
		inputs: ["args[2]"],
	},
	{
		id: "sqlite",
		name: "SQLite",
		description: {
			zh: "SQLite 数据库：查询与 schema 检查。",
			en: "SQLite database: queries and schema inspection.",
		},
		server: {
			serverName: "sqlite",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-sqlite", "/在此填入数据库文件绝对路径"],
		},
		inputs: ["args[2]"],
	},
	{
		id: "everything",
		name: "Everything",
		description: {
			zh: "演示 / 测试服务器：覆盖各种 MCP 特性（echo、日志、资源）。",
			en: "Demo/test server: covers assorted MCP features (echo, logging, resources).",
		},
		server: {
			serverName: "everything",
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-everything"],
		},
	},
	// ---- 逆向 / 安全分析 ----
	{
		id: "reqable",
		name: "Reqable",
		description: {
			zh: "Reqable 抓包调试：分析抓包记录、断点 / 重写 / 脚本规则、API 集合管理（需本机 Reqable v3.2.0+ 运行中）。",
			en: "Reqable traffic capture: analyze captures, breakpoints/rewrites/scripts, API collections (requires Reqable v3.2.0+ running locally).",
		},
		server: {
			serverName: "reqable",
			transport: "stdio",
			command: "npx",
			args: ["-y", "reqable-mcp-server"],
		},
	},
	{
		id: "ida-pro",
		name: "IDA Pro",
		description: {
			zh: "Hex-Rays 官方 IDA MCP：反编译 / 反汇编 / 交叉引用 / 重命名 / 调试（需 IDA Pro 9.4+ 与 idalib，且已安装 uv）。",
			en: "Official Hex-Rays IDA MCP: decompile/disassemble/xrefs/rename/debug (requires IDA Pro 9.4+ with idalib and uv).",
		},
		server: {
			serverName: "ida-pro",
			transport: "stdio",
			command: "uvx",
			args: ["--exclude-newer=1s", "ida-mcp", "stdio", "--agent=dsh"],
		},
	},
	{
		id: "ghidra",
		name: "Ghidra",
		description: {
			zh: "Ghidra 逆向：反编译 / 自动重命名 / 交叉引用（需 Ghidra 12.1.4+ 并安装 GhidraMCP 插件，默认本地 8080）。",
			en: "Ghidra reversing: decompile/rename/xrefs (requires Ghidra 12.1.4+ with the GhidraMCP plugin, default local 8080).",
		},
		server: {
			serverName: "ghidra",
			transport: "stdio",
			command: "uvx",
			args: ["--from", "git+https://github.com/LaurieWired/GhidraMCP", "ghidra-mcp", "--ghidra-server", "http://127.0.0.1:8080/"],
		},
	},
	{
		id: "binary-ninja",
		name: "Binary Ninja",
		description: {
			zh: "Binary Ninja 逆向：反编译 / IL / 交叉引用 / 重命名 / 补丁（需安装 binary_ninja_mcp 插件，默认本地 9009）。",
			en: "Binary Ninja reversing: decompile/IL/xrefs/rename/patch (requires the binary_ninja_mcp plugin, default local 9009).",
		},
		server: {
			serverName: "binary-ninja",
			transport: "stdio",
			command: "npx",
			args: ["-y", "binary-ninja-mcp", "--host", "localhost", "--port", "9009"],
		},
	},
	{
		id: "frida",
		name: "Frida",
		description: {
			zh: "Frida 动态插桩：进程 / 设备管理、attach / spawn、JS 脚本注入与交互式 REPL。",
			en: "Frida dynamic instrumentation: process/device management, attach/spawn, JS injection and interactive REPL.",
		},
		server: {
			serverName: "frida",
			transport: "stdio",
			command: "uvx",
			args: ["frida-mcp-server"],
		},
	},
	{
		id: "jadx",
		name: "JADX",
		description: {
			zh: "Android 逆向：操控 JADX 分析 APK / DEX（反编译、搜索、交叉引用）。需先按 jadx-ai-mcp 文档安装 JADX 插件并克隆仓库。",
			en: "Android reversing: drive JADX to analyze APK/DEX (decompile, search, xrefs). Install the JADX plugin and clone jadx-ai-mcp first.",
		},
		server: {
			serverName: "jadx",
			transport: "stdio",
			command: "uv",
			args: ["--directory", "/在此填入 jadx-ai-mcp/jadx-mcp-server 目录绝对路径", "run", "jadx_mcp_server.py"],
		},
		inputs: ["args[1]"],
	},
	{
		id: "virustotal",
		name: "VirusTotal",
		description: {
			zh: "官方 VirusTotal MCP（VTAI）：文件 / URL / 域名 / IP 威胁情报查询与提交分析。需先在 ai.virustotal.com 创建 VTAI Agent Token。",
			en: "Official VirusTotal MCP (VTAI): file/URL/domain/IP threat intelligence and analysis submission. Create a VTAI Agent Token first.",
		},
		server: {
			serverName: "virustotal",
			transport: "stdio",
			command: "uvx",
			args: ["vt-mcp"],
			env: { VTAI_TOKEN_FILE: "在此填入你的 VTAI Agent Token 文件路径（如 ~/.config/vt-mcp/token）" },
		},
		inputs: ["env.VTAI_TOKEN_FILE"],
	},
];

/**
 * 预设分类：显式的 id → 预设 id 集合映射，展示顺序即此处顺序。
 * 未列出的预设归入 `other`（UI 显示「其他」）。
 */
export const PRESET_CATEGORIES = [
	{
		id: "dev",
		zh: "通用开发",
		en: "Development",
		presetIds: [
			"github", "filesystem", "memory", "sequential-thinking", "time", "fetch",
			"brave-search", "puppeteer", "gitlab", "slack", "sentry", "postgres", "sqlite", "everything",
		],
	},
	{
		id: "reversing",
		zh: "逆向 / 安全",
		en: "Reversing & Security",
		presetIds: ["reqable", "ida-pro", "ghidra", "binary-ninja", "frida", "jadx", "virustotal"],
	},
];

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
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, JSON.stringify({ version: 1, servers }, null, 2) + "\n", { mode: 0o600 });
	renameSync(tmp, file);
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
	});

	constructor(ctx, config) {
		super(ctx, "mcpManager");
		this.config = config;
		this.stateFile = null;
		this.stateCorrupt = null;
		this.servers = [];
		this.conflicts = new Map();
		this.syncScheduled = false;
		this.syncRunning = false;

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

	/** 去抖的重新投影（config-update 在树写回期间同步发出，微任务延后执行）。 */
	scheduleSync(reason) {
		if (this.syncScheduled) return;
		this.syncScheduled = true;
		queueMicrotask(() => {
			this.syncScheduled = false;
			void this.sync(reason).catch((error) => {
				this.ctx.logger.warn(`dsh-plugin-mcp 同步失败（${reason}）：${error?.message ?? error}`);
			});
		});
	}

	/** 串行执行一次投影（重入直接返回）。 */
	async sync(reason) {
		if (this.syncRunning) return;
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
		for (const [bareId, server] of desired) {
			const entry = this.resolveManagedEntry(bareId);
			if (entry !== null && entry.options.name !== MCP_MODULE) {
				this.conflicts.set(bareId, entry.options.name);
				continue;
			}
			this.conflicts.delete(bareId);
			const config = entryConfigOf(server);
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

	/** 持久化状态并投影。 */
	async persist() {
		if (this.stateFile === null) throw new McpError("mcp/no-state", "MCP 服务器管理不可用：未定位状态文件");
		if (this.stateCorrupt !== null) throw new McpError("mcp/state-corrupt", `状态文件损坏（${this.stateCorrupt}）；请人工修复后重试`);
		saveStateFile(this.stateFile, this.servers);
		await this.sync("persist");
	}

	/** 新增或更新一台服务器（按 serverName upsert）。 */
	async saveServer(raw) {
		const { config, disabled, note } = normalizeServer(raw);
		// 预设占位值不能直接保存：用户必须先替换成真实值（如 Token / 路径）。
		for (const [key, value] of Object.entries(config.env ?? {})) {
			if (PLACEHOLDER_VALUES.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 ${key}：预设占位值不能直接保存`);
			}
		}
		for (const [index, value] of (config.args ?? []).entries()) {
			if (typeof value === "string" && PLACEHOLDER_VALUES.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 args[${index}]：预设占位值不能直接保存`);
			}
		}
		for (const [key, value] of Object.entries(config.headers ?? {})) {
			if (PLACEHOLDER_VALUES.has(value)) {
				throw new McpError("mcp/placeholder", `请先填写 ${key}：预设占位值不能直接保存`);
			}
		}
		// serverName 与手工 cordis.patch.yml 条目冲突时拒绝，避免加载期明确失败。
		const manual = this.manualEntries().find((entry) => entry.options.config?.serverName === config.serverName);
		if (manual !== undefined) {
			throw new McpError("mcp/name-conflict", `serverName「${config.serverName}」已被 cordis.patch.yml 中的条目 ${JSON.stringify(manual.options.id)} 占用`);
		}
		const server = { ...config, disabled, note };
		const index = this.servers.findIndex((item) => item.serverName === server.serverName);
		if (index >= 0) this.servers[index] = server;
		else this.servers.push(server);
		await this.persist();
		return server;
	}

	/** 删除一台受管服务器。 */
	async removeServer(serverName) {
		const index = this.servers.findIndex((item) => item.serverName === serverName);
		if (index < 0) return false;
		this.servers.splice(index, 1);
		await this.persist();
		return true;
	}

	/** 启停一台受管服务器。 */
	async setEnabled(serverName, enabled) {
		const server = this.servers.find((item) => item.serverName === serverName);
		if (server === undefined) return false;
		if ((server.disabled === true) === !enabled) return true;
		server.disabled = !enabled;
		await this.persist();
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
		return PRESETS.map((preset) => ({ ...preset, category: categoryOf(preset.id), added: names.has(preset.server.serverName) }));
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
				categories: PRESET_CATEGORIES.map(({ presetIds, ...category }) => category),
				presets: this.presetsView(),
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
				for await (const chunk of req) chunks.push(chunk);
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
			} catch {
				payload(400, { ok: false, code: "mcp/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			const operation = String(body.operation ?? "");
			if (operation === "save") {
				await this.saveServer(body.server ?? {});
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
			if (operation === "remove") {
				const serverName = String(body.serverName ?? "").trim();
				if (serverName === "") {
					payload(400, { ok: false, code: "mcp/invalid-name", message: "缺少 serverName" });
					return;
				}
				await this.removeServer(serverName);
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
			if (operation === "enable") {
				const serverName = String(body.serverName ?? "").trim();
				if (serverName === "") {
					payload(400, { ok: false, code: "mcp/invalid-name", message: "缺少 serverName" });
					return;
				}
				await this.setEnabled(serverName, body.enabled === true);
				payload(200, { ok: true, ...this.snapshot() });
				return;
			}
			if (operation === "detail") {
				const serverName = String(body.serverName ?? "").trim();
				const server = serverName === "" ? null : this.findServer(serverName);
				if (server === null) {
					payload(404, { ok: false, code: "mcp/not-found", message: `找不到服务器「${serverName}」` });
					return;
				}
				payload(200, { ok: true, server: { ...server, id: entryIdOf(server.serverName) } });
				return;
			}
			payload(400, { ok: false, code: "mcp/unknown-operation", message: `未知操作：${operation}` });
		} catch (error) {
			if (error instanceof McpError) {
				const status = error.code.startsWith("mcp/invalid") || error.code === "mcp/name-conflict" ? 400 : error.code === "mcp/state-corrupt" ? 409 : 500;
				payload(status, { ok: false, code: error.code, message: error.message });
				return;
			}
			payload(500, { ok: false, code: "mcp/internal", message: error.message });
		}
	}
}

export default McpManagerService;
