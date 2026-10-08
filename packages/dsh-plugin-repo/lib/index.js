/**
 * dsh-plugin-repo —— 把 Gitea 上的插件 monorepo 注册为 DSH 的插件安装源。
 *
 * 设计要点：
 * - pnpm 支持 `git+https://host/owner/repo.git#<branch>&path:<子目录>` 安装
 *   仓库子目录，因此每个插件（packages/<name>）都有可直接安装的 git spec；
 *   本插件负责从 Gitea API 生成目录（catalog）、拼装 spec，并把安装转发给
 *   profile 的 pluginManager 服务（享受其兼容性预检、回滚与构建批准流程）。
 * - 服务键为 `pluginRepo`（ctx.pluginRepo），注入 pluginManager；激活由
 *   服务可用性驱动：没有 plugin-manager 的环境里本插件保持未激活。
 * - 依赖 @deepseek-ai/cordis 与 @deepseek-ai/schemastery 以 peerDependencies
 *   声明精确范围，由 DSH 的运行时解析器（installation scope）供应，无需
 *   pnpm 安装到 profile node_modules。
 *
 * @module dsh-plugin-repo
 */
import { Service } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { basename } from "node:path";

/** 本插件默认对接的 Gitea 主机。 */
export const DEFAULT_GIT_HOST = "https://hub.ifunx.com";

/** 默认 catalog 目录：monorepo 内每个子目录是一个插件包。 */
export const DEFAULT_CATALOG_DIR = "packages";

/** 一次 Gitea API 请求的超时（毫秒）。 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/** 浏览器半区读取仓库目录的 HTTP 路由（注册在 web profile 的 webServer 上）。 */
export const CATALOG_ROUTE = "/api/dsh-plugin-repo/catalog";

/** 浏览器半区的管理路由：安装 / 卸载 / 取消（转发 pluginManager 服务）。 */
export const INSTALL_ROUTE = "/api/dsh-plugin-repo/install";
export const REMOVE_ROUTE = "/api/dsh-plugin-repo/remove";
export const CANCEL_ROUTE = "/api/dsh-plugin-repo/cancel";

/**
 * 带错误码的仓库操作失败，code 形如 `plugin-repo/<kind>`。
 * @extends Error
 */
export class RepoError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "RepoError";
		this.code = code;
	}
}

/**
 * 拼出仓库的 git 克隆地址（去掉 gitHost 尾部斜杠）。
 * @param config - 插件配置（gitHost/owner/repo）。
 * @returns `https://host/owner/repo.git`
 */
export function gitUrlOf(config) {
	const host = (config.gitHost ?? DEFAULT_GIT_HOST).replace(/\/+$/, "");
	return `${host}/${config.owner}/${config.repo}.git`;
}

/**
 * 拼出可直接交给 `dsh plugin add` / pluginManager.installBundle 的安装 spec。
 * pnpm 的 fragment 语法：`#<分支>&path:<子目录>`。
 *
 * @param config - 插件配置（gitHost/owner/repo/branch/catalogDir）。
 * @param pluginPath - 仓库内插件目录，如 `packages/dsh-plugin-repo`；
 *   不带 `/` 时视为 catalog 目录下的包名。
 * @returns 如 `https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-repo`
 */
export function specFor(config, pluginPath) {
	const normalized = pluginPath.includes("/") ? pluginPath : `${config.catalogDir ?? DEFAULT_CATALOG_DIR}/${pluginPath}`;
	const fragment = [config.branch || "HEAD", `path:${normalized}`].join("&");
	return `${gitUrlOf(config)}#${fragment}`;
}

