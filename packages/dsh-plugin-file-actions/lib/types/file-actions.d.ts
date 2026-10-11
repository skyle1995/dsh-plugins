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
export declare function buildZipBuffer(entries: ZipEntry[]): Buffer;
export declare function uniqueEntryName(name: string, used: Set<string>): string;
export declare function collectZipEntries(
	hostSources: string[],
	options?: { maxFileBytes?: number; rootNames?: string[] },
): Promise<{ entries: ZipEntry[]; skipped: number }>;
export declare function createZipBuffer(
	hostSources: string[],
	options?: { maxFileBytes?: number },
): Promise<{ buffer: Buffer; entries: ZipEntry[]; skipped: number }>;
