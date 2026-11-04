/**
 * dsh-plugin-file-actions —— 无依赖 ZIP 写入器。
 *
 * 直接用 node:zlib 的 deflateRawSync 生成标准 ZIP（local file header +
 * central directory + EOCD），UTF-8 名称（language encoding flag），
 * 目录以 "/" 结尾的零长条目表示；符号链接跳过并计数。单个文件超过
 * maxZipFileBytes 时跳过，避免把超大文件整体读入内存。
 *
 * @module dsh-plugin-file-actions/zip
 */
import { createDeflateRaw, deflateRawSync } from "node:zlib";
import { lstat, open, readdir, readFile, rm } from "node:fs/promises";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** 标准 CRC-32（与 ZIP 规范一致）查表实现。 */
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
		table[n] = c;
	}
	return table;
})();

/** 计算一段字节的 CRC-32。 */
export function crc32(buffer) {
	let c = 0xffffffff;
	for (let i = 0; i < buffer.length; i++) c = (CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)) >>> 0;
	return (c ^ 0xffffffff) >>> 0;
}

/** 转换 ZIP 的 DOS 日期；参数为时间，返回钳制在 1980 至 2107 年内的字段。 */
export function dosDateTime(mtime) {
        let date = new Date(mtime);
        if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1980) date = new Date(1980, 0, 1);
        if (date.getFullYear() > 2107) date = new Date(2107, 11, 31, 23, 59, 58);
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return { time, date: day };
}

/**
 * 把条目数组序列化为完整 ZIP Buffer。
 * @param entries - `{ name, data?, dir?, mtime? }`；目录条目 dir:true（data 忽略）。
 */
export function buildZipBuffer(entries) {
        checkZipLimit(entries.length, 65535, "ZIP 条目数量");
	const locals = [];
	const central = [];
	let offset = 0;
	for (const entry of entries) {
		const nameBuf = Buffer.from(entry.name, "utf8");
                checkZipLimit(nameBuf.length, 65535, "ZIP 条目名称长度");
		const flags = 0x0800; // language encoding flag：名称按 UTF-8
		const { time, date } = dosDateTime(entry.mtime ?? Date.now());
		const isDir = entry.dir === true;
		const data = isDir ? Buffer.alloc(0) : Buffer.from(entry.data ?? []);
		const compressed = isDir ? Buffer.alloc(0) : deflateRawSync(data);
		const method = isDir ? 0 : 8; // store / deflate
		const crc = isDir ? 0 : crc32(data);

		const header = Buffer.alloc(30);
		header.writeUInt32LE(0x04034b50, 0); // local file header signature
		header.writeUInt16LE(20, 4); // version needed
		header.writeUInt16LE(flags, 6);
		header.writeUInt16LE(method, 8);
		header.writeUInt16LE(time, 10);
		header.writeUInt16LE(date, 12);
		header.writeUInt32LE(crc, 14);
		header.writeUInt32LE(compressed.length, 18);
		header.writeUInt32LE(data.length, 22);
		header.writeUInt16LE(nameBuf.length, 26);
		header.writeUInt16LE(0, 28); // extra length
		const local = Buffer.concat([header, nameBuf]);

		const cd = Buffer.alloc(46);
		cd.writeUInt32LE(0x02014b50, 0); // central directory signature
		cd.writeUInt16LE(20, 4); // version made by
		cd.writeUInt16LE(20, 6); // version needed
		cd.writeUInt16LE(flags, 8);
		cd.writeUInt16LE(method, 10);
		cd.writeUInt16LE(time, 12);
		cd.writeUInt16LE(date, 14);
		cd.writeUInt32LE(crc, 16);
		cd.writeUInt32LE(compressed.length, 20);
		cd.writeUInt32LE(data.length, 24);
		cd.writeUInt16LE(nameBuf.length, 28);
		cd.writeUInt16LE(0, 30); // extra length
		cd.writeUInt16LE(0, 32); // comment length
		cd.writeUInt16LE(0, 34); // disk number
		cd.writeUInt16LE(0, 36); // internal attributes
		cd.writeUInt32LE(0, 38); // external attributes
		cd.writeUInt32LE(offset, 42); // local header offset
		central.push(Buffer.concat([cd, nameBuf]));

		locals.push(local, compressed);
		offset += local.length + compressed.length;
                checkZipLimit(offset, 0xffffffff, "ZIP 文件大小");
	}
	const centralBuf = Buffer.concat(central);
        checkZipLimit(offset + centralBuf.length + 22, 0xffffffff, "ZIP 文件大小");
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0); // end of central directory
	eocd.writeUInt16LE(0, 4); // disk number
	eocd.writeUInt16LE(0, 6); // central directory start disk
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralBuf.length, 12);
	eocd.writeUInt32LE(offset, 16);
	eocd.writeUInt16LE(0, 20); // comment length
	return Buffer.concat([...locals, centralBuf, eocd]);
}

