---
name: dsh-plugin-development
description: 开发或修改 DSH 的 Node.js 插件、Cordis 服务、宿主 API 与插件配置时使用。遵循 dsh-plugins 的发布布局、服务生命周期和跨平台约定。纯页面样式任务不使用。
license: MIT
metadata:
  version: "1.0.0"
  category: development
---

# DSH 插件开发

## 先确认工程上下文

1. 阅读目标包的 `package.json`、`cordis.patch.yml`、README 和相关实现。
2. 阅读工作区根 README 的「编写新插件的规范」；若不在 dsh-plugins
   工作区，先确认目标项目的实际路径及发布流程，不猜测目录。
3. 核对现有工作区差异，只修改任务相关行，不覆盖用户已有修改。

## 本仓库的发布约定

- 插件位于 `packages/<包名>/`，独立 npm 包声明 `type: module`。
- 宿主实现直接写入 `lib/`，类型位于 `lib/types/`；不得凭空新增宿主构建步骤。
- `main`、`exports`、`types` 和 `files` 必须包含实际发布文件。
- 使用 Cordis `Service` 时核对服务键与 `static inject`。
  `ctx.plugin()` 挂载的子服务需要独立配置与生命周期。
- `cordis.patch.yml` 声明组合包条目，包的 `dsh.bundle.patch` 指向它。
- `@deepseek-ai/dsh` 及 harness 依赖沿用现有 peer 范围，不随意提升最低版本。
- 安装来自仓库子目录的插件使用宿主已有 `pluginManager` 流程，
  不实现绕过其兼容性预检、构建批准或失败回滚的安装器。

## 配置、接口与生命周期

1. Schemastery schema、运行时默认值和 `.d.ts` 同步修改。
2. API 请求限制大小并校验结构；稳定错误码与 HTTP 状态一致。
3. token、代理密码及含凭据的 URL 不进入返回数据或日志。
4. 对计时器、监听器、网络请求、数据库和音频资源登记清理。
   服务卸载取消等待中的请求，防止异步结果再次提交状态。
5. 文件系统路径使用 `node:path`；Windows 动态导入绝对路径使用
   `pathToFileURL()`，不要将盘符路径直接传给 `import()`。
6. 新增函数、接口和类写中文文档注释，说明功能、参数与返回值。

## 验证与交付

- 在根 `demo-test/` 添加覆盖正常、失败和卸载场景的回归。
- 执行相关 `node --check`、类型检查和回归；已有测试也要覆盖受影响路径。
- 变更客户端时使用 `dsh-client-development` 的预构建流程。
- 核实当前日期后维护根 `CHANGELOG.md`，并按实际发布范围升级包版本。
- 仅在用户明确要求时提交或推送；说明已运行的检查及未实测的平台。
