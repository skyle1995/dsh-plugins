/**
 * dsh-plugin-skills —— 技能能力：skills 技能管理。
 *
 * 管理 $DSH_HOME/skills（缺省 ~/.dsh/skills）下的本地 skill：
 * - 兼容 dsh-skill-filesystem 的两种布局：目录 bundle（<name>/SKILL.md）
 *   与平铺文件（<name>.md）；
 * - 列表：解析 YAML frontmatter（name/description/whenToUse/
 *   disable-model-invocation/user-invocable），返回正文与布局信息；
 * - 新建（平铺 .md，frontmatter 含 name/description）、编辑（保留布局，
 *   改名时同步重命名文件/目录）、删除（文件或目录）、模型可见开关
 *   （改写 disable-model-invocation 字段，其余 frontmatter 保留）、
 *   导入（.md 单文件与 .zip/.tar.gz/.tgz 压缩包，解包扫描目录 bundle 与
 *   平铺技能，跳过 README 等非技能文件，重名覆盖）；
 * - 规则（提示词）：持久化在插件自有文件
 *   $DSH_HOME/dsh-plugin-repo/persona.md，并通过 system-prompt/assemble
 *   运行时注入 deployment:persona-prefix 分区。不写 cordis.patch.yml，
 *   因此保存后立即生效，也不会触发 dsh-hmr 重载插件/刷新界面。
 *   旧版本写在 home patch 里的 persona 会在首次读取时迁移过来。
 *
 * filesystem 提供方（dsh-skill-filesystem）会监视这些根目录，因此本插件
 * 的改动无需重启即可进入下一次会话目录。
 *
 * 浏览器半区经设置面板的 settings.section 分区消费
 * /api/dsh-plugin-skills 路由；服务键为 skillManager（ctx.skillManager）。
 *
 * @module dsh-plugin-skills
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { readJsonBody } from "./request.js";
import { SkillStore, SkillStoreError } from "./skill-store.js";

const execFileAsync = promisify(execFile);

/** 浏览器半区使用的 HTTP 路由前缀。 */
export const SKILLS_API_PREFIX = "/api/dsh-plugin-skills";

/** 带错误码的管理操作失败。 */
export class SkillError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "SkillError";
		this.code = code;
	}
}

/** 解析 $DSH_HOME（DSH_HOME 环境变量优先，其次 ~/.dsh）。 */
export function resolveDshHome() {
	const env = process.env.DSH_HOME?.trim();
	if (env !== undefined && env !== "") return env;
	return join(homedir(), ".dsh");
}

/** 技能根目录：配置显式指定，否则 <dshHome>/skills。 */
export function resolveSkillsDir(config) {
	if (typeof config?.skillsDir === "string" && config.skillsDir.trim() !== "") return config.skillsDir;
	return join(resolveDshHome(), "skills");
}

