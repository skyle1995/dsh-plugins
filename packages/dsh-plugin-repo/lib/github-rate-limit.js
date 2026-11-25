/**
 * GitHub 匿名接口限流的识别与提示。
 *
 * 自建 Gitea / Forgejo 没有小时限额，公开 GitHub 匿名只有 60 次/小时/IP；
 * 仓库从 Gitea 迁到 GitHub 之后，限额变成日常失败模式（一次冷加载的目录查询
 * 就是 1 次列表 + 每个插件 1 次 manifest）。此时给出的错误必须自解释——告诉
 * 用户「填 token 可解」以及何时恢复，而不是丢一条裸的 403。
 *
 * @module github-rate-limit
 */

/** 判断响应是否为 GitHub 限额耗尽；参数为 fetch Response，返回布尔值。 */
export function isRateLimited(response) {
	return response?.status === 403 && response.headers?.get?.("x-ratelimit-remaining") === "0";
}

/**
 * 把响应里的重置时刻写成 `HH:MM`；参数为 Response，返回可拼接的中文短语，
 * 头缺失或非法时返回空串（服务端本地时区）。
 */
export function rateLimitResetText(response) {
	const seconds = Number(response?.headers?.get?.("x-ratelimit-reset"));
	if (!Number.isFinite(seconds) || seconds <= 0) return "";
	const at = new Date(seconds * 1000);
	if (Number.isNaN(at.getTime())) return "";
	const pad = (value) => String(value).padStart(2, "0");
	return `（约 ${pad(at.getHours())}:${pad(at.getMinutes())} 恢复）`;
}

/** 生成面向用户的一句话提示；参数为 Response，返回中文说明。 */
export function rateLimitMessage(response) {
	return `GitHub 接口匿名限额已用尽（60 次/小时）${rateLimitResetText(response)}：请在 DSH 设置 → 插件 → dsh-plugin-repo 中填写 token（GitHub Personal Access Token，限额 5000 次/小时）`;
}
