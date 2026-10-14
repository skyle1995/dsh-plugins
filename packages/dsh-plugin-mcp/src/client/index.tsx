/**
 * dsh-plugin-mcp 浏览器半区：设置面板里的「MCP 服务器」分区。
 *
 * 增删改 / 启停全部通过宿主半区注册的同源 HTTP 路由完成：
 * - GET  /api/dsh-plugin-mcp/servers    列表（受管 + 手工条目）
 * - POST /api/dsh-plugin-mcp/operation  { operation: save|remove|enable|detail }
 *
 * 浏览器侧不依赖 ctx.remote，渲染只依赖框架注入的 t 与本地 fetch。
 */
import { createElement as h, Fragment, useEffect, useState } from "react";

const NS = "dsh-plugin-mcp";
const API = "/api/dsh-plugin-mcp";

const zh = {
	title: "MCP 服务器",
	description: "管理模型可用的外部 MCP 服务器：新增、编辑、启停与删除（基于内置 MCP 客户端桥接）。",
	managed: "已管理",
	manual: "cordis.patch.yml 手工配置（只读）",
	manualHint: "以下条目直接写在 profile 的 cordis.patch.yml 中，请到配置文件里修改。",
	presets: "热门预设",
	presetsHint: "一键添加常用 MCP 服务器；需要密钥 / 路径的会先填入表单，补全后再保存。",
	presetAdd: "一键添加",
	presetAdded: "已添加",
	presetNeeds: "需填写：{keys}",
	presetPrefilled: "已把预设「{name}」填入表单，请补全 {keys} 后保存。",
	presetAddOk: "「{name}」已添加。",
	tabInstalled: "已安装",
	tabPresets: "预设",
	searchPlaceholder: "搜索预设…",
	catAll: "全部",
	catOther: "其他",
	presetEmpty: "没有匹配的预设。",
	add: "添加服务器",
	edit: "编辑",
	editTitle: "编辑服务器：{name}",
	save: "保存",
	cancel: "取消",
	refresh: "刷新",
	loading: "正在加载…",
	empty: "还没有配置 MCP 服务器，到「预设」页一键添加。",
	loadError: "读取列表失败：{message}",
	stateFile: "状态文件：{file}",
	corrupt: "状态文件损坏：{message}",
	enable: "启用",
	disable: "停用",
	remove: "删除",
	removeConfirm: "确定删除服务器「{name}」吗？其工具将立即从模型可用工具中移除。",
	saveOk: "「{name}」已保存。",
	removeOk: "「{name}」已删除。",
	toggleOk: "「{name}」已{state}。",
	opFailed: "操作失败：{message}",
	nameLabel: "服务器名（serverName）",
	nameHint: "工具将以 mcp__{name}__<tool> 形式暴露给模型；[A-Za-z0-9_-]{1,32}",
	transportLabel: "传输方式",
	stdio: "stdio（本地进程）",
	http: "streamable-http（远程服务）",
	commandLabel: "命令",
	commandHint: "启动服务器的可执行文件，如 npx",
	argsLabel: "参数（JSON 数组）",
	argsHint: "如 [\"-y\", \"@modelcontextprotocol/server-github\"]",
	envLabel: "环境变量（JSON 对象）",
	envHint: "如 {\"GITHUB_TOKEN\": \"ghp_xxx\"}；注意会明文保存在状态文件中",
	cwdLabel: "工作目录",
	urlLabel: "端点 URL",
	urlHint: "如 http://localhost:3000/mcp",
	headersLabel: "请求标头（JSON 对象）",
	headersHint: "如 {\"Authorization\": \"Bearer ...\"}",
	noteLabel: "备注",
	noteHint: "仅供面板展示，不影响配置",
	jsonError: "{label}不是合法 JSON：{message}",
	invalidName: "服务器名必须匹配 [A-Za-z0-9_-]{1,32}",
	commandRequired: "stdio 模式需要填写命令",
	urlRequired: "streamable-http 模式需要填写 URL",
	statusActive: "已连接",
	statusFailed: "连接失败",
	statusStopped: "已停止",
	statusDisabled: "已停用",
	statusStarting: "连接中",
	statusPending: "待创建",
	statusConflict: "id 冲突",
	managedBadge: "受管",
	manualBadge: "手工",
};

