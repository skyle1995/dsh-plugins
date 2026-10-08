# dsh-plugin-repo

把 Gitea 上的插件 monorepo 注册为 DSH 的插件安装源，并在 Web 设置的
**插件仓库**页提供在线目录的查看、安装、更新与卸载。

DSH 的插件安装（`dsh plugin --profile <name> add <spec>` / Web 插件页）本质是
pnpm 安装，而 pnpm 11 支持 `git+https://host/owner/repo.git#<分支>&path:<子目录>`
直接从 git 仓库**子目录**安装。因此 monorepo 里的每个插件（`packages/<name>`）
天然都有可安装的 spec；本插件把它做成一等公民的「安装源」：

- **目录查询** `ctx.pluginRepo.catalog()` —— 通过 Gitea API 列出仓库内全部插件
  及版本、描述、是否组合包（`dsh.bundle.patch`）；
- **spec 生成** `ctx.pluginRepo.specFor(name)` —— 拼出可直接安装的 git spec；
- **一键安装** `ctx.pluginRepo.install(name, options)` —— 解析后转发给 profile
  的 `pluginManager.installBundle`，复用其 DSH 版本兼容预检、失败回滚、
  构建脚本批准等全部流程；
- **设置页（浏览器半区）** —— 设置 → 插件仓库：读取宿主半区注册的
  `/api/dsh-plugin-repo/catalog` 路由渲染在线目录；安装/更新/卸载走现成的
  `ctx.remote.pluginManager` 远程能力，更新即按分支 spec 重装最新提交。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `gitHost` | `https://hub.ifunx.com` | Gitea 主机根地址 |
| `owner` | `skyle1995` | 仓库所有者 |
| `repo` | `dsh-plugins` | 仓库名 |
| `branch` | `main` | 用于安装的分支 |
| `catalogDir` | `packages` | monorepo 内插件目录 |
| `token` | `""`（secret） | Gitea Access Token；公开仓库可留空 |
| `requestTimeoutMs` | `15000` | 单次 API 请求超时 |

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: plugin-repo
  name: 'dsh-plugin-repo'
  config:
    owner: my-org
    repo: my-dsh-plugins
```

## 安装本插件

本插件本身就是本仓库的一个子目录包，同样可以用 git spec 直接安装
（第一个插件无需任何引导依赖）：

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

- 仓库公开时无需 token；私有仓库需在配置中提供带读取权限的 token。
- 目录读取使用 Gitea API（`contents` 与 `raw` 端点，raw 失败时回退 base64）。
- 分支名含 `#` 或 `&` 的仓库无法生成正确 spec（pnpm fragment 语法限制）。
- 宿主半区**无构建步骤**（纯 ESM + 类型声明），避免触发 pnpm 的构建脚本
  批准流程；浏览器半区是**预构建产物** `lib/client.js`（已提交），修改
  `src/client/` 后本地运行 `pnpm --filter dsh-plugin-repo build:client` 再提交。
- 更新安装包后需重启 Web GUI：进程内替换插件包不重新加载（DSH 的 HMR
  只监视 profile manifest 与 patch 文件，不监视 node_modules 内容）。