/** 单次 Gitea API 请求；返回 JSON 或文本，失败统一抛 RepoError。 */
export async function giteaRequest(config, path, { text = false } = {}) {
	const host = (config.gitHost ?? DEFAULT_GIT_HOST).replace(/\/+$/, "");
	const url = `${host}/api/v1${path}`;
	const headers = { accept: text ? "text/plain" : "application/json" };
	if (config.token) headers.authorization = `token ${config.token}`;
	let response;
	try {
		response = await fetch(url, {
			headers,
			redirect: "follow",
			signal: AbortSignal.timeout(config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		if (error.name === "TimeoutError") throw new RepoError("plugin-repo/timeout", `Gitea API 超时（${url}）`);
		throw new RepoError("plugin-repo/network", `Gitea API 不可达（${url}）：${error.message}`, { cause: error });
	}
	if (!response.ok) throw new RepoError("plugin-repo/http", `Gitea API ${response.status}：GET ${url}`, { status: response.status });
	return text ? await response.text() : await response.json();
}

/**
 * 读取仓库 catalog：列出 catalog 目录下的插件包及其 package.json 摘要。
 * 纯函数，可脱离 Cordis 单独测试。
 *
 * @param config - 插件配置。
 * @param request - 默认使用 giteaRequest，可注入替身用于测试。
 * @returns 插件条目数组，每项含 name/version/description/path/isBundle/spec。
 */
export async function buildCatalog(config, request = giteaRequest) {
	const { owner, repo, branch = "main", catalogDir = DEFAULT_CATALOG_DIR } = config;
	const listPath = `/repos/${owner}/${repo}/contents/${catalogDir}?ref=${branch}`;
	let listing;
	try {
		listing = await request(config, listPath);
	} catch (error) {
		if (error.code === "plugin-repo/http" && error.status === 404) return [];
		throw error;
	}
	if (!Array.isArray(listing)) throw new RepoError("plugin-repo/catalog", `目录响应不是数组：${listPath}`);
	const entries = [];
	for (const item of listing.filter((entry) => entry.type === "dir")) {
		const pluginPath = `${catalogDir}/${item.name}`;
		let manifest;
		try {
			const raw = await request(config, `/repos/${owner}/${repo}/raw/${pluginPath}/package.json?ref=${branch}`, { text: true }).then((body) => JSON.parse(body));
			manifest = raw;
		} catch (error) {
			// 某些 Gitea 部署不开放 raw 端点：回退到 contents 的 base64。
			try {
				const file = await request(config, `/repos/${owner}/${repo}/contents/${pluginPath}/package.json?ref=${branch}`);
				manifest = JSON.parse(Buffer.from(file.content ?? "", file.encoding ?? "base64").toString("utf8"));
			} catch {
				entries.push({ name: item.name, path: pluginPath, spec: specFor(config, pluginPath), problem: "no-package-json" });
				continue;
			}
		}
		entries.push({
			name: typeof manifest.name === "string" ? manifest.name : item.name,
			version: typeof manifest.version === "string" ? manifest.version : null,
			description: typeof manifest.description === "string" ? manifest.description : "",
			path: pluginPath,
			isBundle: Boolean(manifest.dsh?.bundle?.patch),
			spec: specFor(config, pluginPath),
		});
	}
	return entries;
}

/**
 * dsh-plugin-repo 的 Cordis 服务：目录查询、spec 生成与一键安装。
 * 服务键 `pluginRepo`，通过 `ctx.pluginRepo` 使用。
 */
export class PluginRepoService extends Service {
	static inject = ["pluginManager"];

	/** Cordis 配置契约：loader 据此校验 patch 配置并套用默认值。 */
	static Config = Schema.object({
		gitHost: Schema.string().default(DEFAULT_GIT_HOST),
		owner: Schema.string().default("skyle1995"),
		repo: Schema.string().default("dsh-plugins"),
		branch: Schema.string().default("main"),
		catalogDir: Schema.string().default(DEFAULT_CATALOG_DIR),
		token: Schema.string().role("secret").default(""),
		requestTimeoutMs: Schema.number().default(DEFAULT_REQUEST_TIMEOUT_MS),
	});

	constructor(ctx, config) {
		super(ctx, "pluginRepo");
		this.config = config;
		ctx.logger.info(`dsh-plugin-repo 已激活：${gitUrlOf(config)}（分支 ${config.branch}，目录 ${config.catalogDir}/）`);
		// Web profile 中注册浏览器半区使用的目录路由。webServer 属于 Web 组合的
		// 作用域，不能从本行的注入面直接读取（ctx.get 拿不到），因此用
		// ctx.inject 建一个以 webServer 为依赖的作用域子插件：Web 存在时注册
		// 路由，headless 等 profile 里保持休眠、不影响本服务。
		ctx.inject(["webServer"], (webCtx) => {
			webCtx.effect(() => {
				const disposers = [
					webCtx.webServer.register({
						kind: "exact",
						path: CATALOG_ROUTE,
						handler: (req, res) => this.handleCatalogRequest(req, res),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: INSTALL_ROUTE,
						handler: (req, res) => this.handleManagementRequest(req, res, "install"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: REMOVE_ROUTE,
						handler: (req, res) => this.handleManagementRequest(req, res, "remove"),
					}),
					webCtx.webServer.register({
						kind: "exact",
						path: CANCEL_ROUTE,
						handler: (req, res) => this.handleManagementRequest(req, res, "cancel"),
					}),
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "plugin-repo: HTTP routes");
			ctx.logger.info(`dsh-plugin-repo 路由已注册：${CATALOG_ROUTE} 等`);
		});
	}

	/**
	 * 目录 + 已安装状态（来自 pluginManager.listBundles），供浏览器半区
	 * 一次性拿到渲染所需全部数据，无需浏览器侧再调 Remote。
	 */
	async catalogForBrowser() {
		const base = await this.catalog();
		let bundles = [];
		try {
			bundles = await this.ctx.pluginManager.listBundles();
		} catch {
			// 管理器不可用时仍返回纯目录；安装类操作会各自报错。
		}
		const byName = new Map((Array.isArray(bundles) ? bundles : []).map((bundle) => [bundle.name, bundle]));
		return {
			...base,
			entries: base.entries.map((entry) => {
				const bundle = byName.get(entry.name);
				return {
					...entry,
					installed: bundle?.installed === true,
					enabled: bundle?.enabled === true,
					removable: bundle?.removable === true,
				};
			}),
		};
	}

	/** GET {CATALOG_ROUTE} —— 返回 `{ ok, source, entries }`（含已安装/启用状态）。 */
	async handleCatalogRequest(req, res) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "GET" && req.method !== "HEAD") {
				payload(405, { ok: false, code: "plugin-repo/method", message: "method not allowed" });
				return;
			}
			payload(200, { ok: true, ...(await this.catalogForBrowser()) });
		} catch (error) {
			payload(502, { ok: false, code: error.code ?? "plugin-repo/catalog", message: error.message });
		}
	}

	/** POST 管理路由：install / remove / cancel，转发给 pluginManager 服务。 */
	async handleManagementRequest(req, res, operation) {
		const payload = (status, value) => {
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(value));
		};
		try {
			if (req.method !== "POST") {
				payload(405, { ok: false, code: "plugin-repo/method", message: "method not allowed" });
				return;
			}
			let body = {};
			try {
				const chunks = [];
				for await (const chunk of req) chunks.push(chunk);
				body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
			} catch {
				payload(400, { ok: false, code: "plugin-repo/invalid-json", message: "请求体不是合法 JSON" });
				return;
			}
			const manager = this.ctx.pluginManager;
			if (operation === "install") {
				const spec = String(body.spec ?? "").trim();
				if (spec === "") {
					payload(400, { ok: false, code: "plugin-repo/invalid-spec", message: "缺少安装 spec" });
					return;
				}
				const result = await manager.installBundle(spec, {
					enabled: body.enabled !== false,
					...(body.requestId === undefined ? {} : { requestId: String(body.requestId) }),
				});
				payload(200, { ok: true, result });
				return;
			}
			if (operation === "remove") {
				const name = String(body.name ?? "").trim();
				if (name === "") {
					payload(400, { ok: false, code: "plugin-repo/invalid-name", message: "缺少插件名" });
					return;
				}
				const result = await manager.removeBundle(name);
				payload(200, { ok: true, result });
				return;
			}
			if (operation === "cancel") {
				const result = await manager.cancelInstall(String(body.requestId ?? ""));
				payload(200, { ok: true, result });
				return;
			}
			payload(404, { ok: false, code: "plugin-repo/unknown", message: "unknown operation" });
		} catch (error) {
			payload(400, { ok: false, code: error.code ?? "plugin-repo/failure", message: error.message });
		}
	}

	/** 仓库 git 地址。 */
	gitUrl() {
		return gitUrlOf(this.config);
	}

	/** 某个插件目录的安装 spec（见 specFor）。 */
	specFor(pluginPath) {
		return specFor(this.config, pluginPath);
	}

	/** 当前安装源的描述，供 UI / 工具消费。 */
	describe() {
		const { gitHost, owner, repo, branch, catalogDir } = this.config;
		return { gitHost, owner, repo, branch, catalogDir, gitUrl: this.gitUrl() };
	}

	/** 仓库插件目录（实时请求 Gitea API）。 */
	async catalog() {
		const entries = await buildCatalog(this.config);
		return {
			source: this.describe(),
			entries,
		};
	}

	/**
	 * 把「目录条目名 / 仓库内路径 / 任意安装 spec」解析为最终 spec。
	 * 先按目录精确匹配（包名、完整路径、目录名），再放行 spec 形态的输入。
	 * @returns `{ entry, spec }`，目录未命中且不是 spec 时 entry 为 null、spec 原样。
	 */
	async resolve(specOrName) {
		if (typeof specOrName !== "string" || specOrName.trim() === "") throw new RepoError("plugin-repo/invalid-spec", "安装目标不能为空");
		const target = specOrName.trim();
		const entries = await buildCatalog(this.config);
		const hit = entries.find((entry) => target === entry.name || target === entry.path || target === basename(entry.path));
		if (hit) return { entry: hit, spec: hit.spec };
		if (/^(https?:\/\/|git\+|file:|\.{0,2}\/)/.test(target) || /\.git(#|$)/.test(target)) return { entry: null, spec: target };
		throw new RepoError("plugin-repo/unknown", `目录中没有 ${JSON.stringify(target)}，也不是可识别的安装 spec`);
	}

	/**
	 * 一键安装：解析目标为 spec 后交给 profile 的 pluginManager（自带兼容性
	 * 预检、失败回滚、构建脚本批准等流程）。本服务只在 pluginManager 可用的
	 * profile 中激活。
	 * @returns `{ source, spec, result }`，result 为 pluginManager.installBundle 的返回值。
	 */
	async install(specOrName, options = {}) {
		const manager = this.ctx.pluginManager;
		const { entry, spec } = await this.resolve(specOrName);
		const result = await manager.installBundle(spec, options);
		return { source: entry, spec, result };
	}
}

export default PluginRepoService;
