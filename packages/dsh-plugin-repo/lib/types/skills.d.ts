/**
 * dsh-plugin-skills 类型声明。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface SkillManagerConfig {
	/** 技能根目录；留空时自动使用 $DSH_HOME/skills（或 ~/.dsh/skills） */
	skillsDir: string;
}

export interface SkillEntry {
	name: string;
	description: string;
	whenToUse: string;
	/** 是否设置了 disable-model-invocation */
	modelDisabled: boolean;
	/** user-invocable（缺省 true） */
	userInvocable: boolean;
	/** 布局：bundle（<name>/SKILL.md）或 flat（<name>.md） */
	layout: "bundle" | "flat";
	/** 相对技能根目录的文件路径 */
	file: string;
	/** frontmatter 之后的正文 */
	body: string;
	hasFrontmatter: boolean;
}

export class SkillError extends Error {
	code: string;
}

export function resolveDshHome(): string;
export function resolveSkillsDir(config: SkillManagerConfig): string;
/** 净化技能名；参数为名称与可选宿主平台，返回名称或空串。 */
export function sanitizeSkillName(name: string, platform?: string): string;
export function isYamlTrue(value: unknown): boolean;
export function parseFrontmatter(content: string): { fields: Record<string, string>; body: string; hasFrontmatter: boolean };
export function buildFrontmatter(fields: Record<string, unknown>): string;
export function setFrontmatterField(content: string, key: string, value: string | undefined): string;
export function listSkills(dir: string): Promise<SkillEntry[]>;
export function findSkill(dir: string, nameOrFile: string): Promise<SkillEntry | undefined>;
export function saveSkill(dir: string, input: { name: string; description?: string; body?: string; previous?: SkillEntry }): Promise<{ name: string; layout: "bundle" | "flat"; file: string }>;
export function deleteSkill(dir: string, nameOrFile: string): Promise<SkillEntry>;
export function setSkillModelEnabled(dir: string, nameOrFile: string, modelEnabled: boolean): Promise<SkillEntry>;
export function importSkills(dir: string, input: { filename: string; data: Buffer }): Promise<{ imported: Array<{ name: string; layout: "bundle" | "flat" }>; skipped: string[] }>;
export function extractPersona(content: string): string;
export function buildPromptBlock(persona: string): string;
export function setPromptInPatch(content: string, persona: string): string;
export function promptPatchPath(home?: string): string;

export class SkillManagerService extends Service {
	constructor(ctx: Context, config: SkillManagerConfig);
	config: SkillManagerConfig;
	skillsDir: string;
}

declare const SkillManager: typeof SkillManagerService;
export default SkillManager;
