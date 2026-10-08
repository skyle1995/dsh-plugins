/**
 * dsh-plugin-skills 浏览器半区：设置面板里的「技能能力」分区。
 *
 * 通过 settings.section 注册为设置面板左侧导航的独立分区，管理本地
 * skills（列表 / 新建 / 编辑 / 删除 / 模型可见开关）。数据与操作走宿主
 * 半区注册的 /api/dsh-plugin-skills 路由；filesystem 提供方会实时监视
 * 技能目录，保存后无需重启即可生效。
 */
import { createElement as h, Fragment, useEffect, useState } from "react";

const NS = "dsh-plugin-skills";
const API = "/api/dsh-plugin-skills";

const zh = {
	title: "技能能力",
	description: "管理本地 skills 技能：新建、编辑、删除，以及是否允许模型调用。",
	refresh: "刷新",
	create: "新建技能",
	edit: "编辑",
	delete: "删除",
	cancel: "取消",
	save: "保存",
	name: "名称",
	skillNamePlaceholder: "如 my-skill（仅字母数字-_）",
	skillDescription: "描述",
	skillBody: "正文（SKILL.md 内容）",
	loading: "正在加载技能列表…",
	empty: "还没有技能，点击「新建技能」创建一个。",
	loadError: "读取技能列表失败：{message}",
	saved: "技能「{name}」已保存。",
	removed: "技能「{name}」已删除。",
	saveFailed: "保存失败：{message}",
	actionFailed: "操作失败：{message}",
	deleteConfirm: "确定删除技能「{name}」吗？",
	modelEnabled: "模型可调用",
	modelDisabled: "模型已禁用",
	enableModel: "允许模型调用",
	disableModel: "禁用模型调用",
	layoutBundle: "目录",
	layoutFlat: "文件",
	userInvocable: "用户可调用",
	userNotInvocable: "用户不可调用",
};

const en = {
	title: "Skills",
	description: "Manage local skills: create, edit, delete, and control model invocation.",
	refresh: "Refresh",
	create: "New skill",
	edit: "Edit",
	delete: "Delete",
	cancel: "Cancel",
	save: "Save",
	name: "Name",
	skillNamePlaceholder: "e.g. my-skill (letters, digits, - and _ only)",
	skillDescription: "Description",
	skillBody: "Body (SKILL.md content)",
	loading: "Loading skills…",
	empty: "No skills yet. Click “New skill” to create one.",
	loadError: "Failed to load skills: {message}",
	saved: "Skill “{name}” saved.",
	removed: "Skill “{name}” deleted.",
	saveFailed: "Save failed: {message}",
	actionFailed: "Operation failed: {message}",
	deleteConfirm: "Delete skill “{name}”?",
	modelEnabled: "Model invocable",
	modelDisabled: "Model disabled",
	enableModel: "Allow model invocation",
	disableModel: "Disable model invocation",
	layoutBundle: "Directory",
	layoutFlat: "File",
	userInvocable: "User invocable",
	userNotInvocable: "Not user invocable",
};

