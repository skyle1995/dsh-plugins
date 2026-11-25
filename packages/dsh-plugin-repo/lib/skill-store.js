/**
 * 技能商店：扫描仓库技能子目录，直接读取 SKILL.md 描述，跨平台安装并保留更新备份。
 * 不维护 JSON 索引；固定 Git revision 并校验 blob，不接受客户端 URL，不执行包内脚本。
 */
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { entryPath, SkillStoreError, validSkillId } from "./skill-archive.js";
import { readSkillMetadata } from "./skill-metadata.js";

export { SkillStoreError } from "./skill-archive.js";
export const SKILL_STORE_RECEIPT = ".dsh-skill-store.json";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_CATALOG_BYTES = 1024 * 1024;

/** 计算内容 SHA-256；参数为字节或文本，返回十六进制摘要。 */
export function skillDigest(data) {
        return createHash("sha256").update(data).digest("hex");
}

/** 校验 SHA-256 字符串；参数为值，返回是否为 64 位小写十六进制。 */
function validDigest(value) {
        return typeof value === "string" && value.length === 64 && [...value].every((char) => "0123456789abcdef".includes(char));
}

/** 校验商店内部相对路径；参数为字符串，返回布尔值，拒绝绝对路径和父目录跳转。 */
function safeRelative(path) {
        return typeof path === "string" && path !== "" && !path.includes("\\") && !path.includes("\0")
                && !path.includes(":") && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/**
 * 校验 Git 对象 id；参数为字符串，返回是否为 SHA-1 或 SHA-256 十六进制摘要。
 */
function validGitObject(value) {
        return typeof value === "string" && [40, 64].includes(value.length)
                && [...value].every((char) => "0123456789abcdef".includes(char));
}

/** 校验 Git blob；参数为字节和期望对象 id，无返回值，内容被替换时抛完整性错误。 */
function verifyBlob(data, sha) {
        const actual = createHash(sha.length === 40 ? "sha1" : "sha256").update(`blob ${data.length}\0`).update(data).digest("hex");
        if (!validGitObject(sha) || actual !== sha) throw new SkillStoreError("integrity", "技能文件内容与固定 Git revision 的 blob 不匹配");
}

/** 有界读取 HTTP 响应；参数为 Response 和大小上限，返回 Buffer，完成或失败后释放 reader。 */
async function responseBytes(response, limit) {
        if (!response.ok) {
                await response.body?.cancel().catch(() => {});
                throw new SkillStoreError("http", `技能仓库返回 HTTP ${response.status}`);
        }
        if (response.body === null) throw new SkillStoreError("network", "技能仓库响应为空");
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        try {
                for (;;) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        size += value.byteLength;
                        if (size > limit) throw new SkillStoreError("download-limit", "技能仓库响应超过大小上限");
                        chunks.push(Buffer.from(value));
                }
                return Buffer.concat(chunks);
        } finally {
                await reader.cancel().catch(() => {});
                reader.releaseLock();
        }
}

/** 查路径状态；参数为路径，返回 lstat 或 null，不把权限错误当成文件不存在。 */
async function infoOrNull(path) {
        try { return await lstat(path); }
        catch (error) {
                if (error.code === "ENOENT") return null;
                throw error;
        }
}

/** 有界读取小型 JSON 文件；参数为路径，返回对象，超限或非法内容抛错误。 */
async function readReceipt(path) {
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 512 * 1024) throw new SkillStoreError("receipt", "技能安装记录不合法");
        const handle = await open(path, "r");
        try {
                const buffer = Buffer.alloc(512 * 1024 + 1);
                let size = 0;
                while (size < buffer.length) {
                        const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
                        if (bytesRead === 0) break;
                        size += bytesRead;
                }
                if (size > 512 * 1024) throw new SkillStoreError("receipt", "技能安装记录过大");
                return JSON.parse(buffer.toString("utf8", 0, size));
        } finally {
                await handle.close();
        }
}

