/** 自动发现技能商店的类型：元信息来自 SKILL.md，版本可回退到 Git 目录版本。 */
export interface SkillStoreConfig {
        /** 仓库主机、所有者、仓库名及可选分支，不允许 URL 内嵌凭据。 */
        gitHost: string;
        owner: string;
        repo: string;
        branch?: string;
        /** 仓库访问凭据，商店接口不返回该字段。 */
        token?: string;
        requestTimeoutMs?: number;
        /** 技能根目录，默认 skills。 */
        skillsCatalogDir?: string;
}

/** 商店条目：描述为 SKILL.md 中的原始文本，安装状态基于本地记录及内容校验。 */
export interface SkillStoreEntry {
        id: string;
        title: string;
        description: string;
        category: string;
        license: string | null;
        upstreamVersion: string | null;
        version: string;
        revision: string;
        path: string;
        treeSha: string;
        sha256: string;
        installed: boolean;
        managed: boolean;
        installedVersion: string | null;
        modified: boolean;
        updateAvailable: boolean;
}

/** 商店错误，包含供 API 返回的稳定错误码。 */
export class SkillStoreError extends Error {
        /** 参数为错误码、消息与可选 cause，返回异常实例。 */
        constructor(code: string, message: string, options?: ErrorOptions);
        code: string;
}

/** 安装记录文件名，记录由安装器自动生成，不是商店目录索引。 */
export const SKILL_STORE_RECEIPT: ".dsh-skill-store.json";
/** 参数为字节或文本，返回 SHA-256 十六进制。 */
export function skillDigest(data: string | Uint8Array): string;

/** 商店操作对象，不运行技能代码，更新前备份整个同名目录或平铺技能。 */
export class SkillStore {
        /** 参数为仓库配置、安装目录和可选 fetch 替身，返回实例。 */
        constructor(config: SkillStoreConfig, skillsDir: string, fetchImpl?: typeof fetch);
        config: SkillStoreConfig;
        skillsDir: string;
        pending: Promise<unknown>;
        /** 无参数，无返回值，取消请求与后续安装提交。 */
        dispose(): void;
        /** 参数为刷新标记，返回发现的技能及被跳过目录的提示，不返回凭据。 */
        view(refresh?: boolean): Promise<{ entries: SkillStoreEntry[]; revision: string; warnings: Array<{ id: string; message: string }> }>;
        /** 参数为 id、明确覆盖确认和可选预期树版本，返回安装结果及旧内容备份位置。 */
        install(input: { id: string; replace?: boolean; treeSha?: string }): Promise<{ id: string; version: string; skipped: number; backup: string | null }>;
}
