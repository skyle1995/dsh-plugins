# dsh-plugin-file-actions

**DSH 文件列表增强插件**：给 Web GUI 右侧的「文件」标签页（`workspace.files`
文件树）加上文件管理器式的操作能力——右键菜单与批量操作。

| 能力 | 说明 |
|---|---|
| **编辑** | 单选文件右键菜单最上方的「编辑」：在右侧栏新建编辑 tab（与官方预览同栏）——编辑态实时语法高亮（DSH 自带 shiki，与官方预览同源；窗口化解析——大文件同样高亮且不卡）、行号、Tab 缩进、可选「自动换行」（工具栏开关，换行时高亮层同宽软换行、行号自动隐藏）、加宽的原生滚动条（14px 主题化）；快捷键 ⌘/Ctrl+S 保存、⌘/Ctrl+F 搜索、⌘/Ctrl+H 替换、⌘/Ctrl+G 跳转行；编辑框右键菜单（撤销/重做/剪切/复制/粘贴/全选/搜索/替换/跳转/格式化/保存）；恢复原始、重新加载、未保存关闭提示；内置「一键格式化」（prettier 按扩展名识别 JS/TS/JSX/JSON/CSS/HTML/Vue/Markdown/YAML/GraphQL 等） |
| **剪切 / 复制 / 粘贴** | 右键文件或目录 → 剪切/复制，进入模块级剪贴板（剪切项半透明标记）；右键目录、文件树空白处或文件树顶部「粘贴」按钮 → 粘贴（剪切即移动，同名冲突会报错） |
| **重命名** | 单选文件或目录右键「重命名」，或按 `F2` → 弹输入框（预填原名，并预选主名不含扩展名，与资源管理器一致）；`Enter` 确认 / `Esc` 取消；只接受宿主平台合法的单段名字（`/` 拒绝，Windows 还拒绝 `\`），保留 POSIX 名字中的空格及反斜杠；目标同名会报错，独立硬链接也不能覆盖，工作区根目录不可重命名 |
| **删除** | 右键或批量栏「删除」，弹红色确认弹窗（需勾选「已知晓不可恢复」）；选中后按 `Delete` 键同样进入确认 |
| **多选（含范围选择）** | 按住 `⌘/Ctrl` 点击行切换单行选中；`Shift` 点击选中「锚点到该行」的连续区间（`⌘/Ctrl+Shift` 并入已有选择）——不必按住修饰键一个个点；批量操作栏悬浮在窗口底部，支持重命名（仅单选项）/剪切/复制/压缩/复制路径/删除/取消；多选操作完成后自动清除选择 |
| **压缩** | 单个或多个选中项 → 弹出命名输入框（自动填充 `<名>.zip` / `archive.zip`）→ 打包为 `.zip`（重名自动加 `(2)` 后缀）；内置无依赖 ZIP 写入器（deflate + CRC32，UTF-8 文件名，符号链接与超大文件跳过并计数） |
| **复制路径** | 把选中项的绝对路径（多项按行拼接）写入系统剪贴板；Windows 盘符及反斜杠路径统一使用 `\`，macOS/Linux 路径保持原样 |

全部操作走宿主半区 `/api/dsh-file-actions/{copy,move,rename,delete,compress,read,save,format}`
路由，成功/失败均有 Toast 反馈；文件树依赖官方目录监听自动刷新。

## 安全模型

- 写操作**只允许发生在会话工作区内**：宿主按请求里的工作区根匹配 live 会话
  （或沙箱根兜底），并用官方 `fs` 服务的 `contains` 逐条校验，越界一律拒绝；
- 工作区根目录本身禁止删除/移动/重命名；复制/移动禁止进入自身；
- 重命名只接受单段名字：路径分隔符、空名、`.`/`..`、含 NUL 一律在宿主端拒绝；
  Windows 额外拒绝保留名、控制字符、非法字符和末尾点/空格，不把这些限制强加给
  macOS/Linux；大小写不敏感卷上「仅改大小写」按同一 inode 放行；
- 复制/移动目标必须是工作区内已存在的目录，按目标卷实际大小写和 Unicode
  等价规则预检同名冲突；重复路径及同时选中的父子项合并处理；
- 同一工作区的插件写请求串行执行；复制显式禁止覆盖。预检冲突不写入业务文件，
  但执行期间的权限/磁盘等失败仍可能部分完成，错误的 `details` 返回已完成源、
  当前失败源及目标，不承诺整个批次具有事务性。外部程序不受插件锁约束；
- 仅跨设备移动（`EXDEV`）退化为复制 + 删除，权限及文件占用错误不触发删除；
- 文本读取、保存和格式化受 `maxEditBytes` 上限约束，拒绝含 NUL 或非法 UTF-8
  的编辑输入，格式化保留输入换行风格；
- 编辑器保存携带读取时的 SHA-256 版本，检测到外部修改返回 `409`；
  保存使用同目录临时文件写入、同步后替换，保留 Unix 模式权限，不采用先删原文件的回退。
  旧宿主服务调用不传 `version` 时保持兼容，建议始终传递；外部程序在最后校验与替换间
  的极短竞争窗口无法通过标准文件系统 API 完全消除；
- ZIP 逐文件流式压缩写出，限制总输入、条目数与经典 ZIP 字段范围；
  排除当前压缩临时目录，失败自动清理。保留 UTF-8 文件名和 Unix 执行位，
  已完成压缩包优先排他硬链接发布，exFAT 等不支持硬链接的卷回退排他复制；
- 编辑器忽略过期读取/格式化结果，保存期间的新输入不会被标记为已保存；
  页面关闭或刷新有未保存保护，关闭插件标签页仍是关闭后的提醒；
- HTTP 请求体读取时限制大小（`6 * maxEditBytes + 65536` 字节），超限返回 `413`；
  压缩包名与保存内容在宿主端再次净化/校验（防路径穿越）。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `maxZipFileBytes` | `268435456`（256MB） | 压缩时单文件大小上限，超限跳过并计入 skipped |
| `maxEditBytes` | `1048576`（1MB） | 文本编辑（读取/保存）的文件大小上限 |
| `maxZipTotalBytes` | `1073741824`（1GB） | 压缩总输入大小上限，超限终止并清理 |
| `maxZipEntries` | `10000` | 压缩条目上限（含目录，最多 65535） |
| `maxBatchPaths` | `1000` | 单次批量操作提交路径数量上限 |

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: file-actions
  name: 'dsh-plugin-file-actions'
  config:
    maxZipFileBytes: 536870912
    maxEditBytes: 2097152
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
  唯一运行时依赖为 `prettier`（一键格式化，纯 JS 无构建脚本，随插件自动安装）；
- 浏览器半区：`src/client/index.tsx` → `pnpm build:client`（esbuild 预构建为
  `lib/client.js`，React 与 `@deepseek-ai/*` 保持外部化）；
- 冒烟测试（脱离 profile，真实 cordis + 桩服务 + 临时目录 + ZIP 自解析）：
  `pnpm smoke`。
- 跨平台回归测试：`pnpm test`，新增测试和临时工作区均在仓库根 `demo-test/`，
  覆盖 Windows 名称、macOS/POSIX 路径、目标卷大小写与 Unicode、保存冲突、
  流式 ZIP、HTTP 限制以及编辑器异步交互。该命令可在 Windows/macOS/Linux 运行；
  当前只在 Windows 本机执行，macOS/Linux 真机仍需运行验证。
- `0.2.3` 统一 Windows 混合分隔符及扩展 UNC 根解析；工作区和编辑标签使用
  规范路径比较，不因分隔符或末尾斜杠变化清空剪贴板或生成重复标签。
  粘贴拒绝跨工作区，旧请求不清空后来设置的剪贴板，部分移动失败剔除已完成源。
- 浏览器交互测试页：仓库根运行 `node demo-test/file-actions-browser.mjs`，按打印的
  本地地址打开。使用真实 React 编辑器与平台/API 桩，点击「格式化」、继续输入，
  再点「完成格式化」检查新内容未被覆盖；保存并重新加载确认内容。结束按 `Ctrl+C`
  释放测试服务端口，不替代真实 DSH profile 的集成测试。

## 服务使用

```js
// 任意同 profile 的宿主插件（注入 fileActions 服务）：
const { name } = await ctx.fileActions.compressEntries({
  workspaceRoot: "/path/to/workspace",
  sources: ["/path/to/workspace/docs"],
  destination: "/path/to/workspace",
});

// 文本编辑三件套：
const { content, version } = await ctx.fileActions.readTextEntry({ workspaceRoot, path });
const { content: formatted } = await ctx.fileActions.formatTextEntry({ workspaceRoot, path, content });
await ctx.fileActions.saveTextEntry({ workspaceRoot, path, content: formatted, version });
```
