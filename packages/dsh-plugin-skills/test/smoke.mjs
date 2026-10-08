/**
 * dsh-plugin-skills 文件操作冒烟测试（临时目录，不触碰真实技能目录）。
 * 运行：node packages/dsh-plugin-skills/test/smoke.mjs
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildFrontmatter, deleteSkill, findSkill, listSkills, parseFrontmatter,
	sanitizeSkillName, saveSkill, setFrontmatterField, setSkillModelEnabled,
} from "../lib/index.js";

const dir = await mkdtemp(join(tmpdir(), "dsh-skills-test-"));
let failed = 0;
function check(label, condition) {
	if (condition) console.log(`ok  - ${label}`);
	else {
		failed += 1;
		console.error(`FAIL- ${label}`);
	}
}

try {
	// 1) 空目录
	check("空目录列表为空", (await listSkills(dir)).length === 0);

	// 2) 新建平铺技能
	const created = await saveSkill(dir, { name: "my skill! 测试", description: "测试技能", body: "# 用法\n\n随便写。" });
	check("新建返回扁平布局", created.layout === "flat" && created.name === "my-skill" && created.file === "my-skill.md");
	const content = await readFile(join(dir, created.file), "utf8");
	const fm = parseFrontmatter(content);
	check("新建 frontmatter 正确", fm.hasFrontmatter && fm.fields.name === "my-skill" && fm.fields.description === "测试技能");
	check("新建正文保留", fm.body.includes("# 用法"));

	// 3) 手工目录 bundle（含 references）被列出
	await mkdir(join(dir, "bundle-skill", "references"), { recursive: true });
	await writeFile(join(dir, "bundle-skill", "SKILL.md"), "---\nname: bundle-skill\ndescription: 目录技能\n---\n\n正文\n", "utf8");
	const listed = await listSkills(dir);
	check("两种布局都被列出", listed.length === 2);
	const bundle = listed.find((skill) => skill.layout === "bundle");
	check("bundle 条目解析", bundle !== undefined && bundle.file === "bundle-skill/SKILL.md" && bundle.description === "目录技能");

	// 4) 编辑 + 改名（flat → 改名）
	const renamed = await saveSkill(dir, { name: "renamed", description: "改名", body: "新正文", previous: created });
	check("改名后文件移动", renamed.name === "renamed" && renamed.file === "renamed.md");
	check("旧文件不存在", (await listSkills(dir)).every((skill) => skill.name !== "my-skill"));

	// 5) 编辑 + 改名（bundle → 目录改名）
	const bundleRenamed = await saveSkill(dir, { name: "bundle-renamed", description: "目录技能", body: "新正文", previous: bundle });
	check("bundle 改名", bundleRenamed.name === "bundle-renamed" && bundleRenamed.file === "bundle-renamed/SKILL.md");
	check("bundle 改名后目录存在", (await listSkills(dir)).some((skill) => skill.name === "bundle-renamed" && skill.layout === "bundle"));

	// 6) 模型可见开关：写入/清除 disable-model-invocation，保留其余字段
	const toggled = await setSkillModelEnabled(dir, "renamed", false);
	check("禁用模型调用", toggled.modelDisabled === true);
	let updated = await readFile(join(dir, "renamed.md"), "utf8");
	check("frontmatter 含禁用标记", /disable-model-invocation: true/.test(updated));
	const reEnabled = await setSkillModelEnabled(dir, "renamed", true);
	check("恢复模型调用", reEnabled.modelDisabled === false);
	updated = await readFile(join(dir, "renamed.md"), "utf8");
	check("禁用标记被清除", !/disable-model-invocation/.test(updated) && updated.includes("description: 改名"));

	// 7) 无 frontmatter 文件也能加标记
	await writeFile(join(dir, "bare.md"), "纯正文\n", "utf8");
	await setSkillModelEnabled(dir, "bare", false);
	const bare = await readFile(join(dir, "bare.md"), "utf8");
	check("无 frontmatter 时补建", bare.startsWith("---\n") && /disable-model-invocation: true/.test(bare) && bare.includes("纯正文"));

	// 8) 删除两种布局
	await deleteSkill(dir, "bundle-renamed");
	await deleteSkill(dir, "renamed");
	check("删除后只剩 bare", (await listSkills(dir)).length === 1);

	// 9) 工具函数
	check("名称净化", sanitizeSkillName("A b/c") === "A-b-c");
	check("名称净化折叠", sanitizeSkillName("my skill! 测试") === "my-skill");
	check("frontmatter 序列化", buildFrontmatter({ name: "x", description: "含 空格", modelDisabled: true }).includes("disable-model-invocation: true"));
	check("setFrontmatterField 保留其它字段", setFrontmatterField("---\nname: a\ndescription: d\n---\n\nB", "disable-model-invocation", "true").includes("description: d"));
} finally {
	await rm(dir, { recursive: true, force: true });
}

if (failed > 0) {
	console.error(`${failed} checks failed`);
	process.exit(1);
}
console.log("SMOKE OK");
