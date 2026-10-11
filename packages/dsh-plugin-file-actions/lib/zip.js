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
import { deflateRawSync } from "node:zlib";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

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

/** DOS 格式日期时间（ZIP 头字段）。 */
export function dosDateTime(mtime) {
	const date = new Date(mtime);
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return { time, date: day };
}

/**
 * 把条目数组序列化为完整 ZIP Buffer。
 * @param entries - `{ name, data?, dir?, mtime? }`；目录条目 dir:true（data 忽略）。
 */
export function buildZipBuffer(entries) {
	const locals = [];
	const central = [];
	let offset = 0;
	for (const entry of entries) {
		const nameBuf = Buffer.from(entry.name, "utf8");
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
	}
	const centralBuf = Buffer.concat(central);
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
export async function collectZipEntries(hostSources, { maxFileBytes = 256 * 1024 * 1024, rootNames = null } = {}) {
	const entries = [];
	const used = new Set();
	let skipped = 0;
	const names = rootNames ?? hostSources.map((path) => basename(path));

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
			entries.push({ name: `${zipName}/`, dir: true, mtime: info.mtimeMs });
			const children = await readdir(hostPath).catch(() => []);
			children.sort((a, b) => a.localeCompare(b, "zh"));
			for (const child of children) await walk(join(hostPath, child), `${zipName}/${child}`);
			return;
		}
		if (info.isFile()) {
			let size = info.size;
			if (size > maxFileBytes) {
				skipped += 1;
				return;
			}
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