/** 商店操作对象；参数为仓库配置、安装目录和可选 fetch 替身，提供目录及安装方法。 */
export class SkillStore {
        /** 创建商店；参数为配置、技能根目录及请求函数，返回实例，不立即联网。 */
        constructor(config, skillsDir, fetchImpl = (...args) => fetch(...args)) {
                this.config = config;
                this.skillsDir = resolve(skillsDir);
                this.fetchImpl = fetchImpl;
                this.pending = Promise.resolve();
                this.catalogPending = null;
                this.cached = null;
                this.cachedAt = 0;
                this.controller = new AbortController();
        }

        /** 释放商店；无参数，无返回值，取消网络请求并阻止后续安装提交。 */
        dispose() {
                this.controller.abort();
        }

        /** 检查生命周期；无参数，无返回值，卸载后的操作抛取消错误。 */
        checkActive() {
                if (this.controller.signal.aborted) throw new SkillStoreError("canceled", "技能商店已卸载，操作已取消");
        }

        /** 生成固定仓库 API 地址；参数为端点类型和已验证相对路径，返回同源 URL。 */
        apiUrl(kind, path, revision = this.config.branch || "main") {
                let file;
                switch (kind) {
                        case "branches": file = encodeURIComponent(path); break;
                        case "git/trees":
                                if (!validGitObject(path)) throw new SkillStoreError("integrity", "技能目录树 id 不合法");
                                file = path;
                                break;
                        case "contents":
                                if (!safeRelative(path)) throw new SkillStoreError("config", "技能目录路径必须是仓库内的相对路径");
                                file = path.split("/").map(encodeURIComponent).join("/");
                                break;
                        default: throw new SkillStoreError("config", "不支持的技能仓库 API");
                }
                const host = new URL(this.config.gitHost);
                if (!["http:", "https:"].includes(host.protocol) || host.username !== "" || host.password !== "" || host.search !== "" || host.hash !== "") {
                        throw new SkillStoreError("config", "技能仓库必须使用不含凭据的 HTTP(S) 地址");
                }
                // GitHub 的 REST 前缀固定为 api.github.com；Gitea / Forgejo 挂在 <host>/api/v1 下。
                // 两者的 repos/contents、repos/git/trees 端点形状一致，可直接复用。
                const prefix = /(^|\.)github\.com$/i.test(host.hostname.toLowerCase())
                        ? "https://api.github.com"
                        : `${host.toString().replace(/\/+$/, "")}/api/v1`;
                const repository = `${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}`;
                const query = kind === "git/trees" ? "recursive=true" : `ref=${encodeURIComponent(revision)}`;
                return `${prefix}/repos/${repository}/${kind}/${file}?${query}`;
        }

