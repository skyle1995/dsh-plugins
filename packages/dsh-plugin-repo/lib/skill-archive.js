/**
 * 技能商店的有界 ZIP 解析器：仅解码普通文件和目录，不调用系统解压命令。
 * 标准包使用 UTF-8 路径，且所有内容位于 `<id>/` 下；不执行包内脚本。
 */
import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(inflateRaw);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
        let crc = value;
        for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        return crc >>> 0;
});

/** 商店错误；参数为错误码和消息，返回带稳定错误码的异常实例。 */
export class SkillStoreError extends Error {
        /** 初始化错误；参数为错误码、消息和可选 cause，返回错误实例。 */
        constructor(code, message, options) {
                super(message, options);
                this.name = "SkillStoreError";
                this.code = `skill-store/${code}`;
        }
}

/** 校验稳定技能 id；参数为字符串，返回是否为小写 ASCII 字母数字及中划线组成的 slug。 */
export function validSkillId(id) {
        return typeof id === "string" && id.length > 0 && id.length <= 80
                && "abcdefghijklmnopqrstuvwxyz0123456789".includes(id[0])
                && [...id].every((char) => "abcdefghijklmnopqrstuvwxyz0123456789-".includes(char))
                && !reservedName(id);
}

/** 判断 Windows 设备保留名；参数为文件段，返回布尔值，用于跨系统可移植包校验。 */
function reservedName(name) {
        const stem = name.split(".")[0].toUpperCase();
        return ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
                ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
                ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
                "COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³"].includes(stem);
}

/** 计算 ZIP CRC-32；参数为 Buffer，返回无符号 32 位校验值。 */
function crc32(data) {
        let crc = 0xffffffff;
        for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
}

/** 校验条目路径；参数为 ZIP 名称及技能 id，返回去掉顶层 id 的路径与目录标识。 */
export function entryPath(name, id) {
        if (name.includes("\\") || name.startsWith("/") || name.includes("\0")) {
                throw new SkillStoreError("unsafe-archive", "ZIP 路径必须是使用 / 分隔的相对路径");
        }
        const directory = name.endsWith("/");
        const parts = (directory ? name.slice(0, -1) : name).split("/");
        if (parts[0] !== id || parts.some((part) => part === "" || part === "." || part === "..")) {
                throw new SkillStoreError("unsafe-archive", `ZIP 内容必须位于 "${id}/" 下且不能越界`);
        }
        for (const part of parts) {
                if (part.endsWith(".") || part.endsWith(" ") || reservedName(part)
                        || [...part].some((char) => char.charCodeAt(0) < 32 || '<>:"|?*'.includes(char))) {
                        throw new SkillStoreError("unsafe-archive", "ZIP 文件名不满足 Windows/macOS 的可移植规则");
                }
        }
        const path = parts.slice(1).join("/");
        if (path === "" && !directory || path.toLowerCase() === ".dsh-skill-store.json"
                || parts.some((part) => part.toLowerCase() === ".git")) {
                throw new SkillStoreError("unsafe-archive", "ZIP 包含保留的商店记录或 Git 目录");
        }
        return { path, directory };
}

/**
 * 完整校验并有界解码 ZIP，任何校验失败均不产生磁盘写入。
 * @param data ZIP 字节；id 预期技能 id；limits 可选条目、单文件与总解压上限。
 * @returns `{ files, skipped }`，每个文件含可移植相对路径、字节与 Unix 模式权限。
 */
