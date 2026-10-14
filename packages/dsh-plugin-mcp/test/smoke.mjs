/**
 * dsh-plugin-mcp 服务冒烟测试（脱离 DSH profile 独立运行）：
 * 用真实 cordis 起最小 Context，注入内存桩 loader，验证
 * 状态读写 / 配置校验 / 树投影（创建、更新、启停、删除）的完整链路。
 * 运行：node packages/dsh-plugin-mcp/test/smoke.mjs
 */
import { Context, Service } from "@deepseek-ai/cordis";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { default: McpManagerService, McpError, entryIdOf, normalizeServer, saveStateFile, loadStateFile, MCP_MODULE, MANAGED_ID_PREFIX, PRESETS, PLACEHOLDER_VALUES, PRESET_CATEGORIES, categoryOf } = await import(join(pkgDir, "lib/index.js"));

/** 记录条目并为服务提供 EntryTree 最小 API 的内存桩 loader。 */
class StubEntry {
	constructor(loader, options) {
		this.loader = loader;
		this.options = { ...options };
		this.disabled = options.disabled === true;
		this.fiber = { state: 2 };
		// 条目位于 include 子树：父组直接操作 loader 的 store。
		this.parent = {
			remove: (id) => {
				loader.store.delete(id);
				loader.events.push(["remove", id]);
			},
			tree: { write: () => loader.events.push(["write", "include"]) },
		};
	}
	async update(options) {
		Object.assign(this.options, options);
		this.disabled = options.disabled === true;
		this.loader.events.push(["update", { id: this.options.id, options }]);
	}
}

class StubLoader extends Service {
	constructor(ctx) {
		super(ctx, "loader");
		this.store = new Map();
		this.events = [];
	}
	// 桩一个 include 组条目，供 create(parent="include") 解析；其 subtree 即本 store。
	seedInclude() {
		const entry = new StubEntry(this, { id: "include", name: "cordis:include", config: { path: "file:///fake/profile/cordis.yml" } });
		entry.subgroup = { create: async (options) => this.createEntry(options), data: [] };
		this.store.set("include", entry);
	}
	createEntry(options) {
		const entry = new StubEntry(this, options);
		this.store.set(options.id, entry);
		this.events.push(["create", options]);
		return options.id;
	}
	entries() {
		return this.store.values();
	}
	resolve(id) {
		// 模拟 EntryTree.resolve：`include:<bare>` 走 include 子树（即本 store）。
		const bare = id.startsWith("include:") ? id.slice("include:".length) : id;
		const entry = this.store.get(bare);
		if (entry === undefined) throw new Error(`cannot resolve entry ${id}`);
		return entry;
	}
	async create(options, parent = null) {
		if (parent !== "include") throw new Error(`unexpected parent ${parent}`);
		return this.createEntry(options);
	}
}

const tempDir = mkdtempSync(join(tmpdir(), "dsh-plugin-mcp-smoke-"));
const stateFile = join(tempDir, "mcp-servers.json");

// 1) 配置校验：真实 mcp-client Config schema
{
	const { config, disabled, note } = normalizeServer({
		serverName: "github",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-github"],
		env: { GITHUB_TOKEN: "ghp_test" },
		disabled: true,
		note: "测试",
	});
	if (config.serverName !== "github" || config.transport !== "stdio" || config.toolCallTimeoutMs !== 60000) throw new Error("normalize 未套用 schema 默认值");
	if (!disabled || note !== "测试") throw new Error("管理字段剥离失败");
	console.log("normalize stdio:", JSON.stringify(config));
	const http = normalizeServer({ serverName: "web", transport: "streamable-http", url: "http://localhost:3000/mcp" }).config;
	if (http.url !== "http://localhost:3000/mcp") throw new Error("streamable-http 规范化失败");
	console.log("normalize http:", JSON.stringify(http));
	for (const bad of [
		{ serverName: "bad name", transport: "stdio", command: "x" },
		{ serverName: "ok", transport: "tcp", url: "x" },
		{ serverName: "ok", transport: "stdio" },
		{ serverName: "ok", transport: "streamable-http" },
	]) {
		let thrown = false;
		try {
			normalizeServer(bad);
		} catch (error) {
			thrown = error instanceof McpError && error.code.startsWith("mcp/invalid");
		}
		if (!thrown) throw new Error(`校验未拒绝非法配置：${JSON.stringify(bad)}`);
	}
	console.log("validation: 非法配置均被拒绝");
}

