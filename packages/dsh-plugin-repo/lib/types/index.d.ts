/**
 * dsh-plugin-repo 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface PluginRepoConfig {
	/** 代码托管主机根地址，默认 https://github.com（也兼容 Gitea / Forgejo） */
	gitHost: string;
	/** 仓库所有者 */
	owner: string;
	/** 仓库名 */
	repo: string;
	/** 分支，默认 main */
	branch: string;
	/** monorepo 内插件目录，默认 packages */
	catalogDir: string;
        /** 仓库技能根目录，默认 skills；自动读取子目录 SKILL.md，无需 JSON 索引。 */
        skillsCatalogDir: string;
	/** 仓库 Access Token（公开仓库可留空；GitHub 与 Gitea 通用） */
	token: string;
	/** API 请求超时毫秒数，默认 15000 */
	requestTimeoutMs: number;
	/** 技能能力子服务的技能根目录；留空自动 $DSH_HOME/skills */
	skillsDir: string;
	/** 会话归档子服务的会话根目录；留空自动 $DSH_HOME/sessions */
	sessionsDir: string;
}

export interface RepoSource {
	gitHost: string;
	owner: string;
	repo: string;
	branch: string;
	catalogDir: string;
	gitUrl: string;
}

export interface CatalogEntry {
	/** package.json 的 name，缺省为目录名 */
	name: string;
	/** package.json 的 version，缺失为 null */
	version: string | null;
	/** package.json 的 description */
	description: string;
	/** 仓库内目录，如 packages/dsh-plugin-repo */
	path: string;
	/** 是否为 DSH 组合包（dsh.bundle.patch） */
	isBundle: boolean;
	/** 可直接安装的 git spec（#branch&path: 语法） */
	spec: string;
	/** 已安装版本（listBundles 合并；未安装或未知为 null） */
	installedVersion?: string | null;
	installed?: boolean;
	enabled?: boolean;
	removable?: boolean;
}

export class RepoError extends Error {
	code: string;
        /** Gitea HTTP 状态；参数来自错误构造选项，非 HTTP 错误可缺省。 */
        status?: number;
}

export function gitUrlOf(config: PluginRepoConfig): string;
export function specFor(config: PluginRepoConfig, pluginPath: string): string;
/** 判断 gitHost 属于哪种仓库 API 风格：`"github"`（api.github.com）或 `"gitea"`（<host>/api/v1）。 */
export function apiFlavorOf(config: PluginRepoConfig): "github" | "gitea";
/** 拼出 REST API 前缀（GitHub 为 https://api.github.com，Gitea 系为 <host>/api/v1）。 */
export function apiBaseOf(config: PluginRepoConfig): string;
/** 单次仓库 API 请求；返回 JSON 或文本，失败抛 RepoError。 */
export function repoRequest<T = unknown>(config: PluginRepoConfig, path: string, options?: { text?: boolean }): Promise<T>;
/** 旧名兼容：等价 repoRequest。 */
export const giteaRequest: typeof repoRequest;
export function buildCatalog(config: PluginRepoConfig, request?: typeof repoRequest): Promise<CatalogEntry[]>;
export function resolveBranchHead(config: PluginRepoConfig, request?: typeof repoRequest): Promise<string>;

export class PluginRepoService extends Service {
	constructor(ctx: Context, config: PluginRepoConfig);
	config: PluginRepoConfig;
	gitUrl(): string;
	specFor(pluginPath: string): string;
	describe(): RepoSource;
	catalog(): Promise<{ source: RepoSource; entries: CatalogEntry[] }>;
	resolve(specOrName: string): Promise<{ entry: CatalogEntry | null; spec: string }>;
	install(specOrName: string, options?: object): Promise<{ source: CatalogEntry | null; spec: string; result: unknown }>;
}

declare const PluginRepo: typeof PluginRepoService;
export default PluginRepo;
