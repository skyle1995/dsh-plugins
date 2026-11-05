/**
 * dsh-plugin-file-actions 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Service } from "@deepseek-ai/cordis";
export { crc32, buildZipBuffer, collectZipEntries, createZipBuffer, writeZipFile } from "./file-actions.js";

/** 插件配置契约。 */
export interface FileActionsConfig {
	/** 压缩时单文件大小上限（字节），超限跳过并计入 skipped。默认 268435456 */
	maxZipFileBytes: number;
	/** 文本编辑（读取/保存）的文件大小上限（字节），默认 1048576。 */
	maxEditBytes: number;
        /** 压缩总输入大小上限，默认 1GB；参数为字节数。 */
        maxZipTotalBytes?: number;
        /** 压缩条目数上限，默认 10000，含目录。 */
        maxZipEntries?: number;
        /** 批量路径数上限，默认 1000。 */
        maxBatchPaths?: number;
}

/** 带错误码的操作失败。 */
export declare class FileActionsError extends Error {
	code: string;
        /** 批量操作失败时已完成源及当前失败目标。 */
        details?: { completed: string[]; failed: string; target: string };
	constructor(code: string, message: string, options?: ErrorOptions);
}

/** 复制 / 移动 / 重命名 / 删除 / 压缩的请求体（浏览器半区提交工作区绝对路径）。 */
export interface FileActionsRequest {
	/** 文件树根目录（工作区根），宿主据此匹配会话。 */
	workspaceRoot: string;
	/** 源路径（复制/移动/压缩）；删除时为待删除路径。 */
	sources?: string[];
	paths?: string[];
	/** 待重命名的单个路径（重命名）。 */
	path?: string;
	/** 目标目录（复制/移动/压缩）。 */
	destination?: string;
	/** 压缩包文件名（可选；自动剥离目录部分并补 .zip 后缀）；
         *  重命名时为宿主平台合法的单段名字；POSIX 保留空格与反斜杠。 */
	name?: string;
        /** 读取返回的版本标识；保存时校验外部修改，缺省保留旧服务调用兼容性。 */
        version?: string;
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
	renameEntry(request: FileActionsRequest): Promise<{ name: string; from?: string; unchanged?: boolean }>;
	deleteEntries(request: FileActionsRequest): Promise<{ count: number; missing: number }>;
	compressEntries(request: FileActionsRequest): Promise<{ name: string; count: number; skipped: number }>;
        readTextEntry(request: FileActionsRequest): Promise<{ content: string; bytes: number; truncated: boolean; version: string }>;
        saveTextEntry(request: FileActionsRequest & { content?: string }): Promise<{ bytes: number; version: string }>;
	formatTextEntry(request: FileActionsRequest & { content?: string }): Promise<{ content: string; parser: string }>;
	handleRequest(req: any, res: any, operation: "copy" | "move" | "rename" | "delete" | "compress" | "read" | "save" | "format"): Promise<void>;
}

export default FileActionsService;
export const FILE_ACTIONS_API: string;
export const DEFAULT_MAX_ZIP_FILE_BYTES: number;
export const DEFAULT_MAX_EDIT_BYTES: number;
export const DEFAULT_MAX_ZIP_TOTAL_BYTES: number;
export const DEFAULT_MAX_ZIP_ENTRIES: number;
export const DEFAULT_MAX_BATCH_PATHS: number;
export declare function zipNameFor(sourceNames: string[]): string;
export declare function sanitizeZipName(name: unknown, platform?: string): string;
export declare function sanitizeEntryName(name: unknown, platform?: string): string;
export declare function parserForPath(path: unknown): string | null;
