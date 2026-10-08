/**
 * dsh-plugin-skills 文件操作冒烟测试（临时目录，不触碰真实技能目录）。
 * 运行：node packages/dsh-plugin-skills/test/smoke.mjs
 */
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	buildFrontmatter, buildPromptBlock, deleteSkill, extractPersona, findSkill, importSkills,
	listSkills, parseFrontmatter, sanitizeSkillName, saveSkill, setFrontmatterField,
	setPromptInPatch, setSkillModelEnabled,
} from "../lib/index.js";

const execFileAsync = promisify(execFile);

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
	check("新建返回扁平布局", created.layout === "flat" && created.name === "my-skill!-测试" && created.file === "my-skill!-测试.md");
	const content = await readFile(join(dir, created.file), "utf8");
	const fm = parseFrontmatter(content);
	check("新建 frontmatter 正确", fm.hasFrontmatter && fm.fields.name === "my-skill!-测试" && fm.fields.description === "测试技能");
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
	check("旧文件不存在", (await listSkills(dir)).every((skill) => skill.name !== "my-skill!-测试"));

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

	// 9) 导入：单 .md
	const importedMd = await importSkills(dir, { filename: "外部技能.md", data: Buffer.from("---\nname: 外部技能\ndescription: 导入的\n---\n\n正文\n", "utf8") });
	check("导入单 md", importedMd.imported.length === 1 && importedMd.imported[0].name === "外部技能" && importedMd.imported[0].layout === "flat");
	check("导入后出现在列表", (await listSkills(dir)).some((skill) => skill.name === "外部技能"));

	// 10) 导入 tar.gz：包装目录里含 bundle + 平铺 + README（应跳过）
	const source = await mkdtemp(join(tmpdir(), "dsh-skill-src-"));
	try {
		await mkdir(join(source, "wrapper", "bundle-a", "references"), { recursive: true });
		await writeFile(join(source, "wrapper", "bundle-a", "SKILL.md"), "---\nname: bundle-a\ndescription: 包内目录技能\n---\n\nB\n", "utf8");
		await writeFile(join(source, "wrapper", "flat-b.md"), "---\nname: flat-b\ndescription: 包内平铺技能\n---\n\nF\n", "utf8");
		await writeFile(join(source, "wrapper", "README.md"), "# 不是技能\n", "utf8");
		await execFileAsync("tar", ["-czf", join(source, "skills.tar.gz"), "-C", source, "wrapper"]);
		const archive = await readFile(join(source, "skills.tar.gz"));
		const imported = await importSkills(dir, { filename: "skills.tar.gz", data: archive });
		check("tar.gz 导入 2 个技能", imported.imported.length === 2 && imported.imported.some((item) => item.name === "bundle-a" && item.layout === "bundle") && imported.imported.some((item) => item.name === "flat-b" && item.layout === "flat"));
		check("README 被跳过", imported.skipped.some((item) => item.includes("README.md")));
		check("bundle 内容完整", (await readFile(join(dir, "bundle-a", "SKILL.md"), "utf8")).includes("包内目录技能"));

		// 11) 重名覆盖：再导一次同名 bundle
		await writeFile(join(source, "wrapper", "bundle-a", "SKILL.md"), "---\nname: bundle-a\ndescription: 覆盖后的\n---\n\nB2\n", "utf8");
		await execFileAsync("tar", ["-czf", join(source, "skills2.tar.gz"), "-C", source, "wrapper"]);
		const again = await importSkills(dir, { filename: "skills2.tar.gz", data: await readFile(join(source, "skills2.tar.gz")) });
		check("重名覆盖导入", again.imported.some((item) => item.name === "bundle-a") && (await readFile(join(dir, "bundle-a", "SKILL.md"), "utf8")).includes("覆盖后的"));

		// 12) zip（bsdtar 可用时）
		try {
			await execFileAsync("tar", ["--format", "zip", "-cf", join(source, "skills.zip"), "-C", source, "wrapper"]);
			const zipped = await importSkills(dir, { filename: "skills.zip", data: await readFile(join(source, "skills.zip")) });
			check("zip 导入成功", zipped.imported.length === 2);
		} catch {
			console.log("skip- 当前 tar 不支持 zip 创建，跳过 zip 用例");
		}
	} finally {
		await rm(source, { recursive: true, force: true });
	}

	// 13) 规则（提示词）：提取 / 替换 / 保留其它条目 / 追加
	const patchWithExtras = [
		"- id: system-prompt",
		"  config:",
		"    persona: |-",
		"      # 规则A",
		"      ",
		"      * 第一条",
		"",
		"- id: other-entry",
		"  config:",
		"    x: 1",
		"",
	].join("\n");
	check("提取 persona", extractPersona(patchWithExtras) === "# 规则A\n\n* 第一条");
	const replaced = setPromptInPatch(patchWithExtras, "# 新规则\n\n* 新条目");
	check("替换后提取一致", extractPersona(replaced) === "# 新规则\n\n* 新条目");
	check("其它条目保留", replaced.includes("- id: other-entry") && replaced.includes("x: 1"));
	check("system-prompt 仍唯一", (replaced.match(/- id: system-prompt/g) ?? []).length === 1);
	const appended = setPromptInPatch("- id: other-entry\n  config:\n    x: 1\n", "我的规则");
	check("无块时追加", extractPersona(appended) === "我的规则" && appended.includes("- id: other-entry") && appended.indexOf("- id: other-entry") < appended.indexOf("- id: system-prompt"));
	check("空块生成", buildPromptBlock("").trimEnd() === "- id: system-prompt\n  config:\n    persona: |");
	check("空内容替换为空", extractPersona(setPromptInPatch(patchWithExtras, "")) === "");

	// 14) 工具函数
	check("名称净化", sanitizeSkillName("A b/c") === "A-b-c");
	check("名称剔除非法字符", sanitizeSkillName("a:b*c?") === "a-b-c");
	check("名称净化折叠", sanitizeSkillName("my skill! 测试") === "my-skill!-测试");
	check("名称保留中文", sanitizeSkillName("测试技能") === "测试技能");
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