/**
 * 给 ZIP 内条目起唯一名：同名时追加 " (2)"、" (3)"…
 * @param used - 已占用的名称集合（原地更新）。
 */
export function uniqueEntryName(name, used) {
	if (!used.has(name)) {
		used.add(name);
		return name;
	}
	for (let n = 2; ; n++) {
		const candidate = `${name} (${n})`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}
}

/**
 * 递归收集目录树为 ZIP 条目；符号链接跳过并计入 skipped。
 * @returns 同步读文件（每文件 ≤ maxFileBytes）；返回 `{ entries, skipped }`。
 */
export async function collectZipEntries(hostSources, { maxFileBytes = 256 * 1024 * 1024, maxTotalBytes = 1024 * 1024 * 1024, maxEntries = 10000, rootNames = null } = {}) {
	const entries = [];
	const used = new Set();
	let skipped = 0;
        let totalBytes = 0;
	const names = rootNames ?? hostSources.map((path) => basename(path));

        /** 遍历单个路径；参数为宿主路径和 ZIP 名称，收集受限条目，无返回值。 */
        async function walk(hostPath, zipName) {
		let info;
		try {
			info = await lstat(hostPath);
		} catch {
			skipped += 1; // 收集途中被删除
			return;
		}
		if (info.isSymbolicLink()) {
			skipped += 1;
			return;
		}
		if (info.isDirectory()) {
                        checkZipLimit(entries.length + 1, Math.min(maxEntries, 65535), "ZIP 条目数量");
			entries.push({ name: `${zipName}/`, dir: true, mtime: info.mtimeMs });
                        let children;
                        try {
                                children = await readdir(hostPath);
                        } catch {
                                skipped += 1;
                                return;
                        }
			children.sort((a, b) => a.localeCompare(b, "zh"));
			for (const child of children) await walk(join(hostPath, child), `${zipName}/${child}`);
			return;
		}
		if (info.isFile()) {
                        const size = info.size;
			if (size > maxFileBytes) {
				skipped += 1;
				return;
			}
                        checkZipLimit(totalBytes + size, maxTotalBytes, "压缩总输入大小");
			let data;
			try {
				data = await readFile(hostPath);
			} catch {
				skipped += 1;
				return;
			}
			// 读取后再校验一次（防并发增长超过上限）。
			if (data.length > maxFileBytes) {
				skipped += 1;
				return;
			}
                        checkZipLimit(totalBytes + data.length, maxTotalBytes, "压缩总输入大小");
                        checkZipLimit(entries.length + 1, Math.min(maxEntries, 65535), "ZIP 条目数量");
                        totalBytes += data.length;
			entries.push({ name: zipName, data, mtime: info.mtimeMs });
			return;
		}
		skipped += 1; // socket / fifo / 设备等
	}

	for (let i = 0; i < hostSources.length; i++) {
		const zipName = uniqueEntryName(names[i], used);
		await walk(hostSources[i], zipName);
	}
	return { entries, skipped };
}

