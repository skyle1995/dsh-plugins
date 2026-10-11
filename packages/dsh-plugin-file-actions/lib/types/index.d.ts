/**
 * dsh-plugin-file-actions 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Service } from "@deepseek-ai/cordis";

/** 插件配置契约。 */
export interface FileActionsConfig {
	/** 压缩时单文件大小上限（字节），超限跳过并计入 skipped。默认 268435456 */
	maxZipFileBytes: number;
}

/** 带错误码的操作失败。 */
export declare class FileActionsError extends Error {
	code: string;
	constructor(code: string, message: string, options?: ErrorOptions);
}

/** 复制 / 移动 / 删除 / 压缩的请求体（浏览器半区提交工作区绝对路径）。 */
export interface FileActionsRequest {
	/** 文件树根目录（工作区根），宿主据此匹配会话。 */
	workspaceRoot: string;
	/** 源路径（复制/移动/压缩）；删除时为待删除路径。 */
	sources?: string[];
	paths?: string[];
	/** 目标目录（复制/移动/压缩）。 */
	destination?: string;
}

/**
 * dsh-plugin-file-actions 的 Cordis 服务（服务键 fileActions）。
 * 注入面：fs / sessions / sandboxPolicy（与官方 workspaceFiles 一致）。
 */
export declare class FileActionsService extends Service {
	static inject: string[];
	static Config: unknown;
	constructor(ctx: any, config: FileActionsConfig);
	resolveWorkspaceRoot(workspaceRoot: string): Promise<{ workspaceRoot: string; source: "session" | "sandbox" }>;
	confine(workspaceRoot: string, path: string, options?: { signal?: AbortSignal }): Promise<string>;
	copyEntries(request: FileActionsRequest): Promise<{ count: number; destination: string }>;
	moveEntries(request: FileActionsRequest): Promise<{ count: number; destination: string }>;
	deleteEntries(request: FileActionsRequest): Promise<{ count: number; missing: number }>;
	compressEntries(request: FileActionsRequest): Promise<{ name: string; count: number; skipped: number }>;
	handleRequest(req: any, res: any, operation: "copy" | "move" | "delete" | "compress"): Promise<void>;
}

export default FileActionsService;
export const FILE_ACTIONS_API: string;
export const DEFAULT_MAX_ZIP_FILE_BYTES: number;
