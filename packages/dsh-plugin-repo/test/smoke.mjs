/**
 * dsh-plugin-repo 服务冒烟测试（脱离 DSH profile 独立运行）：
 * 用真实 cordis 起最小 Context，注入桩 pluginManager，验证
 * catalog / resolve / install 的完整链路。运行：
 *   node packages/dsh-plugin-repo/test/smoke.mjs
 */
import { Context, Service } from "@deepseek-ai/cordis";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { default: PluginRepoService } = await import(resolve(dirname(fileURLToPath(import.meta.url)), "../lib/index.js"));

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
}

const root = new Context();
await root.plugin(StubManager, {});
await root.plugin(PluginRepoService, {
	gitHost: "https://hub.ifunx.com",
	owner: "skyle1995",
	repo: "dsh-plugins",
	branch: "main",
	catalogDir: "packages",
	requestTimeoutMs: 15000,
});
const repo = root.get("pluginRepo");

// 1) 目录（真实 Gitea API）
const { source, entries } = await repo.catalog();
console.log("catalog:", source.gitUrl, "->", entries.length, "entries");
if (entries.length !== 1 || entries[0].name !== "dsh-plugin-repo") throw new Error("catalog 不符合预期");

// 2) resolve：包名 / 路径 / spec 三种输入
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
if (manager.calls[0]?.spec !== byName.spec) throw new Error("install 未按解析结果转发");
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

console.log("SMOKE OK");
await root.dispose?.();
