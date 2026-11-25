/**
 * dsh-plugin-repo 服务冒烟测试（脱离 DSH profile 独立运行）：
 * 用真实 cordis 起最小 Context，注入桩 pluginManager，验证
 * catalog / resolve / install 的完整链路。运行：
 *   node packages/dsh-plugin-repo/test/smoke.mjs
 */
import { Context, Service } from "@deepseek-ai/cordis";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { default: PluginRepoService } = await import(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "../lib/index.js")).href);

/** 记录 installBundle 调用并返回固定结果的桩。 */
class StubManager extends Service {
	constructor(ctx) {
		super(ctx, "pluginManager");
	}
	calls = [];
	async installBundle(spec, options) {
		this.calls.push({ spec, options });
		return { ok: true };
	}
	async listBundles() {
		return [];
	}
}

/**
 * GitHub 匿名接口限流很紧（60 次/小时/IP），本测试会真实访问仓库，
 * 因此优先取环境变量或本机 ~/.dsh/secrets/github_token 作为令牌；
 * 都没有时退化为匿名请求（令牌缺失不影响公开仓库的读取语义）。
 */
function resolveToken() {
	const fromEnv = process.env.DSH_REPO_TOKEN || process.env.GITHUB_TOKEN || "";
	if (fromEnv) return fromEnv.trim();
	const stored = join(homedir(), ".dsh", "secrets", "github_token");
	return existsSync(stored) ? readFileSync(stored, "utf8").trim() : "";
}

const root = new Context();
await root.plugin(StubManager, {});
await root.plugin(PluginRepoService, {
	gitHost: "https://github.com",
	owner: "skyle1995",
	repo: "dsh-plugins",
	branch: "main",
	catalogDir: "packages",
	token: resolveToken(),
	requestTimeoutMs: 15000,
});
const repo = root.get("pluginRepo");

// 1) 目录（真实仓库 API）
const { source, entries } = await repo.catalog();
console.log("catalog:", source.gitUrl, "->", entries.length, "entries");
if (entries.length < 1 || !entries.some((entry) => entry.name === "dsh-plugin-repo")) throw new Error("catalog 不符合预期");

// 2) spec 钉 commit（自包含断言）
{
	const { pinSpecToCommit } = await import("../lib/index.js");
	const sha = "a".repeat(40);
	const ok = (label, condition) => { if (!condition) throw new Error(`pin check failed: ${label}`); };
	ok("钉分支为 commit", pinSpecToCommit("https://github.com/skyle1995/dsh-plugins.git#main&path:packages/x", sha) === `https://github.com/skyle1995/dsh-plugins.git#${sha}&path:packages/x`);
	ok("已钉 sha 不重复", pinSpecToCommit(`https://github.com/skyle1995/dsh-plugins.git#${sha}&path:packages/x`, sha) === `https://github.com/skyle1995/dsh-plugins.git#${sha}&path:packages/x`);
	ok("无 fragment 原样", pinSpecToCommit("https://github.com/skyle1995/dsh-plugins.git", sha) === "https://github.com/skyle1995/dsh-plugins.git");
	ok("非法 commit 原样", pinSpecToCommit("https://github.com/skyle1995/dsh-plugins.git#main&path:x", "xyz") === "https://github.com/skyle1995/dsh-plugins.git#main&path:x");
	ok("仅 path 参数", pinSpecToCommit("https://github.com/skyle1995/dsh-plugins.git#path:packages/x", sha) === `https://github.com/skyle1995/dsh-plugins.git#path:packages/x`);
	console.log("pin checks ok");
}

// 3) resolve：包名 / 路径 / spec 三种输入
const byName = await repo.resolve("dsh-plugin-repo");
const byDir = await repo.resolve("dsh-plugin-repo");
const byPath = await repo.resolve("packages/dsh-plugin-repo");
const bySpec = await repo.resolve("https://example.com/org/other.git#dev&path:x/y");
console.log("resolve name:", byName.spec);
console.log("resolve dir :", byDir.spec);
console.log("resolve path:", byPath.spec);
console.log("resolve spec:", bySpec.spec, "| entry:", bySpec.entry);
if (!byName.spec.includes("#main&path:packages/dsh-plugin-repo")) throw new Error("spec 生成错误");

// 3) install：目录条目 + 任意 spec 都应转发给 pluginManager
const installed = await repo.install("dsh-plugin-repo", { enabled: true, requestId: "smoke-1" });
const manager = root.get("pluginManager");
console.log("install result:", JSON.stringify(installed), "| manager.calls:", manager.calls.length);
const forwarded = manager.calls[0]?.spec ?? "";
if (!new RegExp(`^https://github\\.com/skyle1995/dsh-plugins\\.git#[0-9a-f]{40}&path:packages/dsh-plugin-repo$`).test(forwarded)) throw new Error(`install 未按钉死 commit 的解析结果转发：${forwarded}`);
await repo.install("https://example.com/org/other.git", {});
if (manager.calls.length !== 2) throw new Error("spec 直传转发失败");