// 2) 状态文件读写（含坏文件保护）
{
	saveStateFile(stateFile, [{ serverName: "a", transport: "stdio", command: "x", disabled: false, note: "" }]);
	const loaded = loadStateFile(stateFile);
	if (loaded.corrupt !== null || loaded.servers.length !== 1) throw new Error("状态文件读写失败");
	if (loaded.servers[0].serverName !== "a") throw new Error("状态文件内容不符");
	console.log("state io: 读写正常");
}

// 3) 服务激活 + 投影：初始状态 → 树条目创建；save/update/enable/remove 全链路
{
	const root = new Context();
	await root.plugin(StubLoader, {});
	const loader = root.get("loader");
	loader.seedInclude();
	await root.plugin(McpManagerService, { stateFile });
	const manager = root.get("mcpManager");
	if (manager.stateFile !== stateFile) throw new Error("stateFile 未生效");

	// 初始状态里有一台「a」：激活后应投影出受管条目
	await manager.sync("smoke");
	const entryA = loader.resolve(entryIdOf("a"));
	if (entryA.options.name !== MCP_MODULE || entryA.options.config.serverName !== "a" || entryA.options.disabled !== false) throw new Error("初始投影失败");
	console.log("project: 初始条目已创建", entryIdOf("a"));

	// save 新增「b」（stdio）
	await manager.saveServer({ serverName: "b", transport: "stdio", command: "echo", args: ["hi"] });
	const entryB = loader.resolve(entryIdOf("b"));
	if (entryB.options.config.command !== "echo" || entryB.options.disabled !== false) throw new Error("save 后条目未创建");

	// update「b」→ 改 transport 为 streamable-http
	await manager.saveServer({ serverName: "b", transport: "streamable-http", url: "http://localhost:9/mcp" });
	const entryB2 = loader.resolve(entryIdOf("b"));
	if (entryB2.options.config.transport !== "streamable-http" || entryB2.options.config.url !== "http://localhost:9/mcp") throw new Error("update 未生效");

	// enable 切换
	await manager.setEnabled("b", false);
	const entryB3 = loader.resolve(entryIdOf("b"));
	if (entryB3.options.disabled !== true) throw new Error("停用未生效");
	await manager.setEnabled("b", true);

	// remove「a」
	await manager.removeServer("a");
	let removed = false;
	try {
		loader.resolve(entryIdOf("a"));
	} catch {
		removed = true;
	}
	if (!removed) throw new Error("remove 后条目仍在树上");
	console.log("project: save/update/enable/remove 全链路正常");

	// snapshot：受管列表 + 手工条目只读
	const snap = manager.snapshot();
	if (snap.servers.length !== 1 || snap.servers[0].serverName !== "b" || snap.servers[0].status !== "active") throw new Error("snapshot 受管列表不符");
	if (snap.servers[0].config.url !== "http://localhost:9/mcp") throw new Error("snapshot 配置缺失");
	console.log("snapshot:", JSON.stringify(snap.servers));

	// 手工条目（非受管前缀）出现在 manual 且不与受管冲突
	loader.createEntry({ id: "mcp-github", name: MCP_MODULE, config: { serverName: "github", transport: "stdio", command: "npx" }, disabled: false });
	const snap2 = manager.snapshot();
	if (snap2.manual.length !== 1 || snap2.manual[0].id !== "mcp-github") throw new Error("手工条目未列入 manual");
	console.log("manual entries:", JSON.stringify(snap2.manual));

	// serverName 与手工条目冲突 → 拒绝保存
	let conflicted = false;
	try {
		await manager.saveServer({ serverName: "github", transport: "stdio", command: "x" });
	} catch (error) {
		conflicted = error.code === "mcp/name-conflict";
	}
	if (!conflicted) throw new Error("serverName 冲突未拦截");
	console.log("name-conflict: 已拦截");

	// 掩码：env 值不出现在列表快照
	await manager.saveServer({ serverName: "c", transport: "stdio", command: "x", env: { TOKEN: "secret" } });
	const snap3 = manager.snapshot();
	const serverC = snap3.servers.find((server) => server.serverName === "c");
	if (serverC.config.env.TOKEN === "secret") throw new Error("env 未掩码");
	console.log("mask: env 值已掩码");

	// 预设：目录非空、零配置预设可一键保存、占位值被拦截、added 状态正确
	if (PRESETS.length < 10) throw new Error("预设目录过少");
	if (!PRESETS.some((preset) => preset.id === "github" && (preset.inputs ?? []).length > 0)) throw new Error("github 预设应带 inputs");
	if (!PRESETS.some((preset) => preset.id === "memory" && (preset.inputs ?? []).length === 0)) throw new Error("memory 预设应为零配置");
	// 新增预设：按官方文档的启动方式校验
	if (PRESETS.length < 30) throw new Error(`预设数量不足：${PRESETS.length}`);
	const gitea = PRESETS.find((preset) => preset.id === "gitea");
	if (!gitea || gitea.server.command !== "docker" || !(gitea.inputs ?? []).includes("env.GITEA_ACCESS_TOKEN") || !PLACEHOLDER_VALUES.has(gitea.server.env.GITEA_HOST)) throw new Error("gitea 预设不符");
	const x64dbg = PRESETS.find((preset) => preset.id === "x64dbg");
	if (!x64dbg || !x64dbg.server.args.includes("x64dbg-mcp") || categoryOf("x64dbg") !== "reversing") throw new Error("x64dbg 预设不符");
	const cyberchef = PRESETS.find((preset) => preset.id === "cyberchef");
	if (!cyberchef || !cyberchef.server.args.includes("cyberchef-mcp") || categoryOf("cyberchef") !== "reversing") throw new Error("cyberchef 预设不符");
	const playwright = PRESETS.find((preset) => preset.id === "playwright");
	if (!playwright || !playwright.server.args.some((arg) => arg.startsWith("@playwright/mcp")) || categoryOf("playwright") !== "browser") throw new Error("playwright 预设不符");
	const chromeDev = PRESETS.find((preset) => preset.id === "chrome-devtools");
	if (!chromeDev || !chromeDev.server.args.some((arg) => arg.startsWith("chrome-devtools-mcp")) || categoryOf("chrome-devtools") !== "browser") throw new Error("chrome-devtools 预设不符");
	const k8s = PRESETS.find((preset) => preset.id === "kubernetes");
	if (!k8s || categoryOf("kubernetes") !== "cloud") throw new Error("kubernetes 预设不符");
	const context7 = PRESETS.find((preset) => preset.id === "context7");
	if (!context7 || categoryOf("context7") !== "intel") throw new Error("context7 预设不符");
	if (categoryOf("gitlab") !== "git" || categoryOf("gitea") !== "git") throw new Error("代码托管分类不符");
	if (categoryOf("tavily") !== "intel" || categoryOf("urlscan") !== "intel") throw new Error("搜索/情报分类不符");
	if (categoryOf("cloudflare") !== "cloud" || categoryOf("supabase") !== "cloud") throw new Error("云服务分类不符");
	// 逆向 / 安全预设：按官方文档的启动方式校验
	const reqable = PRESETS.find((preset) => preset.id === "reqable");
	if (!reqable || (reqable.inputs ?? []).length !== 0 || reqable.server.command !== "npx" || !reqable.server.args.includes("reqable-mcp-server")) throw new Error("reqable 预设不符");
	const ida = PRESETS.find((preset) => preset.id === "ida-pro");
	if (!ida || ida.server.command !== "uvx" || !ida.server.args.includes("ida-mcp")) throw new Error("ida 预设不符");
	const ghidra = PRESETS.find((preset) => preset.id === "ghidra");
	if (!ghidra || ghidra.server.command !== "uvx" || !ghidra.server.args.includes("ghidra-mcp")) throw new Error("ghidra 预设不符");
	const binja = PRESETS.find((preset) => preset.id === "binary-ninja");
	if (!binja || !binja.server.args.includes("binary-ninja-mcp")) throw new Error("binary-ninja 预设不符");
	const frida = PRESETS.find((preset) => preset.id === "frida");
	if (!frida || !frida.server.args.includes("frida-mcp-server")) throw new Error("frida 预设不符");
	const jadx = PRESETS.find((preset) => preset.id === "jadx");
	if (!jadx || !(jadx.inputs ?? []).includes("args[1]") || !PLACEHOLDER_VALUES.has(jadx.server.args[1])) throw new Error("jadx 预设占位不符");
	const vt = PRESETS.find((preset) => preset.id === "virustotal");
	if (!vt || !(vt.inputs ?? []).includes("env.VTAI_TOKEN_FILE") || !PLACEHOLDER_VALUES.has(vt.server.env.VTAI_TOKEN_FILE)) throw new Error("virustotal 预设占位不符");
	if (PLACEHOLDER_VALUES.size === 0) throw new Error("占位值集合为空");
	// 普通参数值（如 -y、包名）不能进占位值集合
	if (PLACEHOLDER_VALUES.has("-y")) throw new Error("普通参数被误判为占位值");
	const bravePreset = PRESETS.find((preset) => preset.id === "brave-search");
	// 带占位值的配置不能直接保存
	let placeholderBlocked = false;
	try {
		await manager.saveServer(bravePreset.server);
	} catch (error) {
		placeholderBlocked = error.code === "mcp/placeholder" && error.message.includes("BRAVE_API_KEY");
	}
	if (!placeholderBlocked) throw new Error("占位值未被拦截");
	// 替换成真实值后可保存
	await manager.saveServer({
		...bravePreset.server,
		env: { BRAVE_API_KEY: "BSA_real" },
	});
	console.log("presets: 占位拦截 + 替换后可保存");
	// 分类：每个预设都有归属分类，且分类声明恰好覆盖全部预设
	const categoryIds = new Set(PRESET_CATEGORIES.map((category) => category.presetIds).flat());
	for (const preset of PRESETS) {
		const category = categoryOf(preset.id);
		if (!PRESET_CATEGORIES.some((item) => item.id === category)) throw new Error(`预设 ${preset.id} 分类缺失`);
	}
	const presetIds = new Set(PRESETS.map((preset) => preset.id));
	for (const id of categoryIds) {
		if (!presetIds.has(id)) throw new Error(`分类引用了不存在的预设 ${id}`);
	}
	const reqableView = manager.presetsView().find((preset) => preset.id === "reqable");
	const githubView2 = manager.presetsView().find((preset) => preset.id === "github");
	if (categoryOf("reqable") !== "reversing" || categoryOf("github") !== "dev") throw new Error("预设分类映射错误");
	if (reqableView.category !== "reversing" || githubView2.category !== "dev") throw new Error("presetsView 未附带分类");
	console.log("categories: 分类覆盖全部预设，映射正确");

	const presetsView = manager.presetsView();
	const braveView = presetsView.find((preset) => preset.id === "brave-search");
	if (braveView.added !== true) throw new Error("已保存的预设应标记 added");
	const memoryView = presetsView.find((preset) => preset.id === "memory");
	if (memoryView.added !== false) throw new Error("未保存的预设不应标记 added");
	// 手工同名的 github 预设也应标记 added（防止重复添加）
	const githubView = presetsView.find((preset) => preset.id === "github");
	if (githubView.added !== true) throw new Error("手工同名的预设应标记 added");
	console.log("presetsView:", `${presetsView.length} 个预设`, "brave.added =", braveView.added, "github.added =", githubView.added, "memory.added =", memoryView.added);

	// 持久化校验：状态文件里应是 3 台（b、c、brave-search）
	const loaded = loadStateFile(stateFile);
	if (loaded.servers.length !== 3) throw new Error(`持久化数量不符：${loaded.servers.length}`);
	console.log("persist: 状态文件同步", loaded.servers.map((server) => server.serverName).join(","));
}

rmSync(tempDir, { recursive: true, force: true });
console.log("dsh-plugin-mcp smoke: ALL PASSED");
