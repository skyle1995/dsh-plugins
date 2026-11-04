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
 * - 规则（提示词）：读取/编辑 home 级 patch（$DSH_HOME/cordis.patch.yml）
 *   里的 `- id: system-prompt` persona 块——手术式替换，保留文件内其它
 *   条目；保存后由 dsh-hmr 热加载，无需重启。
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
import { existsSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { readJsonBody } from "./request.js";

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

/** home 级 patch 文件名（位于 $DSH_HOME 下）。 */
export const HOME_PATCH_FILENAME = "cordis.patch.yml";

/**
 * 从 patch 文本中提取 system-prompt 块的 persona（支持行内标量与 | / |- 块标量）。
 * 找不到时返回空字符串。
 */
export function extractPersona(content) {
	const lines = String(content).split(/\r?\n/);
	const start = lines.findIndex((line) => /^- id: system-prompt\s*$/.test(line));
	if (start < 0) return "";
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i];
		if (/^- id:/.test(line) || /^\S/.test(line)) break;
		const block = /^    persona:\s*\|(-?)\s*$/.exec(line);
		const inline = block === null ? /^    persona:\s*(.+)$/.exec(line) : null;
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
	return "";
}

/**
 * 生成 system-prompt 条目块（persona 用 | 块标量，内容统一缩进 6 空格）。
 */
export function buildPromptBlock(persona) {
	const lines = String(persona ?? "").split(/\r?\n/);
	return ["- id: system-prompt", "  config:", "    persona: |-", ...lines.map((line) => (line === "" ? "" : `      ${line}`)), ""].join("\n");
}

/**
 * 手术式替换：存在 system-prompt 条目则只替换该条目（到下一个顶层
 * `- id:` 或文件末尾为止），保留文件内其它条目；不存在则追加到文件末尾。
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

/** home 级 patch 的绝对路径。 */
export function promptPatchPath(home = resolveDshHome()) {
	return join(home, HOME_PATCH_FILENAME);
}

/**
 * dsh-plugin-skills 的 Cordis 服务：技能文件管理 + 规则（提示词）+ Web 路由。
 * 服务键 `skillManager`（ctx.skillManager）。
 */
export class SkillManagerService extends Service {
	static Config = Schema.object({
		skillsDir: Schema.string().default(""),
	});

	constructor(ctx, config) {
		super(ctx, "skillManager");
		this.config = config;
		this.skillsDir = resolveSkillsDir(config);
		ctx.logger.info(`dsh-plugin-skills 已激活：技能目录 ${this.skillsDir}`);
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = [
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

	/** 读取 home 级 patch 里的 system-prompt persona。 */
	async getPrompt() {
		const file = promptPatchPath();
		if (!existsSync(file)) return "";
		return extractPersona(await readFile(file, "utf8"));
	}

	/** 保存 persona（手术式替换，保留其它条目；home patch 由 dsh-hmr 热加载）。 */
	async savePrompt(persona) {
		const file = promptPatchPath();
		const existing = existsSync(file) ? await readFile(file, "utf8") : "";
                await writeSkillAtomic(file, setPromptInPatch(existing, persona));
		return file;
	}

	/** 统一的路由处理器。 */
	async handleRequest(req, res, operation) {
		const json = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
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
				const result = await importSkills(this.skillsDir, { filename, data });
				json(200, { ok: true, ...result });
				return;
			}
			if (operation === "prompt") {
				if (req.method === "GET" || req.method === "HEAD") {
					json(200, { ok: true, path: promptPatchPath(), persona: await this.getPrompt() });
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
				await this.savePrompt(persona);
				json(200, { ok: true, path: promptPatchPath(), persona });
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
			if (operation === "save") {
				const saved = await saveSkill(this.skillsDir, {
					name: body.name,
					description: body.description,
					body: body.body,
					...(body.previous === undefined ? {} : { previous: body.previous }),
				});
				json(200, { ok: true, skill: saved });
				return;
			}
			if (operation === "delete") {
				const removed = await deleteSkill(this.skillsDir, String(body.name ?? ""));
				json(200, { ok: true, removed });
				return;
			}
			if (operation === "toggle") {
				const updated = await setSkillModelEnabled(this.skillsDir, String(body.name ?? ""), body.modelEnabled !== false);
				json(200, { ok: true, skill: updated });
				return;
			}
			json(404, { ok: false, code: "skills/unknown", message: "unknown operation" });
		} catch (error) {
                        json(error.code === "skills/body-too-large" ? 413 : 400, { ok: false, code: error.code ?? "skills/failure", message: error.message });
		}
	}
}

export default SkillManagerService;
