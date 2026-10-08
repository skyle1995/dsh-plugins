/**
 * dsh-plugin-repo 浏览器半区入口：合并注册三个设置分区 + 会话菜单项。
 *
 * - 插件仓库（100）：在线目录 / 安装 / 更新 / 卸载（宿主路由）
 * - 技能能力（110）：本地 skills 管理（列表/新建/编辑/删除/导入/开关）
 * - 规则提示词（130）：全局 system-prompt persona 查看 / 编辑
 * - 会话菜单项：会话右键菜单底部的「删除会话」（官方 workspaceRegistry）
 */
import { register as registerRepo } from "./repo.tsx";
import { register as registerSkills } from "./skills.tsx";
import { register as registerArchive } from "./session-archive.tsx";

/** 浏览器插件入口：注册全部基础能力分区。 */
export function apply(ctx) {
	registerRepo(ctx);
	registerSkills(ctx);
	registerArchive(ctx);
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
];
