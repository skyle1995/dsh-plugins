/**
 * dsh-plugin-sound-alert —— 手动交互提示音插件（宿主半区）。
 *
 * 职责边界：
 * - 提示音本身完全在浏览器半区（lib/client.js）合成与播放，音频以内联 data URI
 *   形式随 bundle 下发，宿主不需要文件服务或外部资源；
 * - 宿主半区提供三件事：
 *   1) 稳定的插件行（服务键 soundAlert，即 ctx.soundAlert），使本包进入 profile
 *      的插件树——没有宿主行，client-modules 就扫描不到 `dsh.client` 声明，
 *      浏览器半区不会下发；
 *   2) 激活日志，便于排查加载问题；
 *   3) 只读自检路由 GET /api/dsh-plugin-sound-alert/status，供人工/脚本确认
 *      宿主侧确实加载了本插件（客户端是否播放由浏览器负责）。
 *
 * @module dsh-plugin-sound-alert
 */
import { Service } from "@deepseek-ai/cordis";

/** 插件包名（客户端 bundle 的模块 id 与此一致）。 */
export const PACKAGE_NAME = "dsh-plugin-sound-alert";

/** 自检路由前缀。 */
export const STATUS_ROUTE = "/api/dsh-plugin-sound-alert/status";

/** 客户端提示音场景标识。 */
export const SOUND_KINDS = ["attention", "done"];

/**
 * 宿主侧服务：承载插件身份、自检信息与只读状态路由。
 * 服务键 `soundAlert`（ctx.soundAlert）。
 */
export class SoundAlertService extends Service {
	/** 不依赖任何其它服务：任何 profile 都能激活。 */
	static inject = [];

	constructor(ctx, config = {}) {
		super(ctx, "soundAlert");
		this.config = config;
		ctx.logger.info(
			`${PACKAGE_NAME} 已激活：手动交互提示音由浏览器半区播放（场景：${SOUND_KINDS.join(" / ")}）`,
		);
		// webServer 属于 Web 组合的作用域，不能从本行的注入面直接读取；用
		// ctx.inject 建一个以 webServer 为依赖的子作用域：Web 存在时注册路由，
		// headless 等 profile 里保持休眠。
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(
				() =>
					webCtx.webServer.register({
						kind: "exact",
						path: STATUS_ROUTE,
						handler: (req, res) => this.handleStatus(req, res),
					}),
				"sound-alert: status route",
			);
			ctx.logger.info(`${PACKAGE_NAME} 自检路由已注册：${STATUS_ROUTE}`);
		});
	}

	/**
	 * 运行时自检信息：确认插件在宿主侧已加载。
	 * @returns 插件名、场景清单与音频分发方式。
	 */
	status() {
		return {
			package: PACKAGE_NAME,
			kinds: [...SOUND_KINDS],
			delivery: "client-bundle-data-uri",
			ready: true,
		};
	}

	/**
	 * 只读状态路由：仅接受 GET/HEAD，其它方法回 405。
	 * @param req - Node HTTP 请求。
	 * @param res - Node HTTP 响应。
	 */
	handleStatus(req, res) {
		const method = String(req.method ?? "GET").toUpperCase();
		if (method !== "GET" && method !== "HEAD") {
			res.statusCode = 405;
			res.setHeader("Allow", "GET, HEAD");
			res.end();
			return;
		}
		const body = JSON.stringify(this.status());
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("Content-Length", String(Buffer.byteLength(body)));
		if (method === "HEAD") res.end();
		else res.end(body);
	}
}

export default SoundAlertService;
