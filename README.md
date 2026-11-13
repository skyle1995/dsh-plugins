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
| [`dsh-plugin-sound-alert`](packages/dsh-plugin-sound-alert) | `packages/dsh-plugin-sound-alert` | **手动交互提示音**：Agent 停下来需要你动手时响一声——会话出现待处理交互（选方向 / 确认 / 审批 / plan 复核）播上行双音铃，任务结束或停止播下行双音铃；子代理会话静默、同场景 280ms 合并连发；设置面板「提示音」分区（总开关 / 音量 / **按场景单独禁用** / **逐条替换成本地音频（wav·mp3·m4a·ogg·flac ≤4MB，存 IndexedDB）** / 恢复默认 / 逐条试听 / 依次试听）；音频随 bundle 内联下发、不依赖宿主路由，被浏览器自动播放策略拦截时自动挂手势解锁并提示 |
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

## 技能目录与商店

技能使用 `skills/<id>/SKILL.md` 布局，脚本、参考资料和许可证等原包文件保留
在同一子目录中。`id` 使用小写字母、数字及中划线，入口 frontmatter 至少包含：

```yaml
---
name: my-skill
description: 说明技能的功能与适用场景。
---
```

`dsh-plugin-repo` 的「技能能力 → 技能商店」直接扫描这些目录并读取描述，
无需手工 JSON 索引。新增目录推送后刷新商店即可发现；可选填写 `license`、
`metadata.version/category`，不填版本也能通过 Git 目录版本识别更新。

直接拷贝的 ZIP 可在仓库根运行：

```bash
node scripts/prepare-skills.mjs
# 只准备指定技能
node scripts/prepare-skills.mjs my-skill
```

ZIP 文件名为 `<id>.zip`，包内须以 `<id>/` 为顶层目录。脚本验证路径和内容后
解包，已有目录不覆盖，macOS 附加元数据被过滤。脚本不自动删除输入 ZIP；
确认解包内容后可移除原包。仓库已移除原始三个 ZIP，只保留技能目录，
原有三个技能描述采用中文在前、英文在后的双语形式，保留原始英文描述及正文；
商店直接显示双语描述，支持按中文或英文关键词搜索。

当前新增五项仓库原创开发技能，均为中文说明、`1.0.0`、MIT 授权，
每个目录附带独立许可证，可随商店安装：

| 技能目录 | 适用场景 |
|---|---|
| `dsh-plugin-development` | Node.js 插件、Cordis 服务、宿主 API、配置与发布布局 |
| `dsh-client-development` | React 设置面板、国际化、异步交互与预构建 bundle |
| `cross-platform-file-ops` | Windows/macOS 路径、批量文件操作、原子保存与安全归档 |
| `dsh-plugin-testing` | node:test 回归、服务替身、并发和卸载测试 |
| `dsh-mcp-integration` | MCP 传输与预设、状态持久化、运行时投影和资源清理 |

技能列表仍由目录自动发现，上表仅为说明，不参与商店读取。

新增第三方技能前请核实许可证及来源；商店安装不会执行其中脚本，但技能被调用时
仍需遵循宿主的权限与执行确认机制。详细配置与更新备份见
[`dsh-plugin-repo` 文档](packages/dsh-plugin-repo/README.md)。

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

> 开发约定：本仓库保持「发布即源码」——`lib/` 就是手写的 ESM 产物；两类
> 例外必须预构建并提交：
>
> 1. 浏览器 bundle（`lib/client.js`），任何插件都一样；
> 2. **上游镜像包**——`dsh-connect-workbuddy`（逐字节镜像）在仓库里直接提交
>    完整构建产物，安装时不再跑 `prepare`/构建脚本，避免 profile 的
>    `allowBuilds` 批准流程。
>
> 浏览器半区与 `demo-test/` 测试页需要 React 时，从工作区根 `package.json` 的
> `devDependencies` 解析；新增插件不要在别的包里借用依赖。

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
- [x] `dsh-plugin-sound-alert`：手动交互提示音（待操作 / 任务结束）+ 设置面板试听与音量
- [ ] `dsh-plugin-sound-alert`：会话标题闪烁 / 桌面通知、自定义音频导入
- [ ] `plugin_repo` agent 工具（目录搜索 + 安装，需评估启用策略）
- [ ] `dsh-plugin-mcp`：MCP 服务器状态自检（工具列表预览）、`$env:` 环境变量引用（避免明文落盘）
- [ ] 更多业务插件（session-manager 等迁入）