const en = {
	title: "MCP Servers",
	description: "Manage external MCP servers available to the model: add, edit, enable, disable, and remove (built on the bundled MCP client bridge).",
	managed: "Managed",
	manual: "Configured in cordis.patch.yml (read-only)",
	manualHint: "These entries are written directly in the profile's cordis.patch.yml; edit them in the config file.",
	presets: "Popular presets",
	presetsHint: "One-click add common MCP servers; those needing keys/paths prefill the form for you to complete.",
	presetAdd: "Add",
	presetAdded: "Added",
	presetNeeds: "Needs: {keys}",
	presetPrefilled: "Preset “{name}” loaded into the form; fill in {keys} and save.",
	presetAddOk: "“{name}” added.",
	tabInstalled: "Installed",
	tabPresets: "Presets",
	searchPlaceholder: "Search presets…",
	catAll: "All",
	catOther: "Other",
	presetEmpty: "No matching presets.",
	add: "Add server",
	edit: "Edit",
	editTitle: "Edit server: {name}",
	save: "Save",
	cancel: "Cancel",
	refresh: "Refresh",
	loading: "Loading…",
	empty: "No MCP servers configured yet; add one from the Presets tab.",
	loadError: "Failed to load the list: {message}",
	stateFile: "State file: {file}",
	corrupt: "State file is corrupt: {message}",
	enable: "Enable",
	disable: "Disable",
	remove: "Remove",
	removeConfirm: "Remove server “{name}”? Its tools will be removed from the model immediately.",
	saveOk: "“{name}” saved.",
	removeOk: "“{name}” removed.",
	toggleOk: "“{name}” is now {state}.",
	opFailed: "Operation failed: {message}",
	nameLabel: "Server name (serverName)",
	nameHint: "Tools are exposed as mcp__{name}__<tool>; [A-Za-z0-9_-]{1,32}",
	transportLabel: "Transport",
	stdio: "stdio (local process)",
	http: "streamable-http (remote)",
	commandLabel: "Command",
	commandHint: "Executable that starts the server, e.g. npx",
	argsLabel: "Arguments (JSON array)",
	argsHint: "e.g. [\"-y\", \"@modelcontextprotocol/server-github\"]",
	envLabel: "Environment variables (JSON object)",
	envHint: "e.g. {\"GITHUB_TOKEN\": \"ghp_xxx\"}; stored in plain text in the state file",
	cwdLabel: "Working directory",
	urlLabel: "Endpoint URL",
	urlHint: "e.g. http://localhost:3000/mcp",
	headersLabel: "Headers (JSON object)",
	headersHint: "e.g. {\"Authorization\": \"Bearer ...\"}",
	noteLabel: "Note",
	noteHint: "Panel display only; does not affect the config",
	jsonError: "{label} is not valid JSON: {message}",
	invalidName: "Server name must match [A-Za-z0-9_-]{1,32}",
	commandRequired: "stdio requires a command",
	urlRequired: "streamable-http requires a URL",
	statusActive: "Connected",
	statusFailed: "Connection failed",
	statusStopped: "Stopped",
	statusDisabled: "Disabled",
	statusStarting: "Connecting",
	statusPending: "Pending",
	statusConflict: "Id conflict",
	managedBadge: "managed",
	manualBadge: "manual",
};

/** 极简文案翻译：{name} 占位替换。 */
function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

/** 与宿主路由通信的极简 JSON 客户端。 */
async function api(path, options) {
	const response = await fetch(`${API}${path}`, {
		headers: { "content-type": "application/json", accept: "application/json" },
		...options,
	});
	const payload = await response.json().catch(() => ({ ok: false, message: `HTTP ${response.status}` }));
	if (!response.ok || payload.ok !== true) {
		const error = new Error(payload.message ?? `HTTP ${response.status}`);
		error.code = payload.code;
		throw error;
	}
	return payload;
}

/** 空表单初值。 */
function emptyForm() {
	return {
		serverName: "",
		transport: "stdio",
		command: "",
		argsText: "",
		envText: "",
		cwd: "",
		url: "",
		headersText: "",
		note: "",
	};
}

