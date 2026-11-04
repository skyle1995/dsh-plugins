/**
 * lib/zip.js 的类型声明。
 */
export declare function crc32(buffer: Uint8Array): number;
export declare function dosDateTime(mtime: number | string | Date): { time: number; date: number };
export interface ZipEntry {
	name: string;
	data?: Uint8Array;
	dir?: boolean;
	mtime?: number | string | Date;
}
/** ZIP 资源限制；参数分别为单文件、总输入字节数与最大条目数。 */
export interface ZipOptions {
        maxFileBytes?: number;
        maxTotalBytes?: number;
        maxEntries?: number;
}
export declare function buildZipBuffer(entries: ZipEntry[]): Buffer;
export declare function uniqueEntryName(name: string, used: Set<string>): string;
export declare function collectZipEntries(
	hostSources: string[],
        options?: ZipOptions & { rootNames?: string[] },
): Promise<{ entries: ZipEntry[]; skipped: number }>;
export declare function createZipBuffer(
	hostSources: string[],
        options?: ZipOptions,
): Promise<{ buffer: Buffer; entries: ZipEntry[]; skipped: number }>;
/** 流式创建 ZIP；参数为源、未存在的输出路径和限制，返回条目、跳过数与输出字节数。 */
export declare function writeZipFile(
        hostSources: string[],
        outputPath: string,
        options?: ZipOptions & { excludePaths?: string[] },
): Promise<{ entries: number; skipped: number; bytes: number }>;
