# dsh-plugin-mcp

DSH 设置面板里的 **MCP 服务器管理器**：可视化增删改 / 启停外部 MCP 服务器，
无需手写 cordis.patch.yml。

DSH 运行时（0.2.0-rc.2）内置 [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/mcp/mcp-client)
——每台 MCP 服务器是 cordis 树里一条该模块的条目，工具以
`mcp__<serverName>__<tool>` 形式注册给模型。本插件不重新实现 MCP 客户端，
而是把「管理体验」打包：状态存一份 JSON，运行时投影成 loader 树里的受管
条目（id 前缀 `mcp-managed-`）。

## 安装

```bash
dsh plugin --profile <profile> add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-mcp"
```

安装后重启 profile（或热重载插件），打开设置面板即可看到「MCP 服务器」分区。

## 使用

分区用两个标签页分页展示：**「已安装」**（受管服务器 + 手工 cordis.patch.yml
条目）与**「预设」**（一键添加）。没有已安装服务器时默认落在预设页；预设
直存成功后自动切回已安装页。

- **热门预设（一键添加）**：内置 42 个常用 MCP 服务器预设，按**八个分类**
  分组展示（分类 chips 位于搜索框下方第二行），支持**搜索**（名称 / 描述）
  与分类筛选。预设目录**在线更新**：默认从 dsh-plugins 仓库拉取
  `presets.json`（成功后落盘缓存、断网回退缓存 / 内置），新增预设只需更新
  仓库文件、无需升级插件；面板显示预设源与更新时间，可点「刷新预设」手动拉取：
  - **通用开发**：GitHub、Filesystem、Memory、Sequential Thinking、Time、Fetch、
    Brave Search、Puppeteer、Slack、Sentry、PostgreSQL、SQLite、Everything；
  - **代码托管**：GitLab、Gitea（官方，自建实例支持——GITEA_HOST 填你的地址）；
  - **浏览器 / Web**：Playwright、Chrome DevTools（官方）；
  - **搜索 / 情报**：Tavily、Firecrawl、urlscan.io、Context7；
  - **云服务**：Cloudflare、Supabase、Kubernetes；
  - **逆向 / 安全分析**：Reqable 抓包、IDA Pro 官方、Ghidra、Binary Ninja、
    Frida、JADX、VirusTotal、x64dbg、CyberChef。
  - 零配置预设点「一键添加」直接保存并生效；
  - 需要密钥 / 路径的预设（Token、自建地址、允许目录等）会先把配置**预填进弹窗表单**，
    补全必填项后保存——占位值在宿主侧会被拦截，无法带占位符保存；
  - 已添加（受管或手工同名）的预设标记「已添加」，防止重复。
- **添加 / 编辑服务器（弹窗）**：新增与编辑都在居中弹窗里完成（点遮罩 /
  ✕ / 取消关闭），表单就出现在操作位置，不会跑到页面顶部。填写
  `serverName`（工具命名空间，`mcp__<name>__<tool>`），选择传输方式——
  `stdio`（本地进程：命令 / 参数 / 环境变量 / 工作目录）或 `streamable-http`
  （远程：URL / 请求标头）。
- **启停 / 编辑 / 删除**：立即生效——保存即持久化到状态文件，并实时
  创建 / 更新 / 移除对应的 mcp-client 条目（连接断开会自动重连，重连策略
  沿用 mcp-client 默认值）。
- **手工条目**：写在 `cordis.patch.yml` 里的 mcp-client 条目照常工作，在
  分区底部只读展示；与受管条目同名的 `serverName` 会在保存时被拦截。
- **状态徽标**：已连接 / 连接失败 / 已停止 / 连接中 / 待创建 / id 冲突。

## 数据与持久化

- 状态文件：`<profileDir>/mcp-servers.json`（与 `cordis.patch.yml` 同级；
  可用插件配置 `stateFile` 覆盖为绝对路径）。文件权限 0600。
- **重启安全**：profile 启动时 cordis.yml 会被重置为空根，本插件激活后
  按状态文件重建全部受管条目；运行时任何树写回 / 补丁热重载后也会自动
  重新投影（幂等）。
- **卸载 / 停用插件**：受管条目在下次启动时不再重建（当前进程内最后一次
  投影的条目会随树写回保留到重启）；状态文件不会被删除，可自行清理。
- **敏感信息**：`env` / `headers` 值明文保存在状态文件（0600）里，列表接口
  已掩码；DSH 的树写回会把运行中条目配置落进 `profiles/<name>/cordis.yml`
  （运行时行为，重启即重置），请勿在共享机器上存放密钥。

## 配置

```yaml
# profile 的 cordis.patch.yml
- id: mcp-manager
  name: 'dsh-plugin-mcp'
  config:
    stateFile: /custom/mcp-servers.json   # 可选；默认 <profileDir>/mcp-servers.json
```

## 开发

```bash
pnpm install                    # 安装 devDependencies
node test/smoke.mjs             # 宿主服务冒烟测试（状态读写 / 校验 / 树投影）
pnpm --filter dsh-plugin-mcp run build:client   # 构建浏览器半区 lib/client.js
```

浏览器半区是提交进仓库的构建产物（`lib/client.js`），宿主半区零构建
（纯 ESM JS + `.d.ts`），与仓库「发布即源码」约定一致。
