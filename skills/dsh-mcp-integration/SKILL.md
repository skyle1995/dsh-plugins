---
name: dsh-mcp-integration
description: 在 DSH 中增加或修改 MCP 预设、stdio/streamable-http 接入、配置持久化或运行时服务投影时使用。检查参数、凭据和卸载清理。普通 REST API 与无关前端页面不使用。
license: MIT
metadata:
  version: "1.0.0"
  category: integration
---

# DSH MCP 集成开发

## 定位既有接入面

1. 在 dsh-plugins 阅读 `packages/dsh-plugin-mcp/README.md`、
   `lib/index.js`、`src/client/index.tsx` 和预设定义。
2. 区分用户保存的配置、在线预设缓存和 loader 的运行时投影。
3. 复用宿主 `@deepseek-ai/dsh-mcp-client` 桥接；不要为一个预设引入
   第二套 MCP 客户端或自建凭据存储。

## 传输与预设

- stdio 分开保存命令、参数数组和环境变量，不拼接 shell 命令字符串。
- 验证命令来源与平台适用性；Windows/macOS 的可执行名称和参数可能不同。
- streamable-http 使用经过验证的 HTTP(S) URL，不把 URL 内嵌密码写入日志。
- 预设说明功能、必填参数、外部依赖和支持平台，缺少凭据时不得自动启用。
- 仅在已核实宿主支持的地方使用 `$env:`、`$file:` 动态引用；
  不假设预设字段会被 shell 展开。
- 不为了完成验证启动未知下载程序、真实远程服务或需要用户付费的实例。

## 状态一致性

1. 校验输入后原子保存；写盘失败时内存状态保持原值。
2. 状态、缓存和投影保持职责分离，不把在线预设直接当作已安装服务器。
3. 投影请求合并执行；投影期间的新变更必须补做，不能因重入而丢失。
4. 手工 `cordis.patch.yml` 条目按现有只读策略处理，不覆盖用户配置。
5. 保持服务器名称与 `mcp__<name>__<tool>` 工具命名约定兼容，
   改名时检查是否影响已有会话和工具引用。
6. 卸载取消远程刷新、计时器及关联资源，晚到的响应不得再次写缓存或投影。

## 回归与交付

- 在根 `demo-test/other-plugins.test.mjs` 或同目录新文件覆盖保存失败、
  投影重入、刷新合并、卸载取消、占位参数拦截及凭据脱敏。
- 使用真实服务及 loader 替身，不连接真实 MCP 服务器。
- 修改客户端同步国际化文案和预构建 `lib/client.js`。
- 仅新增在线预设时，先核实其更新是否无需升级插件；
  修改插件逻辑时同步类型、版本及根日志。
- 交付说明哪些配置已离线验证、哪些服务器需要用户授权后才能实测。
