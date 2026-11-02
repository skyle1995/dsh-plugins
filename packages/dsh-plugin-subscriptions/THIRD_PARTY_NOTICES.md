# 第三方开源声明（Third-Party Notices）

> 本文件记录本目录代码的来源、许可证与相对上游的全部改动。上游为 MIT 许可，
> 本仓库的分发遵从其署名与许可保留要求。

## 一、来源

| 项目 | 值 |
|---|---|
| 上游仓库 | <https://github.com/V1ki/dsh-plugin-subscriptions> |
| 上游版本 | `0.9.12`（`package.json`） |
| 上游提交 | `b8023110864494acefc6f5963c2a197d85dda20c`（2026-10-29，`fix: simplify DSH prerelease compatibility and release v0.9.12`） |
| 许可证 | MIT，Copyright (c) 2026 V1ki（见同目录 [LICENSE](LICENSE)，逐字保留） |
| 上游 npm 包 | [`dsh-plugin-subscriptions`](https://www.npmjs.com/package/dsh-plugin-subscriptions) |
| 功能 | 把 ChatGPT(Codex) / Claude / Grok(X Premium) / GitHub Copilot / Google Antigravity 订阅接入 DSH 作为 LLM provider：Web 设置页 OAuth 登录、模型目录、用量显示、图像/视频生成与 X 搜索工具 |

## 二、判定：上游是「本地实现」

移植前核对：上游仓库自带完整实现，不是对远程服务或未公开二进制的薄封装。

- `src/` 68 个文件、约 20 700 行 TypeScript/TSX（OAuth 流程、PKCE、设备码、
  JWT 解析、五个 provider 适配器、SSE 翻译层、账号池、模型目录、RPC 通道、
  设置页 UI、工具注册）；
- `test/` 63 个 spec，共 648 条用例，全部在本仓库通过；
- 构建全在本地完成（`tsc` 产出宿主半区 ESM + `.d.ts`，`tsdown` 产出浏览器
  bundle），不依赖上游服务器；运行时只访问各订阅服务商的公开 API。

因此按本仓库约定整体移植源码（`src/`、`test/`、`scripts/`、`docs/`、构建配置），
并把构建产物 `lib/` 一并提交。

## 三、相对上游的改动清单

代码逻辑**零改动**：`src/` 与上游 `b802311` 逐字节一致（`diff -rq` 无差异）。
改动全部在打包与仓库集成层面：

| 文件 | 改动 |
|---|---|
| `package.json` | `repository` 指向本仓库（`hub.ifunx.com/skyle1995/dsh-plugins`，`directory: packages/dsh-plugin-subscriptions`）；删除 `prepare`（git 安装不再现场构建，改为直接使用已提交的 `lib/`）；`files` 增加 `README.md`；`exports` 增加 `./cordis.patch.yml`（与其他插件一致）；删除 `packageManager`（沿用工作区）；依赖版本、`dsh.bundle`、`dsh.client`、`peerDependencies` 与上游一致 |
| `pnpm.packageExtensions` | 从本包 `package.json` 移到工作区根 `pnpm-workspace.yaml`：monorepo 里 pnpm 只读取工作区根的扩展声明，缺了它本包单测加载 `@deepseek-ai/dsh-client-ui-primitives` 时会缺 `clsx` 等浏览器依赖 |
| `.gitignore` | 不再忽略 `lib/`（构建产物提交进仓库，符合本仓库「发布即源码」约定）；仍忽略 `lib-test/`（单测编译产物） |
| `README.md` / `README.zh.md` | 顶部新增本移植说明；截图链接从上游 `raw.githubusercontent.com` 改为仓库内相对路径 `docs/images/*`，其余原文保留 |
| `.github/workflows/release.yml` | 未移植（本仓库不使用 npm Trusted Publishing 发布流程） |
| `lib/`（新增） | 由 `pnpm build`（`tsc && tsdown`）在本仓库生成：宿主半区 ESM + `.d.ts`（68 个声明文件）、浏览器半区 `lib/client.js`（`window.__ModuleLoader__.load({ id: "dsh-plugin-subscriptions", … })` 外壳） |

## 四、许可证与再分发

- 上游 MIT 许可证全文随包保留在 [LICENSE](LICENSE)，未修改版权行。
- 本目录继续以 MIT 分发；`lib/` 是上游源码的编译产物，其版权仍归上游作者。
- 上游第三方依赖（`undici`、`react`、`tsdown` 等）的许可证随各自 npm 包携带，
  不属于本文件范围。

## 五、本仓库补丁记录（0.9.13）

本包版本号在移植时为 `0.9.12`（与上游一致），此后累积了下列本地修复，因此按补丁号递增：
**`0.9.13`**、**`0.9.14`**。每个补丁都只改本仓库的 `src/`、`test/`、`lib/` 与文档，
上游源码语义未被改写；同步上游新版本时按此表逐条重放即可。

| 版本 | 提交 | 修复 |
|---|---|---|
| 0.9.13 | `16b06e9` | 用量窗口按模型选择过滤（服务商级 `visibleModels`）；`REGION_BLOCKED` 识别（Google 400 / OpenAI 403 / Claude 403 的地区拒绝），不再误判 AUTH、不再重试，按账号短冷却 |
| 0.9.13 | `d7451b6` | 同一过滤接入**账号级**模型选择（`poolModels`）：`status` 端点回传每个账号的模型列表，设置页与用量胶囊同时生效 |
| 0.9.13 | `791acc0` | Antigravity 目录：`displayName` 撞名时按 id 命名、`tab_*`/`chat_*` 通道不进选择器、按名字排序、合并后仍保证唯一；`CatalogSnapshot.version` 使旧缓存自动失效 |
| 0.9.13 | `619fab6` | Antigravity 额度：多个模型上报相同数值+重置时刻时合并为一行账户级窗口；`已用 x% · 剩余 y%` 标注方向并保留一位小数；账户级窗口对所有模型生效 |
| 0.9.14 | `4bf968a` | 窗口按**重置时间跨度**标注「5 小时窗口」/「每周」（此前两条都叫「窗口」）；`pnpm test` 改为在临时 DSH home 下运行，避免本机 `proxy.json` 让 `globalThis.fetch` 的桩失效 |
| 0.9.15 | 本次 | 会话胶囊只显示**重置最近**的窗口，且方向与其它服务商一致读**已用**（`Antigravity 5 小时窗口 已用 0%`）；设置页仍保留 `已用/剩余` 双向标注 |

补丁涉及的源码文件（相对上游）：`src/providers/antigravity.ts`、`scripts/run-tests.mjs`、
`src/providers/common.ts`、`src/providers/pool-health.ts`、`src/providers/catalog-store.ts`、
`src/auth/rpc.ts`、`src/index.ts`、`src/client/{usage-window-filter.ts,SubscriptionsSection.tsx,SubscriptionUsageBadge.tsx,locales.ts}`。
对应单测在 `test/` 内同文件旁，`pnpm test` 覆盖。
