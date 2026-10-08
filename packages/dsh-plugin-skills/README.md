# dsh-plugin-skills

**技能能力**：DSH 的 skills 技能管理插件。在设置面板左侧导航里提供独立的
「技能能力」分区（settings.section），管理 `$DSH_HOME/skills`（缺省
`~/.dsh/skills`）下的本地 skill。

## 功能

- **列表**：兼容 `dsh-skill-filesystem` 的两种布局（目录 bundle
  `<name>/SKILL.md` 与平铺文件 `<name>.md`），解析 YAML frontmatter
  （name / description / whenToUse / disable-model-invocation /
  user-invocable）；
- **新建**：表单填写名称、描述与正文，生成规范的 `SKILL.md`（平铺 .md）；
- **编辑**：改写正文与描述；改名时同步重命名文件或目录 bundle；
- **删除**：删除平铺文件或整个目录 bundle（有确认）；
- **导入**：上传 `.md` 单文件或 `.zip`/`.tar.gz`/`.tgz` 压缩包，解包扫描
  目录 bundle 与平铺技能（含 GitHub 等常见的包装目录），跳过 README 等
  非技能文件，重名覆盖；
- **查看**：列表描述缩略显示（两行），点「查看」展开完整描述、适用场景、
  文件路径与正文；
- **模型可见开关**：改写 frontmatter 的 `disable-model-invocation` 字段，
  其余字段与正文原样保留。

filesystem 提供方实时监视技能根目录，因此保存后**无需重启**即可进入
下一次会话目录。

## 架构

- **宿主半区**（纯 ESM，无构建）：Cordis 服务（`ctx.skillManager`）提供
  文件操作（`listSkills` / `saveSkill` / `deleteSkill` /
  `setSkillModelEnabled` 等纯函数也可单独使用），并在 Web profile 里通过
  `ctx.inject(["webServer"])` 注册 `/api/dsh-plugin-skills/*` 路由；
- **浏览器半区**（预构建 `lib/client.js`）：`settings.section` 分区，消费
  上述路由；修改 `src/client/` 后运行
  `pnpm --filter dsh-plugin-skills build:client` 再提交。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `skillsDir` | `""`（自动） | 技能根目录；留空时用 `$DSH_HOME/skills`（或 `~/.dsh/skills`） |

## 安装

```bash
dsh plugin --profile web add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-skills"
```

安装后重启 Web GUI，设置面板左侧导航会出现「技能能力」分区。

## 约定与限制

- 新建技能采用平铺 `.md` 布局；`references/` 等资源目录请用目录 bundle
  手动组织（本插件可正常列出与编辑）。
- frontmatter 解析为行级实现：多行 YAML 值（`|` 块）在列表显示时会折叠，
  开关改写仅增删单行 `disable-model-invocation`，不触碰其余行。
- 名称净化规则：剔除文件名非法字符（`\/:*?"<>|` 与控制字符），空白折叠为
  `-`；保留中文等 Unicode 字母（技能名不是安装 spec，无 ASCII 限制）。
