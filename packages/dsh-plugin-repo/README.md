# dsh-plugin-repo

**DSH 基础插件**（dsh-plugins 仓库的基础能力合集）。设置面板左侧导航提供
两个独立分区，另在会话右键菜单底部贡献「删除会话」项。插件安装、更新与
卸载使用 DSH 内置插件管理：

| 分区 / 入口 | 能力 |
|---|---|
| **技能能力** | 本地 skills 管理，以及技能商店：自动读取描述、搜索、安装、更新 |
| **规则（提示词）** | 全局 system-prompt persona 查看 / 编辑（热加载生效） |
| **会话菜单 → 删除会话** | 会话右键菜单底部（归档项之后）永久删除会话：空闲会话立即从 live 存储摘除；成功后局部更新列表，不刷新页面，保留其它会话草稿；被删除会话仍在当前视图时转到同工作区的新会话；正在运行的会话拒绝删除；文件与 workspace 记账一并清理 |

宿主半区为主服务（`ctx.pluginRepo`）挂载两个子服务（`ctx.skillManager`、
`ctx.sessionArchive`），各子服务持有独立的依赖注入面。

DSH 的插件安装（`dsh plugin --profile <name> add <spec>` / Web 插件页）本质是
pnpm 安装，而 pnpm 11 支持 `git+https://host/owner/repo.git#<分支>&path:<子目录>`
直接从 git 仓库**子目录**安装。因此 monorepo 里的每个插件（`packages/<name>`）
天然都有可安装的 spec；本插件继续提供插件仓库宿主服务供程序调用：

- **目录查询** `ctx.pluginRepo.catalog()` —— 通过 Gitea API 列出仓库内全部插件
  及版本、描述、是否组合包（`dsh.bundle.patch`）；
- **spec 生成** `ctx.pluginRepo.specFor(name)` —— 拼出可直接安装的 git spec；
- **一键安装** `ctx.pluginRepo.install(name, options)` —— 解析后转发给 profile
  的 `pluginManager.installBundle`，复用其 DSH 版本兼容预检、失败回滚、
  构建脚本批准等全部流程；
- `0.4.2` 起不再注册设置中的「插件仓库 / 插件中心」分区；技能能力、
  技能商店、规则提示词和会话菜单仍按原有入口提供。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `gitHost` | `https://hub.ifunx.com` | Gitea 主机根地址 |
| `owner` | `skyle1995` | 仓库所有者 |
| `repo` | `dsh-plugins` | 仓库名 |
| `branch` | `main` | 用于安装的分支 |
| `catalogDir` | `packages` | monorepo 内插件目录 |
| `skillsCatalogDir` | `skills` | 仓库技能根目录，自动扫描子目录并读取 `SKILL.md` |
| `token` | `""`（secret） | Gitea Access Token；公开仓库可留空 |
| `requestTimeoutMs` | `15000` | 单次 API 请求超时 |
| `skillsDir` | `""`（自动） | 技能能力子服务的技能根目录；留空用 `$DSH_HOME/skills` |
| `sessionsDir` | `""`（自动） | 会话删除子服务的会话根目录；留空用 `$DSH_HOME/sessions` |

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: plugin-repo
  name: 'dsh-plugin-repo'
  config:
    owner: my-org
    repo: my-dsh-plugins
```

## 安装基础插件

本插件本身就是本仓库的一个子目录包，同样可以用 git spec 直接安装
（基础插件无需任何引导依赖）：

```bash
dsh plugin --profile web add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-repo"
```

开发调试时也可以用本地路径：

```bash
dsh plugin --profile web add /path/to/dsh-plugins/packages/dsh-plugin-repo
```

## 服务使用

```js
// 任意同 profile 的宿主插件（注入 pluginRepo 服务）：
const { source, entries } = await ctx.pluginRepo.catalog();
for (const entry of entries) {
  console.log(entry.name, entry.version, entry.spec, entry.isBundle);
}
const { spec, result } = await ctx.pluginRepo.install("dsh-plugin-repo", { enabled: true });
```

## 约定与限制

- `0.4.0` 起「技能能力」包含「已安装 / 技能商店」两个视图。商店沿用
  `gitHost/owner/repo/branch/token`，描述直接来自 `skillsCatalogDir/<id>/SKILL.md`
  的 frontmatter，不需要维护 `catalog.json`。新增目录推送到配置的分支后，
  在商店刷新即可发现；原始 ZIP 和其他普通文件不参与列表。
- 技能入口必须声明与目录一致的 `name` 和非空 `description`（最多 4000 字符）。
  支持普通、单/双引号以及 `>`、`|` 多行字段；不是完整 YAML 解析器。
  可选 `license`、`metadata.version/category`，未声明版本时使用 Git 目录树
  id 前 8 位。商店完整显示原描述，不自动翻译或改写第三方技能。
- 安装固定 Git revision 并校验文件 blob，不执行包内脚本；单文件最多 8MB、
  总内容最多 64MB、树条目最多 1024，拒绝越界路径、符号链接、子模块和
  Windows/macOS 文件名冲突。未声明许可证时显示提示，安装前应核实授权。
- 同名替换必须确认，旧目录和平铺 `<id>.md` 完整备份到安装目录下的
  `.dsh-skill-backups/`。安装器生成 `.dsh-skill-store.json` 作为本地安装记录，
  用于识别文件增删修改及上游更新；该记录不是需要手工维护的商店索引。
  安装、编辑、删除、导入共用写队列；取消或失败时清理暂存并尝试恢复旧技能。
- 商店回归：在根目录运行 `node --test demo-test/skill-store.test.mjs`。

- `0.3.4` 起 Gitea API 路径和分支参数编码，目录 `404` 正确返回空数组；
  仓库、技能和会话管理 JSON 请求限制为 1MB，超限返回 `413`。
- 技能编辑必须引用当前技能列表中的实际文件，新建或改名不覆盖其它技能；
  编辑保留 frontmatter 中的模型/用户开关及额外字段，保留原 CRLF 换行风格。
  保存、模型开关、单文件导入和规则保存使用同目录临时文件替换，保留模式权限；
  压缩包中的目录技能导入仍按既有覆盖语义处理，不承诺整个导入具有事务性。
- Windows 技能名称额外拒绝设备保留名，不将其限制强加给 macOS/Linux；
  会话清理不会把带分隔符的原始 id 拼入标题缓存路径。
- 新增离线回归在仓库根运行 `node --test demo-test/other-plugins.test.mjs`，
  本轮在 Windows 执行，macOS/Linux 真机仍需验证。
- 仓库公开时无需 token；私有仓库需在配置中提供带读取权限的 token。
- 目录读取使用 Gitea API（`contents` 与 `raw` 端点，raw 失败时回退 base64）。
- 分支名含 `#` 或 `&` 的仓库无法生成正确 spec（pnpm fragment 语法限制）。
- 宿主半区**无构建步骤**（纯 ESM + 类型声明），避免触发 pnpm 的构建脚本
  批准流程；浏览器半区是**预构建产物** `lib/client.js`（已提交），修改
  `src/client/` 后本地运行 `pnpm --filter dsh-plugin-repo build:client` 再提交。
- 更新安装包后需重启 Web GUI：进程内替换插件包不重新加载（DSH 的 HMR
  只监视 profile manifest 与 patch 文件，不监视 node_modules 内容）。
