/**
 * dsh-plugin-repo 浏览器半区入口：注册两个设置分区 + 会话菜单项。
 *
 * - 技能能力（110）：本地 skills 管理（列表/新建/编辑/删除/导入/开关）
 * - 规则提示词（130）：全局 system-prompt persona 查看 / 编辑
 * - 会话菜单项：会话右键菜单底部的「删除会话」（官方 workspaceRegistry）
 */
import { register as registerSkills } from "./skills.tsx";
import { register as registerArchive } from "./session-archive.tsx";

/** 浏览器插件入口：注册技能、规则与会话菜单，插件管理使用 DSH 内置功能。 */
export function apply(ctx) {
	registerSkills(ctx);
	registerArchive(ctx);
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
        "sessions",
        "workspaces",
        "sidebarRight",
        "uiWorkspace",
];
