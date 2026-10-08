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
export function sanitizeSkillName(name: string): string;
export function isYamlTrue(value: unknown): boolean;
export function parseFrontmatter(content: string): { fields: Record<string, string>; body: string; hasFrontmatter: boolean };
export function buildFrontmatter(fields: Record<string, unknown>): string;
export function setFrontmatterField(content: string, key: string, value: string | undefined): string;
export function listSkills(dir: string): Promise<SkillEntry[]>;
export function findSkill(dir: string, nameOrFile: string): Promise<SkillEntry | undefined>;
export function saveSkill(dir: string, input: { name: string; description?: string; body?: string; previous?: SkillEntry }): Promise<{ name: string; layout: "bundle" | "flat"; file: string }>;
export function deleteSkill(dir: string, nameOrFile: string): Promise<SkillEntry>;
export function setSkillModelEnabled(dir: string, nameOrFile: string, modelEnabled: boolean): Promise<SkillEntry>;

export class SkillManagerService extends Service {
	constructor(ctx: Context, config: SkillManagerConfig);
	config: SkillManagerConfig;
	skillsDir: string;
}

declare const SkillManager: typeof SkillManagerService;
export default SkillManager;