/** 极简文案翻译：{name} 占位替换。 */
function format(text, params) {
	return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

const css = `
.dsk-page{display:flex;flex-direction:column;gap:16px;min-width:0;padding:4px 0}
.dsk-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsk-title{margin:0;font-size:16px;font-weight:600}
.dsk-subtitle{margin:0;color:var(--dsw-alias-label-tertiary,#888);font-size:13px;line-height:1.6}
.dsk-actions{display:flex;gap:8px;flex-shrink:0;align-items:center}
.dsk-btn{appearance:none;border:1px solid var(--dsw-alias-border-l3,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.dsk-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
.dsk-btn:disabled{opacity:.5;cursor:default}
.dsk-btn-primary{background:var(--dsw-alias-state-business-primary,#3b6ef5);border-color:transparent;color:#fff}
.dsk-btn-danger{color:var(--dsw-alias-state-error-primary,#d33)}
.dsk-form{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:14px}
.dsk-field{display:flex;flex-direction:column;gap:4px}
.dsk-label{font-size:12px;color:var(--dsw-alias-label-secondary,#555)}
.dsk-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2,#ccc);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:inherit;border-radius:8px;outline:none;padding:6px 10px;font-size:13px;line-height:20px}
.dsk-input:focus{border-color:var(--dsw-alias-state-business-primary,#3b6ef5)}
.dsk-textarea{min-height:220px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.6}
.dsk-list{display:flex;flex-direction:column;gap:8px}
.dsk-row{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:12px 14px}
.dsk-info{flex:1;min-width:0}
.dsk-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:600}
.dsk-desc{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#555);font-size:13px;line-height:1.55;overflow-wrap:anywhere}
.dsk-badges{display:flex;gap:6px;flex-wrap:wrap}
.dsk-badge{font-size:11px;line-height:1.5;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,#ddd);color:var(--dsw-alias-label-tertiary,#777)}
.dsk-badge-on{color:var(--dsw-alias-state-success,#18864b);border-color:currentColor}
.dsk-badge-off{color:var(--dsw-alias-state-warning,#a06b00);border-color:currentColor}
.dsk-notice{margin:0;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6}
.dsk-notice-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d33)}
.dsk-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#18864b) 12%,transparent);color:var(--dsw-alias-state-success,#18864b)}
`;

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

/** 设置分区组件：props 由 slot 框架提供 t（按 NS 绑定）。 */
function SkillsSection({ t }) {
	const [skills, setSkills] = useState([]);
	const [status, setStatus] = useState("loading");
	const [notice, setNotice] = useState(null);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState({ name: "", description: "", body: "" });

	async function refresh() {
		setStatus("loading");
		try {
			const payload = await api("/skills");
			setSkills(payload.skills ?? []);
			setStatus("ok");
		} catch (error) {
			setStatus("error");
			setNotice({ kind: "error", text: format(t("loadError"), { message: error.message }) });
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	function openCreate() {
		setForm({ name: "", description: "", body: "" });
		setEditing({ mode: "create" });
		setNotice(null);
	}

	function openEdit(skill) {
		setForm({ name: skill.name, description: skill.description, body: skill.body });
		setEditing({ mode: "edit", skill });
		setNotice(null);
	}

	async function submit() {
		if (form.name.trim() === "") {
			setNotice({ kind: "error", text: format(t("saveFailed"), { message: t("skillNamePlaceholder") }) });
			return;
		}
		setBusy(true);
		setNotice(null);
		try {
			const payload = await api("/save", {
				method: "POST",
				body: JSON.stringify({
					name: form.name,
					description: form.description,
					body: form.body,
					...(editing.mode === "edit" ? { previous: editing.skill } : {}),
				}),
			});
			setEditing(null);
			setNotice({ kind: "ok", text: format(t("saved"), { name: payload.skill.name }) });
			await refresh();
		} catch (error) {
			setNotice({ kind: "error", text: format(t("saveFailed"), { message: error.message }) });
		} finally {
			setBusy(false);
		}
	}

	async function toggleModel(skill) {
		setBusy(true);
		setNotice(null);
		try {
			await api("/toggle", { method: "POST", body: JSON.stringify({ name: skill.name, modelEnabled: skill.modelDisabled }) });
			await refresh();
		} catch (error) {
			setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
		} finally {
			setBusy(false);
		}
	}

	async function remove(skill) {
		if (!globalThis.confirm(format(t("deleteConfirm"), { name: skill.name }))) return;
		setBusy(true);
		setNotice(null);
		try {
			await api("/delete", { method: "POST", body: JSON.stringify({ name: skill.name }) });
			setNotice({ kind: "ok", text: format(t("removed"), { name: skill.name }) });
			await refresh();
		} catch (error) {
			setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
		} finally {
			setBusy(false);
		}
	}

	function renderNotice() {
		if (notice === null) return null;
		return h("p", { className: `dsk-notice ${notice.kind === "error" ? "dsk-notice-err" : "dsk-notice-ok"}` }, notice.text);
	}

	function renderForm() {
		return h("div", { className: "dsk-form" },
			h("div", { className: "dsk-field" },
				h("span", { className: "dsk-label" }, t("name")),
				h("input", { className: "dsk-input", value: form.name, placeholder: t("skillNamePlaceholder"), onChange: (event) => setForm({ ...form, name: event.target.value }) })),
			h("div", { className: "dsk-field" },
				h("span", { className: "dsk-label" }, t("skillDescription")),
				h("input", { className: "dsk-input", value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }) })),
			h("div", { className: "dsk-field" },
				h("span", { className: "dsk-label" }, t("skillBody")),
				h("textarea", { className: "dsk-input dsk-textarea", value: form.body, onChange: (event) => setForm({ ...form, body: event.target.value }) })),
			h("div", { className: "dsk-actions" },
				h("button", { className: "dsk-btn dsk-btn-primary", disabled: busy, onClick: () => void submit() }, t("save")),
				h("button", { className: "dsk-btn", disabled: busy, onClick: () => setEditing(null) }, t("cancel"))));
	}

	function renderRow(skill) {
		const badges = [
			h("span", { key: "layout", className: "dsk-badge" }, skill.layout === "bundle" ? t("layoutBundle") : t("layoutFlat")),
			h("span", { key: "model", className: `dsk-badge ${skill.modelDisabled ? "dsk-badge-off" : "dsk-badge-on"}` }, skill.modelDisabled ? t("modelDisabled") : t("modelEnabled")),
			h("span", { key: "user", className: `dsk-badge ${skill.userInvocable ? "dsk-badge-on" : "dsk-badge-off"}` }, skill.userInvocable ? t("userInvocable") : t("userNotInvocable")),
		];
		return h("div", { key: skill.name, className: "dsk-row" },
			h("div", { className: "dsk-info" },
				h("div", { className: "dsk-name" },
					h("span", null, skill.name),
					h("div", { className: "dsk-badges" }, badges)),
				skill.description ? h("p", { className: "dsk-desc" }, skill.description) : null),
			h("div", { className: "dsk-actions" },
				h("button", { className: "dsk-btn", disabled: busy, onClick: () => openEdit(skill) }, t("edit")),
				h("button", { className: "dsk-btn", disabled: busy, onClick: () => void toggleModel(skill) }, skill.modelDisabled ? t("enableModel") : t("disableModel")),
				h("button", { className: "dsk-btn dsk-btn-danger", disabled: busy, onClick: () => void remove(skill) }, t("delete"))));
	}

	const body = status === "loading"
		? h("p", { className: "dsk-subtitle" }, t("loading"))
		: status === "error"
			? h("p", { className: "dsk-subtitle" }, format(t("loadError"), { message: "" }))
			: skills.length === 0
				? h("p", { className: "dsk-subtitle" }, t("empty"))
				: h("div", { className: "dsk-list" }, skills.map(renderRow));

	return h(Fragment, null,
		h("style", null, css),
		h("div", { className: "dsk-page" },
			h("div", { className: "dsk-head" },
				h("div", null,
					h("h1", { className: "dsk-title" }, t("title")),
					h("p", { className: "dsk-subtitle" }, t("description"))),
				h("div", { className: "dsk-actions" },
					h("button", { className: "dsk-btn", onClick: () => void refresh() }, t("refresh")),
					h("button", { className: "dsk-btn dsk-btn-primary", onClick: openCreate }, t("create")))),
			renderNotice(),
			editing !== null ? renderForm() : null,
			body));
}

/** 浏览器插件入口：注册 locale 词典与设置面板里的独立「技能能力」分区。 */
export function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "plugin-skills: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "skills-manager",
		order: 110,
		label: () => t("title"),
		locale: NS,
	}, SkillsSection));
}

/** 浏览器依赖注入面（服务名；包级依赖见 package.json 的 dsh.client.inject）。 */
export const inject = [
	"slots",
	"locale",
];
