/**
 * dsh-plugin-repo 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface PluginRepoConfig {
	/** Gitea 主机根地址，默认 https://hub.ifunx.com */
	gitHost: string;
	/** 仓库所有者 */
	owner: string;
	/** 仓库名 */
	repo: string;
	/** 分支，默认 main */
	branch: string;
	/** monorepo 内插件目录，默认 packages */
	catalogDir: string;
	/** Gitea Access Token（公开仓库可留空） */
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
	status?: number;
}

export function gitUrlOf(config: PluginRepoConfig): string;
export function specFor(config: PluginRepoConfig, pluginPath: string): string;
export function giteaRequest<T = unknown>(config: PluginRepoConfig, path: string, options?: { text?: boolean }): Promise<T>;
export function buildCatalog(config: PluginRepoConfig, request?: typeof giteaRequest): Promise<CatalogEntry[]>;

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
