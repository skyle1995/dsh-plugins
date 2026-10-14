/**
 * dsh-plugin-mcp 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface McpManagerConfig {
	/** 状态文件绝对路径；留空自动使用 <profileDir>/mcp-servers.json */
	stateFile: string;
}

/** 状态文件里一台受管服务器的完整形态（mcp-client 规范化配置 + 管理字段）。 */
export interface McpServer {
	/** 工具命名空间，匹配 [A-Za-z0-9_-]{1,32} */
	serverName: string;
	/** stdio 或 streamable-http */
	transport: "stdio" | "streamable-http";
	/** stdio：可执行文件 */
	command?: string;
	/** stdio：参数 */
	args?: string[];
	/** stdio：额外环境变量 */
	env?: Record<string, string>;
	/** stdio：工作目录 */
	cwd?: string;
	/** streamable-http：端点 URL */
	url?: string;
	/** streamable-http：额外请求标头 */
	headers?: Record<string, string>;
	/** 每次 tools/call 或资源请求的超时（毫秒），默认 60000 */
	toolCallTimeoutMs?: number;
	/** 初始连接失败时拒绝插件激活，默认 false */
	failOnStartupError?: boolean;
	/** 自动重连策略 */
	reconnect?: {
		enabled?: boolean;
		initialDelayMs?: number;
		maxDelayMs?: number;
		maxAttempts?: number;
	};
	/** 管理字段：是否停用该服务器 */
	disabled?: boolean;
	/** 管理字段：备注说明 */
	note?: string;
}

/** 列表接口里一台受管服务器的展示形态。 */
export interface McpServerView {
	id: string;
	serverName: string;
	transport: "stdio" | "streamable-http";
	/** env / headers 值已掩码的配置 */
	config: Record<string, unknown>;
	disabled: boolean;
	note: string;
	/** active | failed | stopped | starting | pending | disabled | conflict */
	status: string;
	/** id 被其他模块占用时的占用者模块名 */
	conflictWith: string | null;
}

/** 列表接口里一条手工（cordis.patch.yml）mcp-client 条目。 */
export interface McpManualEntry {
	id: string;
	serverName: string;
	transport: string;
	disabled: boolean;
	status: string;
}

export interface McpSnapshot {
	servers: McpServerView[];
	manual: McpManualEntry[];
}

/** 热门预设：一键添加的常用 MCP 服务器。 */
export interface McpPreset {
	id: string;
	name: string;
	description: { zh: string; en: string };
	server: McpServer;
	/** 需要用户补全的字段路径（如 env.GITHUB_TOKEN、args[0]），值为占位文本 */
	inputs?: string[];
	/** 是否已添加（受管或手工同名 serverName） */
	added?: boolean;
	/** 分类 id（见 PRESET_CATEGORIES） */
	category?: string;
}

/** 预设分类（presetIds 仅供宿主映射，接口不返回）。 */
export interface McpPresetCategory {
	id: string;
	zh: string;
	en: string;
	presetIds: string[];
}

export const PRESETS: McpPreset[];
export const PLACEHOLDER_VALUES: Set<string>;
export const PRESET_CATEGORIES: McpPresetCategory[];
export function categoryOf(presetId: string): string;

export class McpError extends Error {
	code: string;
}

export function entryIdOf(serverName: string): string;
export function profileDirOf(ctx: Context): string | null;
export function loadStateFile(file: string): { servers: McpServer[]; corrupt: string | null };
export function saveStateFile(file: string, servers: McpServer[]): void;
export function normalizeServer(raw: unknown): { config: Record<string, unknown>; disabled: boolean; note: string };
export function entryConfigOf(server: McpServer): Record<string, unknown>;
export function configsEqual(left: unknown, right: unknown): boolean;

export class McpManagerService extends Service {
	constructor(ctx: Context, config: McpManagerConfig);
	readonly stateFile: string | null;
	readonly stateCorrupt: string | null;
	saveServer(raw: unknown): Promise<McpServer>;
	removeServer(serverName: string): Promise<boolean>;
	setEnabled(serverName: string, enabled: boolean): Promise<boolean>;
	findServer(serverName: string): McpServer | null;
	snapshot(): McpSnapshot;
	presetsView(): McpPreset[];
	project(): Promise<void>;
}

export default McpManagerService;
