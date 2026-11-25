/**
 * dsh-plugin-skills 类型声明。
 */
import type { Context, Service } from "@deepseek-ai/cordis";
import type { SkillStore, SkillStoreConfig } from "./skill-store.js";

/** 本地技能管理配置；参数指定安装目录及可选商店源，供服务初始化使用。 */
export interface SkillManagerConfig {
	/** 技能根目录；留空时自动使用 $DSH_HOME/skills（或 ~/.dsh/skills） */
	skillsDir: string;
        /** 商店仓库配置，未配置时仅提供本地管理。 */
        storeConfig?: SkillStoreConfig | null;
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
/** 规则（提示词）数据目录名（位于 $DSH_HOME 下）。 */
export const PERSONA_DIRNAME: string;
/** 规则（提示词）文件名。 */
export const PERSONA_FILENAME: string;
/** 规则（提示词）落盘路径：<dshHome>/dsh-plugin-repo/persona.md。 */
export function personaPath(home?: string): string;
/** 规范化 persona 文本：统一换行、去掉行尾空白与末尾空行。 */
export function normalizePersona(text: unknown): string;
/**
 * 把规则注入一次 system prompt 组装结果：作为独立分区
 * `plugin-repo:persona-rules` 追加在部署 persona 之后，与 agent preset 的
 * 自有 persona 共存，而不是覆盖它。
 */
export function applyPersonaToAssembly(assembly: AssemblyLike, persona: string): AssemblyLike;

/** 本插件注入的规则段分区名（不与 dsh 分区重名，避免被 scoped persona 覆盖）。 */
export const PERSONA_RULES_SECTION: string;

/** 组装结果的最小结构（PromptPresentation 的可注入子集）。 */
export interface AssemblyLike {
	sections: Array<{ name: string; text: string; interpolate?: boolean }>;
	contexts: Array<{ name: string; text: string; interpolate?: boolean }>;
	variables: Record<string, string | undefined>;
}

/** 规则（提示词）存储：插件自有文件 + 内存缓存。 */
export class PersonaStore {
	constructor(home?: string);
	readonly home: string;
	readonly file: string;
	/** 当前生效文本（注入 system prompt 用）。 */
	readonly text: string;
	/** 保存文本并更新缓存；内容未变化时不落盘。 */
	save(text: string): Promise<{ file: string; persona: string; changed: boolean }>;
	/** 首次读取到迁移值时把文本落到插件文件。 */
	persistMigrated(): Promise<boolean>;
}

export class SkillManagerService extends Service {
	constructor(ctx: Context, config: SkillManagerConfig);
	config: SkillManagerConfig;
	skillsDir: string;
        store: SkillStore | null;
        mutation: Promise<unknown>;
        /** 规则（提示词）存储。 */
        persona: PersonaStore;
        /** 读取当前生效的 persona。 */
        getPrompt(): Promise<string>;
        /** 保存 persona（不写 cordis.patch.yml，立即生效）。 */
        savePrompt(persona: string): Promise<{ file: string; persona: string; changed: boolean }>;
        /** 参数为技能写入操作，返回其结果，与商店安装共用写队列。 */
        mutate<T>(operation: () => Promise<T>): Promise<T>;
}

declare const SkillManager: typeof SkillManagerService;
export default SkillManager;