export async function decodeSkillArchive(data, id, {
        maxEntries = 1024, maxFileBytes = 8 * 1024 * 1024, maxTotalBytes = 64 * 1024 * 1024,
} = {}) {
        if (!validSkillId(id) || !Buffer.isBuffer(data)) throw new SkillStoreError("invalid-archive", "技能 id 或 ZIP 数据不合法");
        let end = -1;
        for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
                if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) {
                        end = i;
                        break;
                }
        }
        if (end < 0) throw new SkillStoreError("invalid-archive", "ZIP 缺少完整中央目录结束记录");
        const count = data.readUInt16LE(end + 10);
        const centralSize = data.readUInt32LE(end + 12);
        const centralStart = data.readUInt32LE(end + 16);
        if (data.readUInt16LE(end + 4) !== 0 || data.readUInt16LE(end + 6) !== 0
                || data.readUInt16LE(end + 8) !== count || count === 65535 || count > maxEntries
                || centralStart + centralSize !== end) {
                throw new SkillStoreError("invalid-archive", "不支持多卷、ZIP64、过量条目或不完整中央目录");
        }
        const files = [];
        const paths = new Map();
        const regions = [];
        let total = 0;
        let skipped = 0;
        let cursor = centralStart;
        for (let n = 0; n < count; n++) {
                if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) throw new SkillStoreError("invalid-archive", "ZIP 条目头损坏");
                const flags = data.readUInt16LE(cursor + 8);
                const method = data.readUInt16LE(cursor + 10);
                const crc = data.readUInt32LE(cursor + 16);
                const compressedSize = data.readUInt32LE(cursor + 20);
                const size = data.readUInt32LE(cursor + 24);
                const nameSize = data.readUInt16LE(cursor + 28);
                const extraSize = data.readUInt16LE(cursor + 30);
                const commentSize = data.readUInt16LE(cursor + 32);
                const mode = data.readUInt32LE(cursor + 38) >>> 16;
                const local = data.readUInt32LE(cursor + 42);
                const next = cursor + 46 + nameSize + extraSize + commentSize;
                if (next > end || data.readUInt16LE(cursor + 34) !== 0) throw new SkillStoreError("invalid-archive", "ZIP 条目越过中央目录");
                const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameSize);
                let name;
                try {
                        name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
                } catch {
                        throw new SkillStoreError("invalid-archive", "ZIP 文件名必须为 UTF-8");
                }
                cursor = next;
                // Apple 元数据不属于技能内容；不解码、不落盘，也不按技能入口识别。
                if (name.startsWith("__MACOSX/") || name.split("/").some((part) => part === ".DS_Store" || part.startsWith("._"))) {
                        skipped += 1;
                        continue;
                }
                const { path, directory } = entryPath(name, id);
                const type = mode & 0o170000;
                if ((flags & 0x41) !== 0 || (type !== 0 && type !== 0o100000 && type !== 0o040000)) {
                        throw new SkillStoreError("unsafe-archive", "ZIP 不允许加密条目、符号链接或特殊文件");
                }
                if (method !== 0 && method !== 8 || size > maxFileBytes || compressedSize === 0xffffffff || size === 0xffffffff) {
                        throw new SkillStoreError("archive-limit", "ZIP 压缩方式或单文件大小不受支持");
                }
                if (directory && size !== 0) throw new SkillStoreError("invalid-archive", "ZIP 目录条目不能含文件数据");
                total += size;
                if (total > maxTotalBytes) throw new SkillStoreError("archive-limit", "ZIP 总解压大小超过上限");
                if (local + 30 > centralStart || data.readUInt32LE(local) !== 0x04034b50) throw new SkillStoreError("invalid-archive", "ZIP 本地文件头损坏");
                const localNameSize = data.readUInt16LE(local + 26);
                const start = local + 30 + localNameSize + data.readUInt16LE(local + 28);
                const finish = start + compressedSize;
                if (finish > centralStart || data.readUInt16LE(local + 6) !== flags || data.readUInt16LE(local + 8) !== method
                        || !data.subarray(local + 30, local + 30 + localNameSize).equals(nameBytes)) {
                        throw new SkillStoreError("invalid-archive", "ZIP 本地头和中央目录不一致");
                }
                regions.push({ start: local, end: finish });
                const key = path.normalize("NFC").toLowerCase();
                if (paths.has(key) || [...paths].some(([existing, isDir]) => !isDir && key.startsWith(`${existing}/`)
                        || !directory && existing.startsWith(`${key}/`))) {
                        throw new SkillStoreError("unsafe-archive", "ZIP 含重复、大小写/Unicode 冲突或文件目录重叠路径");
                }
                paths.set(key, directory);
                if (directory) continue;
                const compressed = data.subarray(start, finish);
                let content;
                try {
                        switch (method) {
                                case 0: content = compressed; break;
                                case 8: content = await inflate(compressed, { maxOutputLength: Math.min(maxFileBytes, size) + 1 }); break;
                        }
                } catch (error) {
                        throw new SkillStoreError("invalid-archive", "ZIP 解压失败或内容超过声明大小", { cause: error });
                }
                if (content.length !== size || crc32(content) !== crc) throw new SkillStoreError("integrity", "ZIP 文件长度或 CRC 不匹配");
                files.push({ path, data: content, mode: mode === 0 ? 0o644 : (mode & 0o777) | 0o600 });
        }
        if (cursor !== end) throw new SkillStoreError("invalid-archive", "ZIP 中央目录长度不匹配");
        regions.sort((a, b) => a.start - b.start);
        if (regions.some((region, i) => i > 0 && region.start < regions[i - 1].end)) throw new SkillStoreError("unsafe-archive", "ZIP 文件内容区域重叠");
        const skill = files.find((file) => file.path === "SKILL.md");
        if (skill === undefined) throw new SkillStoreError("invalid-archive", "ZIP 缺少顶层 SKILL.md");
        let text;
        try {
                text = new TextDecoder("utf-8", { fatal: true }).decode(skill.data);
        } catch {
                throw new SkillStoreError("invalid-archive", "SKILL.md 必须为 UTF-8 文本");
        }
        const lines = text.split("\r\n").join("\n").split("\n");
        const headerEnd = lines.indexOf("---", 1);
        const nameLine = lines.slice(1, headerEnd).find((line) => line.startsWith("name:"));
        let skillName = nameLine?.slice(5).trim() ?? "";
        if (skillName.startsWith('"') && skillName.endsWith('"')) {
                try { skillName = JSON.parse(skillName); } catch { skillName = ""; }
        } else if (skillName.startsWith("'") && skillName.endsWith("'")) {
                skillName = skillName.slice(1, -1).replaceAll("''", "'");
        }
        if (lines[0] !== "---" || headerEnd < 1 || skillName !== id) throw new SkillStoreError("invalid-archive", "SKILL.md 的 name 必须与商店 id 一致");
        return { files, skipped };
}
