# dsh-plugin-session-archive

**会话归档**：设置面板里的归档会话管理插件。独立「会话归档」分区
（settings.section），提供会话的 **归档 / 还原 / 删除**。

## 功能

- **列表**：只显示已归档的会话，按标题排序、支持搜索；每行显示标题、
  会话 id 与所属工作区（项目）；归档操作请使用会话列表里的官方归档入口
  （本页只做归档后的管理）；
- **还原**：从归档集移除，会话立即回到会话列表的原位置（官方
  `unarchiveSession`，归档不清 workspace 记账，还原回到原分组位置）；
- **删除**：永久删除——从归档集移除、从所属工作区记账中 detach，并删除
  `sessions` 根目录下的会话文件与 projcache 标题缓存（有确认弹窗）。

标题读取自 `storages/session_projcache/sessions/<sid>.json` 的投影缓存
（与 dsh-controller 相同的方式），缺失时显示「(无标题)」。

## 架构

- **宿主半区**（纯 ESM，无构建）：注入官方 `workspaceRegistry` 服务
  （`ctx.sessionArchive`），注册 `/api/dsh-session-archive/*` 路由；路径段
  编码复刻官方 `encodeSegment`（`~XXXX` 转义）用于定位会话目录；
- **浏览器半区**（预构建 `lib/client.js`）：`settings.section` 分区，消费
  上述路由；修改 `src/client/` 后运行
  `pnpm --filter dsh-plugin-session-archive build:client` 再提交。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `sessionsDir` | `""`（自动） | 会话根目录；留空时用 `$DSH_HOME/sessions`（或 `~/.dsh/sessions`） |

## 安装

```bash
dsh plugin --profile web add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-session-archive"
```

安装后重启 Web GUI，设置面板左侧导航会出现「会话归档」分区。

## 约定与限制

- 归档是**注册表级隐藏**（不移动文件），与官方 workspace 归档语义完全
  一致；会话文件始终留在原目录。
- 删除是不可逆的文件级操作：仅建议对已归档会话执行。
- 本插件依赖 profile 组合中的 `@deepseek-ai/dsh-workspace`（随附 Web
  profile 已挂载）；缺少时插件保持未激活。