/** 编辑预填：由 detail 接口返回的完整配置转成表单形态。 */
function formOf(server) {
	return {
		serverName: server.serverName ?? "",
		transport: server.transport ?? "stdio",
		command: server.command ?? "",
		argsText: Array.isArray(server.args) && server.args.length > 0 ? JSON.stringify(server.args, null, 2) : "",
		envText: server.env && typeof server.env === "object" && Object.keys(server.env).length > 0 ? JSON.stringify(server.env, null, 2) : "",
		cwd: server.cwd ?? "",
		url: server.url ?? "",
		headersText: server.headers && typeof server.headers === "object" && Object.keys(server.headers).length > 0 ? JSON.stringify(server.headers, null, 2) : "",
		note: server.note ?? "",
	};
}

/** 解析可空的 JSON 文本（数组或对象）。 */
function parseJson(text, label, t) {
	const trimmed = (text ?? "").trim();
	if (trimmed === "") return undefined;
	try {
		return JSON.parse(trimmed);
	} catch (error) {
		throw new Error(format(t("jsonError"), { label, message: error.message }));
	}
}

/** 预设必填字段路径的可读形式："env.GITHUB_TOKEN" → "GITHUB_TOKEN"、"args[2]" → "参数"。 */
function inputsLabel(inputs) {
	return inputs.map((path) => (path.startsWith("env.") ? path.slice(4) : path.startsWith("args[") ? "参数" : path)).join("、");
}

const css = `
.dmc-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dmc-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dmc-title{margin:0;font-size:16px;font-weight:600}
.dmc-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dmc-meta{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.dmc-toolbar{flex-shrink:0;display:flex;align-items:center;gap:8px}
.dmc-btn{white-space:nowrap;appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dmc-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dmc-btn:disabled{opacity:.5;cursor:default}
.dmc-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dmc-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dmc-list{display:flex;flex-direction:column;gap:8px}
.dmc-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dmc-info{flex:1;min-width:0}
.dmc-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dmc-note{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere}
.dmc-badges{display:flex;gap:6px;flex-wrap:wrap}
.dmc-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dmc-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dmc-badge-warn{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dmc-badge-err{color:var(--dsw-alias-state-error-primary,#d33);border-color:currentColor}
.dmc-actions{flex-shrink:0;display:flex;gap:8px;align-items:center}
.dmc-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dmc-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dmc-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
.dmc-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dmc-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dmc-field-wide{grid-column:1 / -1}
.dmc-label{font-size:13px;color:var(--dsw-alias-label-primary,#222)}
.dmc-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);line-height:1.5}
.dmc-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:5px 10px;font-size:13px;line-height:20px;min-width:0;width:100%}
.dmc-input:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dmc-textarea{resize:vertical;min-height:64px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dmc-select{appearance:auto;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:5px 10px;font-size:13px;line-height:20px;min-width:0;width:100%}
.dmc-form-actions{display:flex;gap:8px;justify-content:flex-end}
.dmc-section-label{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
.dmc-chiprow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dmc-chip{appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#555);font:inherit;font-size:12px;line-height:1.6;border-radius:999px;padding:2px 12px;cursor:pointer}
.dmc-chip:hover{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dmc-chip-on{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b6ef5) 12%,transparent);border-color:var(--dsw-alias-state-business-primary,#3b6ef5);color:var(--dsw-alias-state-business-primary,#3b6ef5);font-weight:600}
.dmc-search{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:4px 10px;font-size:13px;line-height:20px;min-width:180px;flex:1;max-width:280px}
.dmc-search:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dmc-search-row{display:flex}
.dmc-search-row .dmc-search{flex:1;max-width:100%}
.dmc-preset-group{margin-top:6px}
.dmc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;z-index:1000;overflow:auto;padding:48px 16px}
.dmc-modal{box-sizing:border-box;width:100%;max-width:640px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:12px}
.dmc-modal-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 16px 0}
.dmc-modal-title{margin:0;font-size:15px;font-weight:600}
.dmc-modal-body{padding:0 16px 16px}
.dmc-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l3,#ddd);margin-bottom:4px}
.dmc-tab{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#777);font:inherit;font-size:13px;line-height:1.6;padding:6px 12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.dmc-tab:hover{color:var(--dsw-alias-label-primary,#222)}
.dmc-tab-on{color:var(--dsw-alias-state-business-primary,#3b6ef5);border-bottom-color:var(--dsw-alias-state-business-primary,#3b6ef5);font-weight:600}
.dmc-presets{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dmc-preset{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:10px 12px;min-width:0}
.dmc-preset-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.dmc-preset-name{font-size:13px;font-weight:600}
.dmc-preset-desc{margin:0;color:var(--dsw-alias-label-secondary,#555);font-size:12px;line-height:1.5;overflow-wrap:anywhere}
.dmc-preset-foot{display:flex;justify-content:flex-end}
@media (max-width:640px){.dmc-form-grid{grid-template-columns:1fr}.dmc-presets{grid-template-columns:1fr}}
`;