// 4) 未知目标应报错
let rejected = false;
try {
	await repo.resolve("no-such-plugin");
} catch (error) {
	rejected = error.code === "plugin-repo/unknown";
}
if (!rejected) throw new Error("未知目标未按预期报错");

// 5) 两种 API 风格：GitHub 走 api.github.com 与 contents，Gitea 走 <host>/api/v1 与 raw
{
	const { apiFlavorOf, apiBaseOf, buildCatalog } = await import("../lib/index.js");
	const ok = (label, condition) => { if (!condition) throw new Error(`flavor check failed: ${label}`); };
	const github = { gitHost: "https://github.com", owner: "o", repo: "r", branch: "main", catalogDir: "packages" };
	const gitea = { gitHost: "https://git.example.com", owner: "o", repo: "r", branch: "main", catalogDir: "packages" };
	ok("github 风格", apiFlavorOf(github) === "github");
	ok("gitea 风格", apiFlavorOf(gitea) === "gitea");
	ok("github 前缀", apiBaseOf(github) === "https://api.github.com");
	ok("gitea 前缀", apiBaseOf(gitea) === "https://git.example.com/api/v1");
	const paths = [];
	const request = async (config, path, options = {}) => {
		paths.push({ host: apiFlavorOf(config), path, text: Boolean(options.text) });
		if (path.includes("/contents/packages?")) return [{ name: "x", type: "dir" }];
		if (path.includes("/raw/")) return JSON.stringify({ name: "x", version: "1.0.0", description: "d" });
		return { encoding: "base64", content: Buffer.from(JSON.stringify({ name: "x", version: "1.0.0", description: "d" })).toString("base64") };
	};
	const ghEntries = await buildCatalog(github, request);
	ok("github 不请求 raw 端点", !paths.filter((p) => p.host === "github").some((p) => p.path.includes("/raw/")));
	paths.length = 0;
	const giteaEntries = await buildCatalog(gitea, request);
	ok("gitea 优先 raw 端点", paths.some((p) => p.path.includes("/raw/") && p.text));
	ok("两种风格条目一致", ghEntries.length === 1 && giteaEntries.length === 1 && ghEntries[0].version === giteaEntries[0].version);
	console.log("flavor checks ok");
}

// 6) 限流：403 + x-ratelimit-remaining:0 必须自解释为「填 token」，普通 403 不误判
{
	const { repoRequest, DEFAULT_CATALOG_TTL_MS } = await import("../lib/index.js");
	const ok = (label, condition) => { if (!condition) throw new Error(`rate-limit check failed: ${label}`); };
	const realFetch = globalThis.fetch;
	const config = { gitHost: "https://github.com", owner: "o", repo: "r" };
	try {
		globalThis.fetch = async () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
			status: 403,
			headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" }, // 2030-01-01T00:00:00Z
		});
		let limited;
		try { await repoRequest(config, "/repos/o/r/contents"); } catch (error) { limited = error; }
		ok("限额耗尽映射为 rate-limited", limited?.code === "plugin-repo/rate-limited");
		ok("提示给出 token 出路", /令牌|token/i.test(limited?.message ?? ""));
		ok("提示给出恢复时刻", /恢复/.test(limited?.message ?? ""));
		globalThis.fetch = async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "42" } });
		let plain;
		try { await repoRequest(config, "/repos/o/r/contents"); } catch (error) { plain = error; }
		ok("普通 403 仍按 http 报错", plain?.code === "plugin-repo/http");
	} finally {
		globalThis.fetch = realFetch;
	}
	ok("目录缓存 TTL 为正数", DEFAULT_CATALOG_TTL_MS > 0);
	console.log("rate-limit checks ok");
}

// 7) 目录缓存：重复打开面板不再重复计数（离线，桩 fetch）
{
	const ok = (label, condition) => { if (!condition) throw new Error(`cache check failed: ${label}`); };
	const realFetch = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async (url) => {
		calls += 1;
		const path = String(url);
		if (path.includes("/contents/packages?")) return new Response(JSON.stringify([{ name: "x", type: "dir" }]), { status: 200 });
		return new Response(JSON.stringify({ encoding: "base64", content: Buffer.from(JSON.stringify({ name: "x", version: "1.0.0" })).toString("base64") }), { status: 200 });
	};
	try {
		repo.catalogCache = null;
		const first = await repo.catalog();
		const afterCold = calls;
		const second = await repo.catalog();
		ok("冷加载发出请求", afterCold > 0);
		ok("命中缓存零请求", calls === afterCold);
		ok("两次返回同一结果", second === first);
		const refreshed = await repo.catalog({ refresh: true });
		ok("refresh 绕过缓存", calls > afterCold && refreshed !== first);
	} finally {
		globalThis.fetch = realFetch;
		repo.catalogCache = null;
	}
	console.log("cache checks ok");
}

console.log("SMOKE OK");
await root.fiber.dispose();