/** 净化技能名；参数为名称与宿主平台，返回保留 Unicode 的单段名称，非法保留名返回空串。 */
export function sanitizeSkillName(name, platform = process.platform) {
        const safe = String(name ?? "")
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
        if (safe === "." || safe === "..") return "";
        if (platform === "win32") {
                const stem = safe.split(".")[0].toUpperCase();
                const reserved = ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
                        ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
                        ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`), "COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³"];
                if (reserved.includes(stem) || safe.endsWith(".")) return "";
        }
        return safe;
}

/** YAML 布尔：true/yes/on/1（大小写不敏感）为真。 */
export function isYamlTrue(value) {
	return /^(true|yes|on|1)$/i.test(String(value).trim());
}

/** 去掉首尾引号的标量值。 */
function unquote(value) {
	if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) return value.slice(1, -1);
	return value;
}

/**
 * 行级解析 YAML frontmatter（足以处理 name/description 与开关字段；
 * 多行 YAML 值会被折叠，正文与其余字段保持原样）。
 * @returns `{ fields, body, hasFrontmatter }`
 */
export function parseFrontmatter(content) {
	const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
	if (!match) return { fields: {}, body: content, hasFrontmatter: false };
	const fields = {};
	for (const line of match[1].split(/\r?\n/)) {
		const idx = line.indexOf(":");
		if (idx < 0) continue;
		const key = line.slice(0, idx).trim();
		if (key === "") continue;
		fields[key] = unquote(line.slice(idx + 1).trim());
	}
	return { fields, body: content.slice(match[0].length), hasFrontmatter: true };
}

/** YAML 标量序列化：含特殊字符时用双引号 JSON 转义。 */
function yamlScalar(value) {
	const text = String(value);
	if (/^[\w\u4e00-\u9fff .\-\/]+$/.test(text) && text !== "true" && text !== "false") return text;
	return JSON.stringify(text);
}

/** 组装 minimal frontmatter 块（不含末尾换行）。 */
export function buildFrontmatter(fields) {
	const lines = ["---"];
	if (fields.name !== undefined) lines.push(`name: ${yamlScalar(fields.name)}`);
	if (fields.description !== undefined) lines.push(`description: ${yamlScalar(fields.description)}`);
	if (fields.whenToUse !== undefined && fields.whenToUse !== "") lines.push(`whenToUse: ${yamlScalar(fields.whenToUse)}`);
	if (fields.modelDisabled !== undefined && fields.modelDisabled) lines.push("disable-model-invocation: true");
	if (fields.userInvocable !== undefined && !fields.userInvocable) lines.push("user-invocable: false");
	return lines.join("\n") + "\n---";
}

/**
 * 在 frontmatter 中设置/清除一个单行字段，保留其余行与正文。
 * value 为 undefined 时删除该字段。
 * @param content 原文本；key 字段名；value 新字段值。
 * @returns 保留原换行风格的更新文本。
 */
export function setFrontmatterField(content, key, value) {
        const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
	if (!match) {
		// 无 frontmatter：补建最小块（仅该字段），正文原样保留。
		const lines = value === undefined ? ["---"] : ["---", `${key}: ${String(value)}`];
                return `${lines.join(eol)}${eol}---${eol}${eol}${content}`;
	}
	const kept = [];
	for (const line of match[1].split(/\r?\n/)) {
		const idx = line.indexOf(":");
		if (idx >= 0 && line.slice(0, idx).trim() === key) continue;
		kept.push(line);
	}
	if (value !== undefined) kept.push(`${key}: ${String(value)}`);
	const body = content.slice(match[0].length);
        return `---${eol}${kept.join(eol)}${eol}---${eol}${body}`;
}

/**
 * 列出技能目录下的全部 skill（两种布局）。
 * @returns 按名称排序的条目数组。
 */
export async function listSkills(dir) {
	if (!existsSync(dir)) return [];
	const entries = await readdir(dir, { withFileTypes: true });
	const skills = [];
	for (const entry of entries) {
		let file;
		let layout;
		if (entry.isFile() && entry.name.endsWith(".md")) {
			file = entry.name;
			layout = "flat";
		} else if (entry.isDirectory()) {
			const skillMd = join(dir, entry.name, "SKILL.md");
			if (!existsSync(skillMd)) continue;
			file = `${entry.name}/SKILL.md`;
			layout = "bundle";
		} else {
			continue;
		}
		try {
                        const info = await lstat(join(dir, file));
                        if (!info.isFile() || info.isSymbolicLink()) continue;
			const content = await readFile(join(dir, file), "utf8");
			const { fields, body, hasFrontmatter } = parseFrontmatter(content);
			skills.push({
				name: typeof fields.name === "string" && fields.name !== "" ? fields.name : entry.name.replace(/\.md$/, ""),
				description: typeof fields.description === "string" ? fields.description : "",
				whenToUse: typeof fields.whenToUse === "string" ? fields.whenToUse : "",
				modelDisabled: isYamlTrue(fields["disable-model-invocation"]),
				userInvocable: fields["user-invocable"] === undefined ? true : isYamlTrue(fields["user-invocable"]),
				layout,
				file,
				body,
				hasFrontmatter,
			});
		} catch {
			// 不可读文件跳过，不拖垮整个列表。
		}
	}
	return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/** 按名称或相对路径查找一个 skill 条目。 */
export async function findSkill(dir, nameOrFile) {
	const skills = await listSkills(dir);
	return skills.find((skill) => skill.name === nameOrFile || skill.file === nameOrFile || skill.file === `${nameOrFile}/SKILL.md`);
}

/**
 * 新建或更新一个 skill。
 * @param dir - 技能根目录。
 * @param input - `{ name, description, body, previous? }`；previous 为编辑
 *   前的条目（含 name/file），改名时同步重命名文件或目录。
 * @returns 保存后的 `{ name, layout, file }`。
 */
export async function saveSkill(dir, input) {
	const safe = sanitizeSkillName(input.name);
	if (safe === "") throw new SkillError("skills/invalid-name", "技能名不能为空");
	await mkdir(dir, { recursive: true });
        const skills = await listSkills(dir);
        const previous = input.previous === undefined ? undefined : skills.find((skill) => skill.file === input.previous?.file);
        if (input.previous !== undefined && previous === undefined) throw new SkillError("skills/not-found", "原技能不存在或路径不合法，请刷新后重试");
        if (skills.some((skill) => skill.file !== previous?.file && skill.name === safe)) {
                throw new SkillError("skills/exists", `技能 "${safe}" 已存在，请使用编辑或导入覆盖`);
        }
        let content = `${buildFrontmatter({ name: safe, description: input.description ?? "" })}\n\n${String(input.body ?? "").trim()}\n`;
	if (input.previous !== undefined) {
		const isBundle = previous.file.includes("/");
		const bundleName = isBundle ? previous.file.slice(0, previous.file.indexOf("/")) : null;
		const oldFile = isBundle ? join(dir, bundleName, "SKILL.md") : join(dir, previous.file);
		if (!existsSync(oldFile)) throw new SkillError("skills/not-found", `技能 ${JSON.stringify(previous.name)} 已不存在`);
                const existing = await readFile(oldFile, "utf8");
                const updated = setFrontmatterField(setFrontmatterField(existing, "name", yamlScalar(safe)), "description", yamlScalar(input.description ?? ""));
                const { body } = parseFrontmatter(updated);
                const header = updated.slice(0, updated.length - body.length);
                const eol = existing.includes("\r\n") ? "\r\n" : "\n";
                const newBody = String(input.body ?? "").trim().split("\r\n").join("\n").split("\n").join(eol);
                content = `${header}${eol}${newBody}${eol}`;
		if (previous.name !== safe) {
			if (isBundle) {
                                await assertSkillTarget(join(dir, safe), join(dir, bundleName));
				await rename(join(dir, bundleName), join(dir, safe));
                                await writeSkillAtomic(join(dir, safe, "SKILL.md"), content);
				return { name: safe, layout: "bundle", file: `${safe}/SKILL.md` };
			}
                        await assertSkillTarget(join(dir, `${safe}.md`), oldFile);
			await rename(oldFile, join(dir, `${safe}.md`));
                        await writeSkillAtomic(join(dir, `${safe}.md`), content);
			return { name: safe, layout: "flat", file: `${safe}.md` };
		}
                await writeSkillAtomic(oldFile, content);
		return { name: safe, layout: previous.layout, file: previous.file };
	}
	const file = `${safe}.md`;
        // wx 同时拒绝现有文件、符号链接与并发新建，不覆盖已有技能。
        await writeFile(join(dir, file), content, { encoding: "utf8", flag: "wx" });
	return { name: safe, layout: "flat", file };
}

/** 检查改名目标；参数为目标和源，返回空 Promise，允许同一文件的大小写别名。 */
async function assertSkillTarget(target, source) {
        if (target === source) return;
        let destination;
        try {
                destination = await lstat(target);
        } catch (error) {
                if (error.code === "ENOENT") return;
                throw error;
        }
        const origin = await lstat(source);
        const actualNames = await readdir(dirname(target));
        if (destination.dev === origin.dev && destination.ino === origin.ino && !actualNames.includes(basename(target))) return;
        throw new SkillError("skills/exists", `目标 "${basename(target)}" 已存在`);
}

/** 原子替换技能或规则文件；参数为目标与文本，返回空 Promise，保留模式权限并清理临时目录。 */
async function writeSkillAtomic(file, content) {
        await mkdir(dirname(file), { recursive: true });
        let mode = 0o600;
        try {
                const info = await lstat(file);
                if (!info.isFile() || info.isSymbolicLink()) throw new SkillError("skills/invalid-file", "目标不是普通文件，拒绝跟随符号链接");
                mode = info.mode & 0o777;
        } catch (error) {
                if (error.code !== "ENOENT") throw error;
        }
        const temporary = await mkdtemp(join(dirname(file), ".dsh-skill-"));
        try {
                const next = join(temporary, "content");
                const handle = await open(next, "wx", mode);
                try {
                        await handle.writeFile(content, "utf8");
                        await handle.chmod(mode);
                        await handle.sync();
                } finally {
                        await handle.close();
                }
                await rename(next, file);
        } finally {
                await rm(temporary, { recursive: true, force: true });
        }
}

/**
 * 删除一个 skill（平铺文件或整个目录 bundle）。
 * @returns 被删除条目的 name/file。
 */
export async function deleteSkill(dir, nameOrFile) {
	const skill = await findSkill(dir, nameOrFile);
	if (skill === undefined) throw new SkillError("skills/not-found", `技能 ${JSON.stringify(nameOrFile)} 不存在`);
	if (skill.layout === "bundle") await rm(join(dir, skill.file.slice(0, skill.file.indexOf("/"))), { recursive: true, force: true });
	else await rm(join(dir, skill.file), { force: true });
	return skill;
}

/**
 * 切换 skill 的模型可见性（改写 frontmatter 的 disable-model-invocation，
 * 其余字段与正文保留）。
 * @param modelEnabled - true 允许模型调用（清除禁用标记）。
 */
export async function setSkillModelEnabled(dir, nameOrFile, modelEnabled) {
	const skill = await findSkill(dir, nameOrFile);
	if (skill === undefined) throw new SkillError("skills/not-found", `技能 ${JSON.stringify(nameOrFile)} 不存在`);
	const file = join(dir, skill.file);
	const content = await readFile(file, "utf8");
	const updated = setFrontmatterField(content, "disable-model-invocation", modelEnabled ? undefined : "true");
        await writeSkillAtomic(file, updated);
	return { ...skill, modelDisabled: !modelEnabled };
}

/**
 * 递归扫描解包树并导入技能：目录含 SKILL.md → bundle；带 name frontmatter
 * 的 .md → 平铺。跳过隐藏目录、__MACOSX、node_modules 与无 frontmatter
 * 的 .md（README 等）。重名覆盖。
 */
async function importTree(skillsDir, root, imported, skipped, depth = 0) {
	if (depth > 4) return;
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "__MACOSX" || entry.name === "node_modules") continue;
		const full = join(root, entry.name);
		if (entry.isDirectory()) {
			const skillMd = join(full, "SKILL.md");
			if (existsSync(skillMd)) {
				try {
					const { fields } = parseFrontmatter(await readFile(skillMd, "utf8"));
					const name = sanitizeSkillName(fields.name ?? entry.name) || entry.name;
					await rm(join(skillsDir, name), { recursive: true, force: true });
					await cp(full, join(skillsDir, name), { recursive: true, force: true });
					imported.push({ name, layout: "bundle" });
				} catch (error) {
					skipped.push(`${entry.name}（${error.message}）`);
				}
			} else {
				await importTree(skillsDir, full, imported, skipped, depth + 1);
			}
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
			try {
				const content = await readFile(full, "utf8");
				const { fields, hasFrontmatter } = parseFrontmatter(content);
				if (!hasFrontmatter || typeof fields.name !== "string" || fields.name.trim() === "") {
					skipped.push(entry.name);
					continue;
				}
				const name = sanitizeSkillName(fields.name);
                                if (name === "") throw new SkillError("skills/invalid-name", "技能名不合法");
                                await writeSkillAtomic(join(skillsDir, `${name}.md`), content);
				imported.push({ name, layout: "flat" });
			} catch (error) {
				skipped.push(`${entry.name}（${error.message}）`);
			}
		}
	}
}

/**
 * 从 .md 单文件或 .zip/.tar.gz/.tgz 压缩包导入技能（重名覆盖）。
 * @param dir - 技能根目录。
 * @param input - `{ filename, data }`（data 为 Buffer）。
 * @returns `{ imported, skipped }`。
 */
export async function importSkills(dir, input) {
	await mkdir(dir, { recursive: true });
	const filename = String(input.filename ?? "");
	const lower = filename.toLowerCase();
	const work = await mkdtemp(join(tmpdir(), "dsh-skill-import-"));
	try {
		if (lower.endsWith(".md")) {
			const content = input.data.toString("utf8");
			const { fields } = parseFrontmatter(content);
			const name = sanitizeSkillName(fields.name ?? basename(filename, extname(filename))) || "imported-skill";
                        await writeSkillAtomic(join(dir, `${name}.md`), content);
			return { imported: [{ name, layout: "flat" }], skipped: [] };
		}
		const archive = join(work, "archive.bin");
		await writeFile(archive, input.data);
		const tree = join(work, "tree");
		await mkdir(tree, { recursive: true });
		if (lower.endsWith(".zip")) {
			try {
				await execFileAsync("unzip", ["-o", "-q", archive, "-d", tree], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
			} catch (error) {
				if (error.code === "ENOENT") await execFileAsync("tar", ["-xf", archive, "-C", tree], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
				else throw error;
			}
		} else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
			await execFileAsync("tar", ["-xzf", archive, "-C", tree], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
		} else {
			throw new SkillError("skills/unsupported-archive", "仅支持 .md、.zip、.tar.gz、.tgz 格式");
		}
		const imported = [];
		const skipped = [];
		await importTree(dir, tree, imported, skipped);
		return { imported, skipped };
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

/** home 级 patch 文件名（位于 $DSH_HOME 下），旧版 persona 的迁移来源。 */
export const HOME_PATCH_FILENAME = "cordis.patch.yml";

/** 规则（提示词）数据目录名（位于 $DSH_HOME 下）。 */
export const PERSONA_DIRNAME = "dsh-plugin-repo";

/** 规则（提示词）文件名。 */
export const PERSONA_FILENAME = "persona.md";

/** 规则（提示词）落盘路径：<dshHome>/dsh-plugin-repo/persona.md。 */
export function personaPath(home = resolveDshHome()) {
	return join(home, PERSONA_DIRNAME, PERSONA_FILENAME);
}

/**
 * 规范化 persona 文本：统一换行、去掉行尾空白与末尾空行。
 * 仅用于比较与落盘，不改变用户可见的语义。
 */
export function normalizePersona(text) {
	return String(text ?? "")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+$/gm, "")
		.replace(/\n+$/, "");
}

/**
 * 从 patch 文本的 system-prompt 块里读取一个 persona 字段
 * （支持行内标量与 | / |- 块标量）；字段不存在返回 null。
 */
function readPersonaField(lines, start, field) {
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i];
		if (/^- id:/.test(line) || /^\S/.test(line)) break;
		const pattern = new RegExp(`^    ${field}:\\s*(\\|(-?)?)\\s*$`);
		const block = pattern.exec(line);
		const inline = block === null ? new RegExp(`^    ${field}:\\s*(.+)$`).exec(line) : null;
		if (inline) return unquote(inline[1]);
		if (!block) continue;
		const value = [];
		let baseIndent = -1;
		for (let j = i + 1; j < lines.length; j++) {
			const candidate = lines[j];
			if (/^- id:/.test(candidate) || /^\S/.test(candidate)) break;
			if (candidate.trim() === "") { value.push(""); continue; }
			const indent = candidate.length - candidate.trimStart().length;
			if (indent < 2) break;
			if (baseIndent < 0) baseIndent = indent;
			value.push(candidate.slice(Math.min(baseIndent, indent)));
		}
		while (value.length > 0 && value.at(-1) === "") value.pop();
		return value.join("\n");
	}
	return null;
}

/**
 * 从 patch 文本中提取 system-prompt 块的 persona。
 *
 * dsh 的真实配置字段是 `personaPrefix`；旧版本本插件误写过 `persona`
 * （dsh 忽略该未知字段，配置却参与 loader 的 diff，于是每次保存都会重启
 * system-prompt 插件并让前端异常刷新）。两个字段都读，优先取正确字段，
 * 用于把旧配置迁移到插件自有存储。找不到时返回空字符串。
 */
export function extractPersona(content) {
	const lines = String(content).split(/\r?\n/);
	const start = lines.findIndex((line) => /^- id: system-prompt\s*$/.test(line));
	if (start < 0) return "";
	const modern = readPersonaField(lines, start, "personaPrefix");
	if (modern !== null) return modern;
	return readPersonaField(lines, start, "persona") ?? "";
}

/**
 * 生成 system-prompt 条目块（personaPrefix 用 | 块标量，内容统一缩进 6 空格）。
 * 仅供迁移/测试使用：插件保存不再写 home patch。
 */
export function buildPromptBlock(persona) {
	const lines = String(persona ?? "").split(/\r?\n/);
	return ["- id: system-prompt", "  config:", "    personaPrefix: |-", ...lines.map((line) => (line === "" ? "" : `      ${line}`)), ""].join("\n");
}

/**
 * 手术式替换：存在 system-prompt 条目则只替换该条目（到下一个顶层
 * `- id:` 或文件末尾为止），保留文件内其它条目；不存在则追加到文件末尾。
 * 仅供迁移/测试使用：插件保存不再写 home patch。
 */
export function setPromptInPatch(content, persona) {
	const lines = String(content ?? "").split(/\r?\n/);
	const start = lines.findIndex((line) => /^- id: system-prompt\s*$/.test(line));
	if (start < 0) {
		const body = String(content ?? "").trim();
		return (body === "" ? "" : `${body}\n\n`) + buildPromptBlock(persona);
	}
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (/^- id:/.test(lines[i])) { end = i; break; }
	}
	const before = lines.slice(0, start).join("\n").trim();
	const after = lines.slice(end).join("\n").trim();
	return [before, buildPromptBlock(persona).trimEnd(), after].filter((part) => part !== "").join("\n") + "\n";
}

/** home 级 patch 的绝对路径（旧版 persona 的迁移来源）。 */
export function promptPatchPath(home = resolveDshHome()) {
	return join(home, HOME_PATCH_FILENAME);
}

/** dsh 部署级 persona 前缀分区名，规则段挂在它后面。 */
const PERSONA_PREFIX_SECTION = "deployment:persona-prefix";

/** 本插件注入的规则段分区名（不与 dsh 的分区重名，避免被 scoped persona 覆盖）。 */
export const PERSONA_RULES_SECTION = "plugin-repo:persona-rules";

/**
 * 把 persona 注入一次 system prompt 组装结果。
 *
 * 规则作为独立分区追加，而不是改写 `deployment:persona-prefix`：agent preset
 * 会用 `dsh-persona` 注册同名 scoped 分区来 shadow 部署 persona，改写那个
 * 分区会让全局规则在 preset 下失效。独立分区与 preset 的 persona 共存。
 *
 * - persona 为空：原样返回。
 * - 已有规则段：就地更新文本。
 * - 否则插到部署 persona 之后（没有时落到 harness identity 之后）。
 * - 文本按字面注入（interpolate: false），规则里的 `{{` 不会让组装失败。
 * @param assembly - 可变的 PromptPresentation。
 * @param persona - 当前生效的规则文本。
 * @returns 同一个 assembly，便于瀑布链继续。
 */
export function applyPersonaToAssembly(assembly, persona) {
	const text = String(persona ?? "");
	if (text.trim() === "") return assembly;
	const existing = assembly.sections.find((entry) => entry.name === PERSONA_RULES_SECTION);
	if (existing !== undefined) {
		existing.text = text;
		existing.interpolate = false;
		return assembly;
	}
	const personaIndex = assembly.sections.findIndex((entry) => entry.name === PERSONA_PREFIX_SECTION);
	const identityIndex = assembly.sections.findIndex((entry) => entry.name === "harness:identity");
	const index = personaIndex >= 0 ? personaIndex + 1 : identityIndex >= 0 ? identityIndex + 1 : 0;
	assembly.sections.splice(index, 0, {
		name: PERSONA_RULES_SECTION,
		text,
		interpolate: false,
	});
	return assembly;
}

/**
 * 规则（提示词）存储：插件自有文件 + 内存缓存。
 *
 * 首次读取时若文件不存在，则从 home patch 的 system-prompt 块迁移旧
 * persona（只读 patch、不写 patch，避免触发 dsh-hmr 重载）。
 */
export class PersonaStore {
	constructor(home = resolveDshHome()) {
		this.home = home;
		this.file = personaPath(home);
		this.value = this.#load();
	}

	/** 同步读取插件文件；缺失时返回迁移值（不落盘）。 */
	#load() {
		try {
			if (existsSync(this.file)) return normalizePersona(readFileSync(this.file, "utf8"));
		} catch {
			// 读取失败按空处理，下一次保存会重建文件。
		}
		return this.#migrate();
	}

	/** 从 home patch 读取旧 persona；不存在返回空串。 */
	#migrate() {
		const patch = promptPatchPath(this.home);
		try {
			if (!existsSync(patch)) return "";
			return normalizePersona(extractPersona(readFileSync(patch, "utf8")));
		} catch {
			return "";
		}
	}

	/** 当前生效文本（注入 system prompt 用）。 */
	get text() {
		return this.value;
	}

	/**
	 * 保存文本并更新缓存；内容未变化时不落盘。
	 * @returns `{ file, persona, changed }`
	 */
	async save(text) {
		const next = normalizePersona(text);
		if (next === this.value) return { file: this.file, persona: next, changed: false };
		await writeSkillAtomic(this.file, next === "" ? "" : `${next}\n`);
		this.value = next;
		return { file: this.file, persona: next, changed: true };
	}

	/** 首次读取到迁移值时把文本落到插件文件，后续启动不再依赖 patch。 */
	async persistMigrated() {
		if (this.value === "" || existsSync(this.file)) return false;
		await writeSkillAtomic(this.file, `${this.value}\n`);
		return true;
	}
}

/**
 * dsh-plugin-skills 的 Cordis 服务：技能文件管理 + 规则（提示词）+ Web 路由。
 * 服务键 `skillManager`（ctx.skillManager）。
 */
export class SkillManagerService extends Service {
	static Config = Schema.object({
		skillsDir: Schema.string().default(""),
                storeConfig: Schema.any().default(null),
	});

	constructor(ctx, config) {
		super(ctx, "skillManager");
		this.config = config;
		this.skillsDir = resolveSkillsDir(config);
                this.store = config.storeConfig ? new SkillStore(config.storeConfig, this.skillsDir) : null;
                this.mutation = Promise.resolve();
                this.persona = new PersonaStore();
                ctx.effect(() => () => this.store?.dispose(), "plugin-skills: skill store");
		ctx.logger.info(`dsh-plugin-skills 已激活：技能目录 ${this.skillsDir}`);
		// 旧版 persona 从 home patch 迁移到插件文件；只写插件文件，
		// 不触碰 cordis.patch.yml，避免 dsh-hmr 重载 system-prompt。
		// 与保存共用写队列，避免启动迁移与首次保存并发写同一文件。
		void this.mutate(() => this.persona.persistMigrated()).catch((error) => ctx.logger.warn(error));
		this.#installPersonaSection(ctx);
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = [
                                        webCtx.webServer.register({
                                                kind: "exact",
                                                path: `${SKILLS_API_PREFIX}/store`,
                                                handler: (req, res) => this.handleRequest(req, res, "store"),
                                        }),
                                        webCtx.webServer.register({
                                                kind: "exact",
                                                path: `${SKILLS_API_PREFIX}/store/install`,
                                                handler: (req, res) => this.handleRequest(req, res, "store-install"),
                                        }),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/skills`,
						handler: (req, res) => this.handleRequest(req, res, "skills"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/save`,
						handler: (req, res) => this.handleRequest(req, res, "save"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/delete`,
						handler: (req, res) => this.handleRequest(req, res, "delete"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/toggle`,
						handler: (req, res) => this.handleRequest(req, res, "toggle"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/import`,
						handler: (req, res) => this.handleRequest(req, res, "import"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: `${SKILLS_API_PREFIX}/prompt`,
						handler: (req, res) => this.handleRequest(req, res, "prompt"),
					}),
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "plugin-skills: HTTP routes");
			ctx.logger.info(`dsh-plugin-skills 路由已注册：${SKILLS_API_PREFIX}/*`);
		});
	}

	/** 读取请求体为 Buffer（JSON 端点默认上限 1 MiB，导入端点 20 MiB）。 */
	static async readBody(req, maxBytes = 1024 * 1024) {
		let size = 0;
		const chunks = [];
		for await (const chunk of req) {
			size += chunk.length;
			if (size > maxBytes) throw new SkillError("skills/body-too-large", "上传内容过大");
			chunks.push(chunk);
		}
		return Buffer.concat(chunks);
	}

	/**
	 * 注册 system-prompt/assemble 监听：把当前规则作为独立分区
	 * （plugin-repo:persona-rules）注入 system prompt。保存后无需重启或
	 * 重载插件即可生效，也不会触发 dsh-hmr。
	 *
	 * 用独立分区而不是改写 deployment:persona-prefix：agent preset 会用
	 * scoped 同名分区 shadow 掉部署 persona，改写那个分区会让全局规则在
	 * preset 下失效（本机默认 preset 就是这种情况）。
	 * @param ctx - 服务上下文，监听器随插件生命周期释放。
	 */
	#installPersonaSection(ctx) {
		ctx.effect(() => ctx.on("system-prompt/assemble", async (_assembly, _context, next) => {
			const assembly = await next();
			return applyPersonaToAssembly(assembly, this.persona.text);
		}), "plugin-skills: persona section");
	}

	/** 读取当前生效的 persona（内存缓存，已包含旧 patch 迁移值）。 */
	async getPrompt() {
		return this.persona.text;
	}

	/**
	 * 保存 persona 到插件自有文件并立即生效；内容未变化时不落盘，
	 * 避免一次无意义的写盘。不写 cordis.patch.yml，因此不会触发
	 * dsh-hmr 重载插件，界面也不会异常刷新。
	 * @returns `{ file, persona, changed }`
	 */
	async savePrompt(persona) {
		return this.mutate(async () => {
			const result = await this.persona.save(persona);
			if (result.changed) this.ctx.emit("system-prompt/change");
			return result;
		});
	}

        /** 排队写入技能目录；参数为异步操作，返回操作结果，与商店安装共用写队列。 */
        mutate(operation) {
                const next = (this.store?.pending ?? this.mutation).catch(() => {}).then(operation);
                this.mutation = next;
                if (this.store != null) this.store.pending = next;
                return next;
        }

        /** 统一路由处理；参数为请求、响应和操作名，无返回值，输出 JSON 结果。 */
	async handleRequest(req, res, operation) {
		const json = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
                        switch (operation) {
                                case "store": {
                                        if (this.store === null) throw new SkillStoreError("config", "尚未配置技能商店仓库");
                                        if (!["GET", "HEAD", "POST"].includes(req.method)) {
                                                json(405, { ok: false, code: "skills/method", message: "method not allowed" });
                                                return;
                                        }
                                        const options = req.method === "POST" ? await readJsonBody(req, SkillError, "skills") : {};
                                        if (options.refresh !== undefined && typeof options.refresh !== "boolean") throw new SkillStoreError("invalid-request", "刷新参数必须为布尔值");
                                        json(200, { ok: true, ...await this.store.view(options.refresh === true) });
                                        return;
                                }
                                case "store-install":
                                        if (req.method !== "POST") { json(405, { ok: false, code: "skills/method", message: "method not allowed" }); return; }
                                        if (this.store === null) throw new SkillStoreError("config", "尚未配置技能商店仓库");
                                        json(200, { ok: true, ...await this.store.install(await readJsonBody(req, SkillError, "skills")) });
                                        return;
                                default: break;
                        }
			if (operation === "skills") {
				if (req.method !== "GET" && req.method !== "HEAD") {
					json(405, { ok: false, code: "skills/method", message: "method not allowed" });
					return;
				}
				json(200, { ok: true, dir: this.skillsDir, skills: await listSkills(this.skillsDir) });
				return;
			}
			if (operation === "import") {
				if (req.method !== "POST") {
					json(405, { ok: false, code: "skills/method", message: "method not allowed" });
					return;
				}
				let filename = "";
				try {
					filename = decodeURIComponent(String(req.headers["x-file-name"] ?? ""));
				} catch {
					filename = String(req.headers["x-file-name"] ?? "");
				}
				const data = await SkillManagerService.readBody(req, 20 * 1024 * 1024);
                                const result = await this.mutate(() => importSkills(this.skillsDir, { filename, data }));
				json(200, { ok: true, ...result });
				return;
			}
			if (operation === "prompt") {
				if (req.method === "GET" || req.method === "HEAD") {
					json(200, {
						ok: true,
						path: this.persona.file,
						persona: await this.getPrompt(),
						legacyPatch: promptPatchPath(),
					});
					return;
				}
				if (req.method !== "POST") {
					json(405, { ok: false, code: "skills/method", message: "method not allowed" });
					return;
				}
				let promptBody;
				try {
                                        promptBody = await readJsonBody(req, SkillError, "skills");
                                } catch (error) {
                                        if (error instanceof SkillError) throw error;
					json(400, { ok: false, code: "skills/invalid-json", message: "请求体不是合法 JSON" });
					return;
				}
				const persona = typeof promptBody.persona === "string" ? promptBody.persona : "";
				const saved = await this.savePrompt(persona);
				json(200, { ok: true, path: saved.file, persona: saved.persona, changed: saved.changed });
				return;
			}
			if (req.method !== "POST") {
				json(405, { ok: false, code: "skills/method", message: "method not allowed" });
				return;
			}
			let body;
			try {
                                body = await readJsonBody(req, SkillError, "skills");
                        } catch (error) {
                                if (error instanceof SkillError) throw error;
				json(400, { ok: false, code: "skills/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
                        switch (operation) {
                        case "save": {
                                const saved = await this.mutate(() => saveSkill(this.skillsDir, {
					name: body.name,
					description: body.description,
					body: body.body,
					...(body.previous === undefined ? {} : { previous: body.previous }),
                                }));
				json(200, { ok: true, skill: saved });
				return;
                        }
                        case "delete": {
                                const removed = await this.mutate(() => deleteSkill(this.skillsDir, String(body.name ?? "")));
				json(200, { ok: true, removed });
				return;
                        }
                        case "toggle": {
                                const updated = await this.mutate(() => setSkillModelEnabled(this.skillsDir, String(body.name ?? ""), body.modelEnabled !== false));
				json(200, { ok: true, skill: updated });
				return;
			}
                        default: break;
                        }
			json(404, { ok: false, code: "skills/unknown", message: "unknown operation" });
		} catch (error) {
                        const statuses = {
                                "skills/body-too-large": 413, "skill-store/download-limit": 413,
                                "skill-store/exists": 409, "skill-store/conflict": 409, "skill-store/rollback": 409, "skill-store/changed": 409,
                                "skill-store/integrity": 422, "skill-store/http": 502, "skill-store/network": 502,
                        };
                        json(statuses[error.code] ?? 400, { ok: false, code: error.code ?? "skills/failure", message: error.message });
		}
	}
}

export default SkillManagerService;
