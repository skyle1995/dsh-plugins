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
| [`dsh-plugin-repo`](packages/dsh-plugin-repo) | `packages/dsh-plugin-repo` | 把本仓库注册为 DSH 插件安装源：目录查询（Gitea API）、安装 spec 生成、一键安装（`ctx.pluginRepo`）+ 设置里的「插件仓库」独立分区（在线列表/安装/更新/卸载） |
| [`dsh-plugin-skills`](packages/dsh-plugin-skills) | `packages/dsh-plugin-skills` | 技能能力：设置里的「技能能力」分区，管理本地 skills（列表/新建/编辑/删除/导入/模型可见开关，`ctx.skillManager`） |
| [`dsh-plugin-session-archive`](packages/dsh-plugin-session-archive) | `packages/dsh-plugin-session-archive` | 会话归档：设置里的「会话归档」分区，基于官方 `ctx.workspaceRegistry` 归档集实现归档/还原/删除（`ctx.sessionArchive`） |

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
   - `peerDependencies` 中声明 `"@deepseek-ai/dsh": "<精确运行时版本>"`（可用
     `dsh --version` 查询），DSH 安装与启动会据此做版本兼容检查；用到的
     harness 包（`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-*`）
     同样以精确范围声明为 peer，由 DSH 运行时解析器供应；
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

插件以 `peerDependencies["@deepseek-ai/dsh"]` 声明支持的 DSH 运行时版本
（精确版本，如 `0.2.0-rc.2`）。安装和 profile 启动会检查该范围；不兼容的
插件需要用户通过 `dsh plugin allow-version`（或 Web 插件页）按「插件版本 +
DSH 版本」精确豁免后才可运行。

## 路线图

- [x] `dsh-plugin-repo`：宿主服务（catalog / spec / install）
- [x] 设置里的「插件仓库」独立分区：在线列表查看、安装、更新、卸载（浏览器半区）
- [ ] `plugin_repo` agent 工具（目录搜索 + 安装，需评估启用策略）
- [ ] 更多业务插件（session-manager 等迁入）