/**
 * 一步到位：把宿主路径列表压缩为 ZIP Buffer。
 * @returns `{ buffer, entries, skipped }`
 */
export async function createZipBuffer(hostSources, options) {
	const { entries, skipped } = await collectZipEntries(hostSources, options);
	return { buffer: buildZipBuffer(entries), entries, skipped };
}

/** 校验经典 ZIP 或配置上限；参数为数值、上限和描述，超限抛带码错误。 */
function checkZipLimit(value, limit, description) {
        if (value > limit) {
                const error = new Error(`${description}超过上限（${limit}），请减少选择或拆分压缩包`);
                error.code = "file-actions/zip-limit";
                throw error;
        }
}

/**
 * 流式写出标准 ZIP，不保留文件内容或完整压缩包在内存中。
 * @param hostSources 源路径；outputPath 不存在的输出路径；options 文件/总量/条目上限和排除路径。
 * @returns `{ entries, skipped, bytes }`；失败关闭句柄并移除本次输出。
 */
export async function writeZipFile(hostSources, outputPath, {
        maxFileBytes = 256 * 1024 * 1024,
        maxTotalBytes = 1024 * 1024 * 1024,
        maxEntries = 10000,
        excludePaths = [],
} = {}) {
        const entries = [];
        const used = new Set();
        let skipped = 0;
        let totalBytes = 0;
        const excluded = [...excludePaths, outputPath];

        /** 收集有界元数据；参数为路径和 ZIP 名称，返回空 Promise，不读取文件内容。 */
        async function walk(host, name) {
                if (excluded.some((parent) => {
                        const rel = relative(parent, host);
                        return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
                })) return;
                let info;
                try {
                        info = await lstat(host);
                } catch {
                        skipped += 1;
                        return;
                }
                if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || info.size > maxFileBytes && info.isFile()) {
                        skipped += 1;
                        return;
                }
                checkZipLimit(entries.length + 1, Math.min(maxEntries, 65535), "ZIP 条目数量");
                checkZipLimit(Buffer.byteLength(name) + (info.isDirectory() ? 1 : 0), 65535, "ZIP 条目名称长度");
                if (info.isDirectory()) {
                        entries.push({ host, name: `${name}/`, dir: true, mtime: info.mtimeMs, mode: info.mode });
                        let children;
                        try {
                                children = await readdir(host);
                        } catch {
                                skipped += 1;
                                return;
                        }
                        children.sort((a, b) => a.localeCompare(b, "zh"));
                        for (const child of children) await walk(join(host, child), `${name}/${child}`);
                        return;
                }
                checkZipLimit(totalBytes + info.size, maxTotalBytes, "压缩总输入大小");
                totalBytes += info.size;
                entries.push({ host, name, dir: false, mtime: info.mtimeMs, mode: info.mode });
        }

        for (const host of hostSources) await walk(host, uniqueEntryName(basename(host), used));
        const output = await open(outputPath, "wx");
        const central = [];
        let offset = 0;
        let inputBytes = 0;
        let written = 0;
        let succeeded = false;

        /** 完整写入一个 Buffer；参数为数据，返回空 Promise，更新并校验 ZIP 偏移。 */
        async function write(data) {
                checkZipLimit(offset + data.length, 0xffffffff, "ZIP 文件大小");
                let consumed = 0;
                while (consumed < data.length) {
                        const { bytesWritten } = await output.write(data, consumed, data.length - consumed);
                        if (bytesWritten === 0) throw new Error("ZIP 写入未取得进展");
                        consumed += bytesWritten;
                }
                offset += data.length;
        }

        try {
                for (const entry of entries) {
                        let source;
                        if (!entry.dir) {
                                try {
                                        const info = await lstat(entry.host);
                                        if (!info.isFile() || info.isSymbolicLink() || info.size > maxFileBytes) {
                                                skipped += 1;
                                                continue;
                                        }
                                        source = await open(entry.host, "r");
                                } catch (error) {
                                        if (source) await source.close();
                                        skipped += 1;
                                        continue;
                                }
                        }
                        try {
                                const name = Buffer.from(entry.name, "utf8");
                                const { time, date } = dosDateTime(entry.mtime);
                                const flags = entry.dir ? 0x0800 : 0x0808;
                                const method = entry.dir ? 0 : 8;
                                const start = offset;
                                const header = Buffer.alloc(30);
                                header.writeUInt32LE(0x04034b50);
                                header.writeUInt16LE(20, 4);
                                header.writeUInt16LE(flags, 6);
                                header.writeUInt16LE(method, 8);
                                header.writeUInt16LE(time, 10);
                                header.writeUInt16LE(date, 12);
                                header.writeUInt16LE(name.length, 26);
                                await write(Buffer.concat([header, name]));
                                const dataStart = offset;
                                let size = 0;
                                let crc = 0xffffffff;
                                if (source) {
                                        const meter = new Transform({
                                                /** 统计输入大小和 CRC；参数为块、编码和回调，回传未修改的数据。 */
                                                transform(chunk, encoding, callback) {
                                                        try {
                                                                size += chunk.length;
                                                                inputBytes += chunk.length;
                                                                checkZipLimit(size, maxFileBytes, "单文件读取大小");
                                                                checkZipLimit(inputBytes, maxTotalBytes, "压缩总输入大小");
                                                                for (const byte of chunk) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
                                                                callback(null, chunk);
                                                        } catch (error) {
                                                                callback(error);
                                                        }
                                                },
                                        });
                                        const sink = new Writable({
                                                /** 异步写压缩块；参数为块、编码和回调，完成后通知管道。 */
                                                write(chunk, encoding, callback) {
                                                        write(chunk).then(() => callback(), callback);
                                                },
                                        });
                                        await pipeline(source.createReadStream({ autoClose: false }), meter, createDeflateRaw(), sink);
                                }
                                const compressed = offset - dataStart;
                                const checksum = entry.dir ? 0 : (crc ^ 0xffffffff) >>> 0;
                                if (!entry.dir) {
                                        const descriptor = Buffer.alloc(16);
                                        descriptor.writeUInt32LE(0x08074b50);
                                        descriptor.writeUInt32LE(checksum, 4);
                                        descriptor.writeUInt32LE(compressed, 8);
                                        descriptor.writeUInt32LE(size, 12);
                                        await write(descriptor);
                                }
                                const cd = Buffer.alloc(46);
                                cd.writeUInt32LE(0x02014b50);
                                cd.writeUInt16LE(0x0314, 4); // Unix 属性供 macOS/Linux 解压时恢复执行位。
                                cd.writeUInt16LE(20, 6);
                                cd.writeUInt16LE(flags, 8);
                                cd.writeUInt16LE(method, 10);
                                cd.writeUInt16LE(time, 12);
                                cd.writeUInt16LE(date, 14);
                                cd.writeUInt32LE(checksum, 16);
                                cd.writeUInt32LE(compressed, 20);
                                cd.writeUInt32LE(size, 24);
                                cd.writeUInt16LE(name.length, 28);
                                cd.writeUInt32LE(((entry.mode << 16) | (entry.dir ? 0x10 : 0)) >>> 0, 38);
                                cd.writeUInt32LE(start, 42);
                                central.push(Buffer.concat([cd, name]));
                                written += 1;
                        } finally {
                                if (source) await source.close();
                        }
                }
                const centralStart = offset;
                for (const cd of central) await write(cd);
                const end = Buffer.alloc(22);
                end.writeUInt32LE(0x06054b50);
                end.writeUInt16LE(written, 8);
                end.writeUInt16LE(written, 10);
                end.writeUInt32LE(offset - centralStart, 12);
                end.writeUInt32LE(centralStart, 16);
                await write(end);
                await output.sync();
                succeeded = true;
                return { entries: written, skipped, bytes: offset };
        } finally {
                await output.close();
                if (!succeeded) await rm(outputPath, { force: true });
        }
}
