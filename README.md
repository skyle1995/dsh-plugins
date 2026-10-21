# dsh-plugins

DSH（DeepSeek Harness）第三方插件仓库（monorepo），托管于
[hub.ifunx.com/skyle1995/dsh-plugins](https://hub.ifunx.com/skyle1995/dsh-plugins)（公开）。

每个插件是一个独立的 npm 包，放在 `packages/<插件名>/`。得益于 pnpm 11 的
`#<分支>&path:<子目录>` git spec 语法，仓库里任何一个插件都可以**直接安装**，
无需先发布到 npm registry：

```bash
dsh plugin --profile <profile> add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/<插件名>"
```

例如安装第一个插件（仓库插件）：

```bash
dsh plugin --profile web add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-repo"
```

## 插件列表

| 插件 | 目录 | 说明 |
|---|---|---|
| [`dsh-plugin-repo`](packages/dsh-plugin-repo) | `packages/dsh-plugin-repo` | **基础插件**：设置面板三个分区——插件仓库（在线目录/安装/更新/卸载）、技能能力（skills 管理+导入）、规则提示词（system-prompt persona 编辑，热加载）；另在会话右键菜单底部提供「删除会话」（红色警示+确认弹窗） |
| [`dsh-plugin-file-actions`](packages/dsh-plugin-file-actions) | `packages/dsh-plugin-file-actions` | **文件列表增强**：文件树右键菜单与批量操作——侧边栏编辑 tab（编辑态实时语法高亮 + prettier 一键格式化）、**重命名**（文件/目录，右键或 `F2`，命名弹窗）、剪切/复制/粘贴、删除（确认弹窗）、压缩为 ZIP（命名弹窗）、复制路径、**多选与范围选择**（`⌘/Ctrl` 点击切换、`Shift` 点击选中连续区间）+ 底部批量操作栏（宿主半区路由 + 工作区安全约束） |
| [`dsh-plugin-mcp`](packages/dsh-plugin-mcp) | `packages/dsh-plugin-mcp` | **MCP 服务器管理器**：设置面板「MCP 服务器」分区（已安装/预设分页）——可视化增删改/启停外部 MCP 服务器（stdio 本地进程 / streamable-http 远程），基于内置 `@deepseek-ai/dsh-mcp-client` 桥接（工具名 `mcp__<name>__<tool>`）；**43 个热门预设一键添加**（在线目录：更新仓库 presets.json 即可下发新预设，无需升级插件）（通用开发 / 代码托管（Gitea 官方·自建）/ 浏览器 Web / 搜索情报 / 云服务 / 逆向安全：Reqable、IDA Pro、Ghidra、Binary Ninja、Frida、JADX、VirusTotal、x64dbg、CyberChef、REA（多引擎编排）；八分类分组 + 搜索 + 弹窗表单 + 占位拦截 + $env:/$file: 动态参数解析）；状态存 JSON、运行时投影为 loader 树条目，重启自动重建；手工 cordis.patch.yml 条目只读展示 |
| [`dsh-connect-workbuddy`](packages/dsh-connect-workbuddy) | `packages/dsh-connect-workbuddy` | **WorkBuddy 账号接入（第三方 · 上游镜像 v4.6.5 / 本仓库 v4.6.6，仅放宽 peer 范围）**：复用本机 WorkBuddy 桌面 App 的登录态（**无需二次登录、无需 Key**），把其模型接进 DSH 模型选择器；**国内版与国际版并行**（`workbuddy` / `workbuddy-global` 两个供应商，设置卡片以 tab 区分）；**账号池**（多账号添加/切换/轮换、凭据写入宿主凭据库）+ 模型勾选开关 + 只读积分/额度概览（侧栏用量卡、内联额度提示）；附带状态 CLI（`dsh-connect-workbuddy`）；Windows / macOS / Linux 三平台并列支持（Windows 为一等目标）。**注意**：MIT 上游镜像，产物文件逐字节未改，仅元数据对齐本仓库（新增 `@deepseek-ai/dsh` peer（semver 范围 `>=0.2.0-rc.2`）、移除失效的 `prepack`/构建脚本）；其派生关系（`dsh-workbuddy-connect`、`dsh-connect-trae`）由上游在 `THIRD_PARTY_NOTICES.md` 声明 |

## 为什么需要「仓库插件」

`dsh plugin add` 和 Web 插件页的「添加插件」都能直接粘贴上面的 git spec，但
monorepo 形态下有几件事裸 pnpm 做不了：

- **目录**：仓库里现在/以后有哪些插件、版本、是否组合包，需要查询 Gitea API；
- **统一入口**：包名 → spec 的换算（`packages/<name>`、`#main&path:` 规则）不该
  让每个用户手写；
- **一键安装**：把「解析 + 安装」转发给 profile 的 `pluginManager`，复用 DSH
  原生的版本兼容预检、失败回滚、构建脚本批准流程。

`dsh-plugin-repo` 把这些能力收拢为服务（`ctx.pluginRepo`）和设置里的仓库分区页，
后续插件与 agent 工具都建立在这个服务上。

## 编写新插件的规范

在 `packages/<插件名>/` 下新建包，满足：

1. `package.json`：
   - `"type": "module"`，`main`/`exports` 指向 `lib/index.js`；
   - **`"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`** —— 声明为组合包；
   - `peerDependencies` 中声明 `"@deepseek-ai/dsh": ">=0.2.0-rc.2"` 这类 **semver
     范围**（也可用 `engines.dsh`，其优先级更高），DSH 安装与启动会按
     `semver.satisfies(..., { includePrerelease: true })` 做版本兼容检查；
     用到的 harness 包（`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、
     `@deepseek-ai/dsh-*`）同样以范围声明为 peer，由 DSH 运行时解析器供应；
   - `files` 含 `lib/`、`cordis.patch.yml`、`README.md`。
2. `cordis.patch.yml`：loader patch 条目（`- insert: [{ id, name }]`），行 id
   唯一、模块名指向插件入口。
3. `lib/index.js`：默认导出 Cordis 插件（`class extends Service`，含
   `static inject` 与可选 `static Config`（schemastery schema，loader 据此
   校验配置并套用默认值）。
4. **无构建步骤（宿主半区）**：直接提交构建产物（纯 ESM JS + `.d.ts`），
   避免 pnpm 的构建脚本批准流程；确需构建时使用 `prepublishOnly` 并了解
   profile 的 `allowBuilds` 机制。
5. **浏览器半区（可选）**：在 `package.json` 声明
   `"dsh": { "client": { "platform": "web", "inject": [...] } }`、导出
   `./client`（预构建的 `lib/client.js`），源码放 `src/client/`，用 esbuild
   等工具产出 `window.__ModuleLoader__.load({ id, factory })` 格式的 CJS
   外壳（React/平台模块保持外部化），参考 dsh-plugin-repo 的
   `scripts/build-client.mjs`。浏览器半区是提交进仓库的构建产物，宿主半区
   依旧零构建。

> 开发约定：本仓库保持「发布即源码」——`lib/` 就是手写的 ESM 产物；唯一的
> 例外是浏览器 bundle（`lib/client.js`），它必须预构建并提交。

## 版本兼容

插件以 `peerDependencies["@deepseek-ai/dsh"]`（或优先级更高的 `engines.dsh`）
声明支持的 DSH 运行时 **semver 范围**，例如 `>=0.2.0-rc.2`、`^0.2.0-rc.2`、
`workspace:^`。安装和 profile 启动会用
`semver.satisfies(runtimeVersion, range, { includePrerelease: true })` 检查，
预发布版本同样参与匹配（`0.2.1-rc.2` 满足 `>=0.2.0-rc.2`）。不满足范围的
插件需要用户通过 `dsh plugin allow-version`（或 Web 插件页）按「插件版本 +
DSH 版本」精确豁免后才可运行。

## 路线图

- [x] `dsh-plugin-repo`：宿主服务（catalog / spec / install）
- [x] 设置里的「插件仓库」独立分区：在线列表查看、安装、更新、卸载（浏览器半区）
- [x] `dsh-plugin-mcp`：设置面板 MCP 服务器管理器（增删改/启停 + 状态投影 + 重启重建）
- [x] `dsh-plugin-mcp`：21 个热门预设一键添加（通用开发 + 逆向/安全，零配置直存 / 需密钥预填表单 + 占位拦截）
- [ ] `plugin_repo` agent 工具（目录搜索 + 安装，需评估启用策略）
- [ ] `dsh-plugin-mcp`：MCP 服务器状态自检（工具列表预览）、`$env:` 环境变量引用（避免明文落盘）
- [ ] 更多业务插件（session-manager 等迁入）