        /** 下载同源内容；参数为 API 类型、路径与上限，返回 Buffer，禁止重定向携带仓库 token。 */
        async download(kind, path, limit, revision) {
                this.checkActive();
                try {
                        const response = await this.fetchImpl(this.apiUrl(kind, path, revision), {
                                headers: { accept: "application/json", ...(this.config.token ? { authorization: `token ${this.config.token}` } : {}) },
                                redirect: "error",
                                signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(this.config.requestTimeoutMs ?? 15000)]),
                        });
                        return await responseBytes(response, limit);
                } catch (error) {
                        if (error instanceof SkillStoreError) throw error;
                        throw new SkillStoreError("network", "技能仓库请求失败或超时", { cause: error });
                }
        }

        /** 加载目录；参数为是否强制刷新，返回校验后目录，并合并正在执行的请求。 */
        async catalog(refresh = false) {
                this.checkActive();
                if (!refresh && this.cached !== null && Date.now() - this.cachedAt < 60000) return this.cached;
                if (this.catalogPending !== null) return this.catalogPending;
                const pending = this.loadCatalog();
                this.catalogPending = pending;
                try { return await pending; }
                finally { if (this.catalogPending === pending) this.catalogPending = null; }
        }

        /** 从 contents 读取并校验文件；参数为路径、固定 revision 和期望 blob，可选大小上限，返回字节。 */
        async sourceFile(path, revision, expectedSha, limit = MAX_FILE_BYTES) {
                const content = JSON.parse((await this.download("contents", path, limit * 1.5 + 4096, revision)).toString("utf8"));
                if (content?.encoding !== "base64" || typeof content.content !== "string"
                        || content.content.length > limit * 1.5 + 16 || !validGitObject(content.sha)
                        || expectedSha !== undefined && content.sha !== expectedSha) {
                        throw new SkillStoreError("integrity", "技能文件响应格式、大小或 blob id 不合法");
                }
                const data = Buffer.from(content.content, "base64");
                if (data.length > limit) throw new SkillStoreError("download-limit", "技能文件超过大小上限");
                verifyBlob(data, content.sha);
                return data;
        }

        /** 自动扫描技能目录；无参数，返回 SKILL.md 元信息，忽略普通 ZIP/README 和非技能目录。 */
        async loadCatalog() {
                const path = this.config.skillsCatalogDir ?? "skills";
                const head = JSON.parse((await this.download("branches", this.config.branch || "main", MAX_CATALOG_BYTES)).toString("utf8"));
                const revision = head?.commit?.sha ?? head?.commit?.id;
                if (!validGitObject(revision)) throw new SkillStoreError("integrity", "技能仓库未返回有效分支 revision");
                const entries = JSON.parse((await this.download("contents", path, MAX_CATALOG_BYTES, revision)).toString("utf8"));
                if (!Array.isArray(entries) || entries.length > 1000) throw new SkillStoreError("invalid-catalog", "技能根目录响应格式不合法或条目过多");
                const skills = [];
                const warnings = [];
                const ids = new Set();
                for (const directory of entries) {
                        if (directory.type !== "dir" || !validSkillId(directory.name)) continue;
                        const id = directory.name;
                        if (ids.has(id) || directory.path !== `${path}/${id}` || !validGitObject(directory.sha)) throw new SkillStoreError("invalid-catalog", "技能目录路径或树 id 不合法");
                        ids.add(id);
                        if (ids.size > 500) throw new SkillStoreError("invalid-catalog", "技能商店目录超过 500 个上限");
                        try {
                                const text = new TextDecoder("utf-8", { fatal: true }).decode(await this.sourceFile(`${path}/${id}/SKILL.md`, revision, undefined, MAX_CATALOG_BYTES));
                                const meta = readSkillMetadata(text, id);
                                skills.push({
                                        id, title: meta.name, description: meta.description, category: meta.category,
                                        license: meta.license, upstreamVersion: meta.version,
                                        version: meta.version ?? directory.sha.slice(0, 8), revision, path: directory.path,
                                        treeSha: directory.sha, sha256: skillDigest(directory.sha),
                                });
                        } catch (error) {
                                // 一个目录的入口无效不隐藏其它技能；网络故障仍作为刷新失败报告。
                                if (error.code === "skill-store/http" && error.message.endsWith("404")
                                        || error.code === "skill-store/metadata" || error.code === "ERR_ENCODING_INVALID_ENCODED_DATA") {
                                        warnings.push({ id, message: "缺少有效 SKILL.md 或 name/description 不符合规范" });
                                        continue;
                                }
                                throw error;
                        }
                }
                const catalog = { skills, revision, warnings };
                this.checkActive();
                this.cached = catalog;
                this.cachedAt = Date.now();
                return catalog;
        }

        /** 检查本地安装；参数为目录条目，返回安装、更新与本地修改状态，不跟随符号链接。 */
        async status(entry) {
                const target = join(this.skillsDir, entry.id);
                const [directory, flat] = await Promise.all([infoOrNull(target), infoOrNull(join(this.skillsDir, `${entry.id}.md`))]);
                const base = { installed: directory !== null || flat !== null, managed: false, installedVersion: null, modified: false, updateAvailable: false };
                if (directory === null || !directory.isDirectory() || directory.isSymbolicLink() || flat !== null) return base;
                let receipt;
                try { receipt = await readReceipt(join(target, SKILL_STORE_RECEIPT)); }
                catch { return base; }
                if (receipt?.schemaVersion !== 1 || receipt.id !== entry.id || typeof receipt.version !== "string"
                        || !validDigest(receipt.sha256) || !Array.isArray(receipt.files) || receipt.files.length > 1024
                        || receipt.files.some((file) => !safeRelative(file?.path) || !validDigest(file?.sha256))) return base;
                return {
                        ...base, managed: true, installedVersion: receipt.version,
                        modified: await this.modified(target, receipt.files),
                        updateAvailable: receipt.sha256 !== entry.sha256 || receipt.version !== entry.version,
                };
        }

        /** 检查文件是否被修改或增删；参数为安装目录及收据文件列表，返回布尔值，有界且不跟随链接。 */
        async modified(target, expected) {
                const found = new Map();
                let visited = 0;
                /** 遍历本地普通文件；参数为目录与相对前缀，返回是否仍在安全边界内。 */
                async function walk(dir, prefix = "", depth = 0) {
                        if (depth > 64) return false;
                        for (const child of await readdir(dir, { withFileTypes: true })) {
                                if (prefix === "" && child.name === SKILL_STORE_RECEIPT) continue;
                                const path = prefix === "" ? child.name : `${prefix}/${child.name}`;
                                if (child.isSymbolicLink() || ++visited > 2048) return false;
                                switch (true) {
                                        case child.isDirectory(): if (!await walk(join(dir, child.name), path, depth + 1)) return false; break;
                                        case child.isFile(): found.set(path, join(dir, child.name)); break;
                                        default: return false;
                                }
                        }
                        return true;
                }
                try {
                        if (!await walk(target) || found.size !== expected.length) return true;
                        for (const file of expected) {
                                const path = found.get(file.path);
                                if (path === undefined) return true;
                                const info = await lstat(path);
                                if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024
                                        || skillDigest(await readFile(path)) !== file.sha256) return true;
                        }
                        return false;
                } catch { return true; }
        }

        /** 返回商店视图；参数为刷新标记，返回目录条目及已安装状态，不返回 token。 */
        async view(refresh = false) {
                const catalog = await this.catalog(refresh);
                return {
                        entries: await Promise.all(catalog.skills.map(async (entry) => ({ ...entry, ...await this.status(entry) }))),
                        revision: catalog.revision, warnings: catalog.warnings,
                };
        }

        /** 排队安装或更新；参数仅含 id 和显式替换确认，返回安装结果，失败不阻塞后续操作。 */
        async install(input) {
                if (!validSkillId(input?.id) || input.replace !== undefined && typeof input.replace !== "boolean"
                        || input.treeSha !== undefined && !validGitObject(input.treeSha)) {
                        throw new SkillStoreError("invalid-request", "技能 id 或替换确认不合法");
                }
                const next = this.pending.catch(() => {}).then(() => this.installOne(input.id, input.replace === true, input.treeSha));
                this.pending = next;
                return next;
        }

        /** 校验后安装单个技能；参数为 id 与覆盖确认，返回版本、跳过数及旧内容备份位置。 */
        async installOne(id, replace, expectedTree) {
                const catalog = await this.catalog(true);
                const entry = catalog.skills.find((skill) => skill.id === id);
                if (entry === undefined) throw new SkillStoreError("not-found", "技能不在当前商店目录中");
                if (expectedTree !== undefined && entry.treeSha !== expectedTree) throw new SkillStoreError("changed", "技能源已更新，请刷新描述并确认后重试");
                const tree = JSON.parse((await this.download("git/trees", entry.treeSha, MAX_CATALOG_BYTES)).toString("utf8"));
                if (tree?.sha !== entry.treeSha || tree.truncated === true || !Array.isArray(tree.tree) || tree.tree.length > 1024) {
                        throw new SkillStoreError("invalid-catalog", "技能文件树不完整、被截断或条目过多");
                }
                const files = [];
                const names = new Map();
                let total = 0;
                let skipped = 0;
                for (const item of tree.tree) {
                        if (typeof item.path !== "string") throw new SkillStoreError("unsafe-path", "技能文件路径缺失");
                        if (item.path.split("/").some((part) => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("._"))) { skipped += 1; continue; }
                        entryPath(`${id}/${item.path}${item.type === "tree" ? "/" : ""}`, id);
                        const key = item.path.normalize("NFC").toLowerCase();
                        if (names.has(key) || [...names].some(([existing, isDir]) =>
                                !isDir && key.startsWith(`${existing}/`)
                                || item.type !== "tree" && existing.startsWith(`${key}/`))) {
                                throw new SkillStoreError("unsafe-path", "技能含大小写、Unicode 冲突或文件目录重叠路径");
                        }
                        names.set(key, item.type === "tree");
                        switch (item.type) {
                                case "tree":
                                        if (item.mode !== "040000") throw new SkillStoreError("unsafe-path", "技能目录 mode 不合法");
                                        continue;
                                case "blob":
                                        if (!["100644", "100755"].includes(item.mode) || !validGitObject(item.sha)) throw new SkillStoreError("unsafe-path", "技能不允许符号链接或特殊文件");
                                        break;
                                default: throw new SkillStoreError("unsafe-path", "技能不允许子模块或特殊文件");
                        }
                        const data = await this.sourceFile(`${entry.path}/${item.path}`, entry.revision, item.sha);
                        total += data.length;
                        if (total > 64 * 1024 * 1024) throw new SkillStoreError("download-limit", "技能总内容超过 64MB 上限");
                        files.push({ path: item.path, data, mode: item.mode === "100755" ? 0o755 : 0o644 });
                }
                const skill = files.find((file) => file.path === "SKILL.md");
                if (skill === undefined) throw new SkillStoreError("metadata", "技能文件树缺少 SKILL.md");
                readSkillMetadata(new TextDecoder("utf-8", { fatal: true }).decode(skill.data), id);
                this.checkActive();
                await mkdir(this.skillsDir, { recursive: true });
                const target = join(this.skillsDir, id);
                const flat = join(this.skillsDir, `${id}.md`);
                const [targetInfo, flatInfo] = await Promise.all([infoOrNull(target), infoOrNull(flat)]);
                if ((targetInfo !== null || flatInfo !== null) && !replace) throw new SkillStoreError("exists", "本地已存在同名技能，必须明确确认替换");
                if (targetInfo !== null && (!targetInfo.isDirectory() || targetInfo.isSymbolicLink())
                        || flatInfo !== null && (!flatInfo.isFile() || flatInfo.isSymbolicLink())) {
                        throw new SkillStoreError("conflict", "同名路径不是普通技能目录或文件，拒绝替换");
                }
                const work = await mkdtemp(join(this.skillsDir, ".dsh-skill-install-"));
                const staged = join(work, id);
                const moved = [];
                let backup = null;
                let committed = false;
                try {
                        await mkdir(staged, { mode: 0o755 });
                        for (const file of files) {
                                this.checkActive();
                                const path = join(staged, ...file.path.split("/"));
                                await mkdir(dirname(path), { recursive: true });
                                const handle = await open(path, "wx", file.mode);
                                try {
                                        await handle.writeFile(file.data);
                                        await handle.chmod(file.mode);
                                        await handle.sync();
                                } finally { await handle.close(); }
                        }
                        await writeFile(join(staged, SKILL_STORE_RECEIPT), JSON.stringify({
                                schemaVersion: 1, id, version: entry.version, sha256: entry.sha256,
                                files: files.map((file) => ({ path: file.path, sha256: skillDigest(file.data) })),
                        }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
                        this.checkActive();
                        if (targetInfo !== null || flatInfo !== null) {
                                const backupRoot = join(this.skillsDir, ".dsh-skill-backups");
                                await mkdir(backupRoot, { recursive: true, mode: 0o700 });
                                const info = await lstat(backupRoot);
                                if (!info.isDirectory() || info.isSymbolicLink()) throw new SkillStoreError("conflict", "技能备份目录不合法");
                                backup = await mkdtemp(join(backupRoot, `${id}-`));
                                for (const path of [targetInfo !== null ? target : null, flatInfo !== null ? flat : null]) {
                                        if (path === null) continue;
                                        const saved = join(backup, path === target ? id : `${id}.md`);
                                        await rename(path, saved);
                                        moved.push({ original: path, saved });
                                }
                        }
                        this.checkActive();
                        await rename(staged, target);
                        committed = true;
                        return { id, version: entry.version, skipped, backup };
                } finally {
                        try {
                                if (!committed) {
                                        for (const item of moved.reverse()) {
                                                if (await infoOrNull(item.original) !== null) throw new SkillStoreError("rollback", `恢复被新路径阻挡，旧技能保留在备份目录：${backup}`);
                                                await rename(item.saved, item.original);
                                        }
                                        if (backup !== null) await rm(backup, { recursive: true, force: true });
                                }
                        } finally {
                                await rm(work, { recursive: true, force: true });
                        }
                }
        }
}