/** 设置分区组件：props 由 slot 框架提供 t（按 NS 绑定）。 */
function McpSection({ t }) {
	const [data, setData] = useState({ status: "loading", servers: [], manual: [], presets: [], categories: [], stateFile: null, corrupt: null });
	const [notice, setNotice] = useState(null);
	const [busy, setBusy] = useState({});
	const [busyPreset, setBusyPreset] = useState({});
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState(null);
	const [formError, setFormError] = useState(null);
	/** 显式选择的标签页；null = 未手动选择（有已安装时默认「已安装」，否则「预设」）。 */
	const [tab, setTab] = useState(null);
	/** 预设搜索词与分类筛选（null = 全部）。 */
	const [presetQuery, setPresetQuery] = useState("");
	const [presetCategory, setPresetCategory] = useState(null);

	/** 当前界面语言：按 t 输出与英文词典比对（预设描述 / 分类标签按语言显示）。 */
	const lang = t("title") === en.title ? "en" : "zh";

	/** 把接口快照写入列表状态（保存/启停/删除后免一次刷新）。 */
	function applySnapshot(payload) {
		setData((previous) => ({
			...previous,
			status: "ok",
			servers: payload.servers ?? [],
			manual: payload.manual ?? [],
			presets: payload.presets ?? previous.presets ?? [],
			categories: payload.categories ?? previous.categories ?? [],
			stateFile: payload.stateFile ?? previous.stateFile,
			corrupt: payload.corrupt ?? null,
		}));
	}

	async function refresh() {
		setData((previous) => ({ ...previous, status: "loading" }));
		try {
			const payload = await api("/servers");
			setData({ status: "ok", servers: payload.servers ?? [], manual: payload.manual ?? [], presets: payload.presets ?? [], categories: payload.categories ?? [], stateFile: payload.stateFile ?? null, corrupt: payload.corrupt ?? null });
		} catch (error) {
			setData({ status: "error", servers: [], manual: [], presets: [], categories: [], stateFile: null, corrupt: null, message: error.message });
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	function renderNotice() {
		if (notice === null) return null;
		return h("p", { className: `dmc-notice ${notice.kind === "error" ? "dmc-notice-err" : "dmc-notice-ok"}` }, notice.text);
	}

	function statusBadge(status) {
		const key = status === "active" ? "statusActive"
			: status === "failed" ? "statusFailed"
				: status === "stopped" ? "statusStopped"
					: status === "disabled" ? "statusDisabled"
						: status === "starting" ? "statusStarting"
							: status === "pending" ? "statusPending"
								: status === "conflict" ? "statusConflict" : null;
		if (key === null) return null;
		const kind = status === "active" ? "on" : status === "failed" || status === "conflict" ? "err" : "warn";
		return h("span", { key: "status", className: `dmc-badge ${kind === "on" ? "dmc-badge-on" : kind === "err" ? "dmc-badge-err" : "dmc-badge-warn"}` }, t(key));
	}

	/** 预设一键添加：需要补全的先预填表单，零配置的直接保存。 */
	async function addPreset(preset) {
		setNotice(null);
		const inputs = preset.inputs ?? [];
		if (inputs.length > 0) {
			setForm(formOf(preset.server));
			setEditing(null);
			setFormError(null);
			setNotice({ kind: "ok", text: format(t("presetPrefilled"), { name: preset.name, keys: inputsLabel(inputs) }) });
			return;
		}
		setBusyPreset((previous) => ({ ...previous, [preset.id]: true }));
		try {
			const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "save", server: preset.server }) });
			applySnapshot(payload);
			setTab("installed");
			setNotice({ kind: "ok", text: format(t("presetAddOk"), { name: preset.name }) });
		} catch (error) {
			setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
		} finally {
			setBusyPreset((previous) => {
				const next = { ...previous };
				delete next[preset.id];
				return next;
			});
		}
	}

	function renderPresetCard(preset) {
		const description = preset.description?.[lang] ?? preset.description?.zh ?? "";
		const inputs = preset.inputs ?? [];
		const added = preset.added === true;
		const presetBusy = busyPreset[preset.id] === true;
		const badges = [];
		if (inputs.length > 0) badges.push(h("span", { key: "needs", className: "dmc-badge dmc-badge-warn" }, format(t("presetNeeds"), { keys: inputsLabel(inputs) })));
		badges.push(h("span", { key: "transport", className: "dmc-badge" }, preset.server?.transport ?? "stdio"));
		if (added) badges.push(h("span", { key: "added", className: "dmc-badge dmc-badge-on" }, t("presetAdded")));
		return h("div", { key: preset.id, className: "dmc-preset" },
			h("div", { className: "dmc-preset-head" },
				h("span", { className: "dmc-preset-name" }, preset.name),
				h("div", { className: "dmc-badges" }, badges)),
			description ? h("p", { className: "dmc-preset-desc" }, description) : null,
			h("div", { className: "dmc-preset-foot" },
				h("button", {
					className: `dmc-btn ${added ? "" : "dmc-btn-primary"}`,
					disabled: added || presetBusy,
					onClick: () => void addPreset(preset),
				}, added ? t("presetAdded") : presetBusy ? t("loading") : t("presetAdd"))));
	}

	/** 分类 id → 显示名（未知分类归入「其他」）。 */
	function categoryLabel(id) {
		const category = data.categories.find((item) => item.id === id);
		if (category !== undefined) return category[lang] ?? category.id;
		return id === "other" ? t("catOther") : id;
	}

	/** 按分类 + 搜索词过滤后的预设（保持目录顺序，按分类分组）。 */
	function filteredPresets() {
		const query = presetQuery.trim().toLowerCase();
		const matches = (preset) => {
			if (presetCategory !== null && preset.category !== presetCategory) return false;
			if (query === "") return true;
			const haystack = `${preset.name} ${preset.description?.[lang] ?? ""} ${preset.description?.zh ?? ""} ${preset.server?.serverName ?? ""}`.toLowerCase();
			return haystack.includes(query);
		};
		const filtered = data.presets.filter(matches);
		const groups = [];
		for (const category of data.categories) {
			const items = filtered.filter((preset) => preset.category === category.id);
			if (items.length > 0) groups.push({ id: category.id, items });
		}
		const others = filtered.filter((preset) => !data.categories.some((category) => category.id === preset.category));
		if (others.length > 0) groups.push({ id: "other", items: others });
		return groups;
	}

	async function toggle(server) {
		setBusy((previous) => ({ ...previous, [server.serverName]: "toggle" }));
		setNotice(null);
		try {
			const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "enable", serverName: server.serverName, enabled: server.disabled }) });
			applySnapshot(payload);
			setNotice({ kind: "ok", text: format(t("toggleOk"), { name: server.serverName, state: server.disabled ? t("enable") : t("disable") }) });
		} catch (error) {
			setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
		} finally {
			setBusy((previous) => {
				const next = { ...previous };
				delete next[server.serverName];
				return next;
			});
		}
	}

	async function startEdit(serverName) {
		setFormError(null);
		setNotice(null);
		try {
			const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "detail", serverName }) });
			setForm(formOf(payload.server));
			setEditing(serverName);
		} catch (error) {
			setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
		}
	}

	function startAdd() {
		setFormError(null);
		setNotice(null);
		setForm(emptyForm());
		setEditing(null);
	}

	function updateField(key, value) {
		setForm((previous) => ({ ...previous, [key]: value }));
	}

	function buildServerPayload() {
		const name = (form.serverName ?? "").trim();
		if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) throw new Error(t("invalidName"));
		const args = parseJson(form.argsText, t("argsLabel"), t);
		const env = parseJson(form.envText, t("envLabel"), t);
		const headers = parseJson(form.headersText, t("headersLabel"), t);
		const server = { serverName: name, transport: form.transport, note: form.note };
		if (form.transport === "stdio") {
			if ((form.command ?? "").trim() === "") throw new Error(t("commandRequired"));
			server.command = form.command.trim();
			if (args !== undefined) server.args = args;
			if (env !== undefined) server.env = env;
			if ((form.cwd ?? "").trim() !== "") server.cwd = form.cwd.trim();
		} else {
			if ((form.url ?? "").trim() === "") throw new Error(t("urlRequired"));
			server.url = form.url.trim();
			if (headers !== undefined) server.headers = headers;
		}
		return server;
	}

	async function saveForm() {
		setFormError(null);
		let server;
		try {
			server = buildServerPayload();
		} catch (error) {
			setFormError(error.message);
			return;
		}
		setNotice(null);
		try {
			const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "save", server }) });
			applySnapshot(payload);
			setForm(null);
			setEditing(null);
			setNotice({ kind: "ok", text: format(t("saveOk"), { name: server.serverName }) });
		} catch (error) {
			setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
		}
	}

	async function removeServer(server) {
		if (!globalThis.confirm(format(t("removeConfirm"), { name: server.serverName }))) return;
		setBusy((previous) => ({ ...previous, [server.serverName]: "remove" }));
		setNotice(null);
		try {
			const payload = await api("/operation", { method: "POST", body: JSON.stringify({ operation: "remove", serverName: server.serverName }) });
			applySnapshot(payload);
			setNotice({ kind: "ok", text: format(t("removeOk"), { name: server.serverName }) });
		} catch (error) {
			setNotice({ kind: "error", text: format(t("opFailed"), { message: error.message }) });
		} finally {
			setBusy((previous) => {
				const next = { ...previous };
				delete next[server.serverName];
				return next;
			});
		}
	}

	function renderServerRow(server) {
		const rowBusy = busy[server.serverName];
		const badges = [
			statusBadge(server.status),
			h("span", { key: "transport", className: "dmc-badge" }, server.transport),
			h("span", { key: "managed", className: "dmc-badge dmc-badge-on" }, t("managedBadge")),
		].filter(Boolean);
		const actions = [];
		if (rowBusy !== undefined) {
			actions.push(h("button", { key: "busy", className: "dmc-btn", disabled: true }, t("loading")));
		} else {
			actions.push(h("button", { key: "toggle", className: "dmc-btn", onClick: () => void toggle(server) }, server.disabled ? t("enable") : t("disable")));
			actions.push(h("button", { key: "edit", className: "dmc-btn", onClick: () => void startEdit(server.serverName) }, t("edit")));
			actions.push(h("button", { key: "remove", className: "dmc-btn dmc-btn-danger", onClick: () => void removeServer(server) }, t("remove")));
		}
		return h("div", { key: server.id, className: "dmc-row" },
			h("div", { className: "dmc-info" },
				h("div", { className: "dmc-name" },
					h("span", null, server.serverName),
					h("div", { className: "dmc-badges" }, badges)),
				server.conflictWith !== null ? h("p", { className: "dmc-note" }, format(t("loadError"), { message: `id ${server.id} 已被 ${server.conflictWith} 占用` })) : null,
				server.note ? h("p", { className: "dmc-note" }, server.note) : null),
			h("div", { className: "dmc-actions" }, actions));
	}

	/** 添加 / 编辑弹窗（遮罩 + 居中面板；Esc 或点遮罩关闭）。 */
	function renderFormModal() {
		const isEdit = editing !== null;
		return h("div", {
			className: "dmc-modal-backdrop",
			onClick: (event) => {
				if (event.target === event.currentTarget) setForm(null);
			},
		},
		h("div", { className: "dmc-modal" },
			h("div", { className: "dmc-modal-head" },
				h("h2", { className: "dmc-modal-title" }, isEdit ? format(t("editTitle"), { name: editing }) : t("add")),
				h("button", { className: "dmc-btn", onClick: () => setForm(null) }, "✕")),
			h("div", { className: "dmc-modal-body" },
				h("div", { className: "dmc-form-grid" },
					h("label", { className: "dmc-field" },
						h("span", { className: "dmc-label" }, t("nameLabel")),
						h("input", { className: "dmc-input", value: form.serverName, disabled: isEdit, placeholder: "github", onChange: (event) => updateField("serverName", event.target.value) }),
						h("span", { className: "dmc-hint" }, t("nameHint"))),
					h("label", { className: "dmc-field" },
						h("span", { className: "dmc-label" }, t("transportLabel")),
						h("select", { className: "dmc-select", value: form.transport, onChange: (event) => updateField("transport", event.target.value) },
							h("option", { value: "stdio" }, t("stdio")),
							h("option", { value: "streamable-http" }, t("http"))),
						h("span", { className: "dmc-hint" }, form.transport === "stdio" ? t("stdio") : t("http"))),
					form.transport === "stdio"
						? h(Fragment, { key: "stdio" },
							h("label", { className: "dmc-field" },
								h("span", { className: "dmc-label" }, t("commandLabel")),
								h("input", { className: "dmc-input", value: form.command, placeholder: "npx", onChange: (event) => updateField("command", event.target.value) }),
								h("span", { className: "dmc-hint" }, t("commandHint"))),
							h("label", { className: "dmc-field" },
								h("span", { className: "dmc-label" }, t("argsLabel")),
								h("textarea", { className: "dmc-input dmc-textarea", value: form.argsText, placeholder: "[\"-y\", \"@modelcontextprotocol/server-github\"]", onChange: (event) => updateField("argsText", event.target.value) }),
								h("span", { className: "dmc-hint" }, t("argsHint"))),
							h("label", { className: "dmc-field dmc-field-wide" },
								h("span", { className: "dmc-label" }, t("envLabel")),
								h("textarea", { className: "dmc-input dmc-textarea", value: form.envText, placeholder: "{\"GITHUB_TOKEN\": \"ghp_xxx\"}", onChange: (event) => updateField("envText", event.target.value) }),
								h("span", { className: "dmc-hint" }, t("envHint"))),
							h("label", { className: "dmc-field dmc-field-wide" },
								h("span", { className: "dmc-label" }, t("cwdLabel")),
								h("input", { className: "dmc-input", value: form.cwd, placeholder: "/path/to/project", onChange: (event) => updateField("cwd", event.target.value) }),
								h("span", { className: "dmc-hint" }, null)))
						: h(Fragment, { key: "http" },
							h("label", { className: "dmc-field dmc-field-wide" },
								h("span", { className: "dmc-label" }, t("urlLabel")),
								h("input", { className: "dmc-input", value: form.url, placeholder: "http://localhost:3000/mcp", onChange: (event) => updateField("url", event.target.value) }),
								h("span", { className: "dmc-hint" }, t("urlHint"))),
							h("label", { className: "dmc-field dmc-field-wide" },
								h("span", { className: "dmc-label" }, t("headersLabel")),
								h("textarea", { className: "dmc-input dmc-textarea", value: form.headersText, placeholder: "{\"Authorization\": \"Bearer ...\"}", onChange: (event) => updateField("headersText", event.target.value) }),
								h("span", { className: "dmc-hint" }, t("headersHint")))),
					h("label", { className: "dmc-field dmc-field-wide" },
						h("span", { className: "dmc-label" }, t("noteLabel")),
						h("input", { className: "dmc-input", value: form.note, onChange: (event) => updateField("note", event.target.value) }),
						h("span", { className: "dmc-hint" }, t("noteHint")))),
				formError !== null ? h("p", { className: "dmc-notice dmc-notice-err" }, formError) : null,
				h("div", { className: "dmc-form-actions" },
					h("button", { className: "dmc-btn", onClick: () => setForm(null) }, t("cancel")),
					h("button", { className: "dmc-btn dmc-btn-primary", onClick: () => void saveForm() }, t("save"))))));
	}

	function renderManualRow(entry) {
		return h("div", { key: entry.id, className: "dmc-row" },
			h("div", { className: "dmc-info" },
				h("div", { className: "dmc-name" },
					h("span", null, entry.serverName || entry.id),
					h("div", { className: "dmc-badges" },
						statusBadge(entry.disabled ? "disabled" : entry.status),
						h("span", { key: "transport", className: "dmc-badge" }, entry.transport || "?"),
						h("span", { key: "manual", className: "dmc-badge" }, t("manualBadge")),
						h("span", { key: "id", className: "dmc-badge" }, entry.id)))));
	}

	const hasInstalled = data.servers.length > 0 || data.manual.length > 0;
	const activeTab = tab ?? (data.status === "ok" && !hasInstalled ? "presets" : "installed");
	const presetGroups = filteredPresets();

	const body = data.status === "loading"
		? h("p", { className: "dmc-subtitle" }, t("loading"))
		: data.status === "error"
			? h("p", { className: "dmc-subtitle" }, format(t("loadError"), { message: data.message }))
			: h(Fragment, null,
				data.corrupt !== null ? h("p", { className: "dmc-notice dmc-notice-err" }, format(t("corrupt"), { message: data.corrupt })) : null,
				h("div", { className: "dmc-tabs" },
					h("button", { className: `dmc-tab ${activeTab === "installed" ? "dmc-tab-on" : ""}`, onClick: () => setTab("installed") }, `${t("tabInstalled")}（${data.servers.length + data.manual.length}）`),
					h("button", { className: `dmc-tab ${activeTab === "presets" ? "dmc-tab-on" : ""}`, onClick: () => setTab("presets") }, `${t("tabPresets")}（${data.presets.length}）`)),
				activeTab === "presets"
					? h(Fragment, null,
						h("div", { className: "dmc-search-row" },
							h("input", { className: "dmc-search", placeholder: t("searchPlaceholder"), value: presetQuery, onChange: (event) => setPresetQuery(event.target.value) })),
						h("div", { className: "dmc-chiprow" },
							h("button", { className: `dmc-chip ${presetCategory === null ? "dmc-chip-on" : ""}`, onClick: () => setPresetCategory(null) }, t("catAll")),
							data.categories.map((category) => h("button", {
								key: category.id,
								className: `dmc-chip ${presetCategory === category.id ? "dmc-chip-on" : ""}`,
								onClick: () => setPresetCategory(presetCategory === category.id ? null : category.id),
							}, category[lang] ?? category.id))),
						h("p", { className: "dmc-subtitle" }, t("presetsHint")),
						presetGroups.length === 0
							? h("p", { className: "dmc-subtitle" }, t("presetEmpty"))
							: h(Fragment, null, presetGroups.map((group) => h("div", { key: group.id, className: "dmc-preset-group" },
								h("p", { className: "dmc-section-label" }, categoryLabel(group.id)),
								h("div", { className: "dmc-presets" }, group.items.map(renderPresetCard))))))
					: h(Fragment, null,
						!hasInstalled ? h("p", { className: "dmc-subtitle" }, t("empty")) : null,
						data.servers.length > 0 ? h(Fragment, null,
							h("p", { className: "dmc-section-label" }, t("managed")),
							h("div", { className: "dmc-list" }, data.servers.map(renderServerRow))) : null,
						data.manual.length > 0 ? h(Fragment, null,
							h("p", { className: "dmc-section-label" }, t("manual")),
							h("p", { className: "dmc-subtitle" }, t("manualHint")),
							h("div", { className: "dmc-list" }, data.manual.map(renderManualRow))) : null));

	return h(Fragment, null,
		h("style", null, css),
		h("div", { className: "dmc-page" },
			h("div", { className: "dmc-head" },
				h("div", null,
					h("h1", { className: "dmc-title" }, t("title")),
					h("p", { className: "dmc-subtitle" }, t("description")),
					data.stateFile !== null ? h("p", { className: "dmc-meta" }, format(t("stateFile"), { file: data.stateFile })) : null),
				h("div", { className: "dmc-toolbar" },
					h("button", { className: "dmc-btn", onClick: () => void refresh() }, t("refresh")),
					h("button", { className: "dmc-btn dmc-btn-primary", onClick: startAdd }, t("add")))),
			renderNotice(),
			body),
		form !== null ? renderFormModal() : null);
}

/** 注册 MCP 服务器设置分区（由主包 apply 调用）。 */
export function register(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-plugin-mcp: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "dsh-plugin-mcp",
		order: 120,
		label: () => t("title"),
		locale: NS,
	}, McpSection));
}

/** 浏览器插件入口：注册 MCP 服务器分区。 */
export function apply(ctx) {
	register(ctx);
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
];
