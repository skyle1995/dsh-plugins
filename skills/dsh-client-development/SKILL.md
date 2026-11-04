---
name: dsh-client-development
description: 修改 DSH 插件的 React 设置面板、客户端交互、国际化文案或浏览器 bundle 时使用。同步 TSX 与预构建产物，验证异步状态及响应式布局。仅宿主 API 修改不使用。
license: MIT
metadata:
  version: "1.0.0"
  category: frontend
---

# DSH React 客户端开发

## 确认客户端接入方式

1. 阅读目标包 `src/client/`、`scripts/build-client.mjs` 和 `package.json`。
2. 检查 `dsh.client.inject`、`./client` 导出、locale 命名空间和 slot 注册。
3. 在 dsh-plugins 中可参考 `dsh-plugin-repo` 的设置分区与
   `dsh-plugin-file-actions` 的编辑器交互。其他项目先定位等价实现。

## 实现检查清单

- 使用宿主的 locale、slot、主题变量和 UI 组件约定，不捆绑第二套 React。
- 中英文文案同步，说明请求失败、加载、空列表、搜索无匹配和写入状态。
- 保留键盘可操作性；按钮使用真实 `button`，搜索框有可访问名称。
- 不只靠颜色表示选中或禁用状态；切换视图声明 `aria-pressed` 或正确的 tab 语义。
- 服务器描述作为文本渲染，不通过 HTML 注入显示。
- 长名称、完整描述、备份路径和错误文本应换行；窄屏避免横向溢出。
- 危险替换必须明确确认，说明是否影响本地修改及是否有备份。

## 异步状态防护

1. 对读取请求使用 `AbortController` 并在卸载时取消。
2. 为读取和格式化使用 generation 或版本标记；旧结果不得覆盖新输入。
3. 写入使用点击时的快照，保存期间的新输入仍保持未保存状态。
4. 禁止重复提交；`finally` 恢复状态前确认组件仍挂载。
5. 搜索、刷新、切换视图和安装成功后的重载要保留合理的用户上下文。

## 构建与验证

浏览器产物 `lib/client.js` 随包发布，源文件变更后必须重建。先读取包的
`build:client` 脚本，以下命令适用于 dsh-plugin-repo：

```sh
pnpm --filter dsh-plugin-repo build:client
node --check packages/dsh-plugin-repo/lib/client.js
```

- 检查构建仍使用宿主 `window.__ModuleLoader__.load` 外壳，
  React 和平台模块保持 external。
- 测试文件放根 `demo-test/`；可参考 `file-actions-client.test.mjs`
  的 Hook 回归与 `skill-store-browser.mjs` 的真实 React 隔离页。
- 浏览器验证加载、搜索、错误、确认、卸载和窄屏；模拟接口的结果不能
  被描述为真实安装成功。
- 测试结束显式关闭本次服务、端口与浏览器测试页。
