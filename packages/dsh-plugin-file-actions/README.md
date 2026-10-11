# dsh-plugin-file-actions

**DSH 文件列表增强插件**：给 Web GUI 右侧的「文件」标签页（`workspace.files`
文件树）加上文件管理器式的操作能力——右键菜单与批量操作。

| 能力 | 说明 |
|---|---|
| **剪切 / 复制 / 粘贴** | 右键文件或目录 → 剪切/复制，进入模块级剪贴板（剪切项半透明标记）；右键目录、文件树空白处或文件树顶部「粘贴」按钮 → 粘贴（剪切即移动，同名冲突会报错） |
| **删除** | 右键或批量栏「删除」，弹红色确认弹窗（需勾选「已知晓不可恢复」）；选中后按 `Delete` 键同样进入确认 |
| **多选** | 按住 `⌘/Ctrl` 点击行切换选中（高亮 + ✓ 标记）；批量操作栏悬浮在窗口底部，支持剪切/复制/压缩/复制路径/删除/取消 |
| **压缩** | 单个或多个选中项 → 打包为 `.zip`（单源用 `<名字>.zip`，多源 `archive.zip`，重名自动加 `(2)` 后缀）；内置无依赖 ZIP 写入器（deflate + CRC32，UTF-8 文件名，符号链接与超大文件跳过并计数） |
| **复制路径** | 把选中项的绝对路径（多项按行拼接）写入系统剪贴板 |

全部操作走宿主半区 `/api/dsh-file-actions/{copy,move,delete,compress}` 路由，
成功/失败均有 Toast 反馈；文件树依赖官方目录监听自动刷新。

## 安全模型

- 写操作**只允许发生在会话工作区内**：宿主按请求里的工作区根匹配 live 会话
  （或沙箱根兜底），并用官方 `fs` 服务的 `contains` 逐条校验，越界一律拒绝；
- 工作区根目录本身禁止删除/移动；复制/移动禁止进入自身；
- 复制/移动目标必须是工作区内已存在的目录，同名冲突整体报错（不做部分写入）；
- 跨设备移动（`EXDEV`）自动退化为复制 + 删除。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `maxZipFileBytes` | `268435456`（256MB） | 压缩时单文件大小上限，超限跳过并计入 skipped |

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: file-actions
  name: 'dsh-plugin-file-actions'
  config:
    maxZipFileBytes: 536870912
```

## 安装

```bash
dsh plugin --profile <profile> add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-file-actions"
```

开发调试时也可以用本地路径：

```bash
dsh plugin --profile <profile> add /path/to/dsh-plugins/packages/dsh-plugin-file-actions
```

## 开发

- 宿主半区（零构建）：`lib/index.js`、`lib/file-actions.js`、`lib/zip.js`；
- 浏览器半区：`src/client/index.tsx` → `pnpm build:client`（esbuild 预构建为
  `lib/client.js`，React 与 `@deepseek-ai/*` 保持外部化）；
- 冒烟测试（脱离 profile，真实 cordis + 桩服务 + 临时目录 + ZIP 自解析）：
  `pnpm smoke`。

## 服务使用

```js
// 任意同 profile 的宿主插件（注入 fileActions 服务）：
const { name } = await ctx.fileActions.compressEntries({
  workspaceRoot: "/path/to/workspace",
  sources: ["/path/to/workspace/docs"],
  destination: "/path/to/workspace",
});
```
