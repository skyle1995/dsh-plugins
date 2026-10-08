# dsh-plugin-message-recall

**消息撤回（编辑）插件**：撤回**该轮对工作区文件的修改**，并在会话中
插入一条撤回提示。

在**用户自己发送的消息**上（悬停气泡显示）提供「撤回」按钮；点击后弹出
风险确认弹窗（需勾选确认），确认后由宿主半区执行：定位该轮、还原该轮
文件变更（之后又被改过的路径跳过），再追加一条「已撤回第 N 轮的编辑…」
提示消息（普通追加，不折叠会话；对话消息保留在会话记录中）。

## 工作原理

- **变更捕获**（`lib/capture.js` + 主服务）：监听 `tools/pre-execute`，
  在 `write` / `edit` / `str_replace_editor` 等文件工具执行前，把目标文件
  的「变更前」内容按轮次记录（与官方 workspace-changes 相同的判定口径；
  子代理会话不记录）。每轮落盘到
  `$DSH_HOME/dsh-message-recall/<编码会话 id>/turn-<轮次>.json`；
- **撤回规划**（`lib/recall.js`）：从会话事件日志按 seq 或消息 id 轻量
  定位目标轮次（planTurn）→ 规划文件回滚（planRollback）→ 生成提示文案
  （noticeContent）；整轮折叠的 planRecall 保留为工具函数但不再使用（之后轮次又改过的路径跳过、
  oversized 跳过、absent 删文件、content 写回）→ 生成占位文案；
- **撤回引擎**（主服务）：注入 `sessions` + `sessionPersistence` 的作用域，
  支持活跃会话（live append + 持久化核实）与冷会话（直接写持久化句柄）
  两条路径；surface 替换是带 `surfaceOp: replace` 的 user/message，附带
  `sourceEventSeqs`；
- **Web 路由**：`POST /api/dsh-message-recall/recall`（`{ sessionId,
  messageId }`），仅在存在 webServer 的 profile 里注册。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `maxFileBytes` | `2097152` | 单文件捕获内容上限（字节），超限的路径只能跳过还原 |
| `capturesDir` | `""`（自动） | 捕获落盘根目录；留空用 `$DSH_HOME/dsh-message-recall` |

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: message-recall
  name: 'dsh-plugin-message-recall'
  config:
    maxFileBytes: 4194304
```

## 安装

```bash
dsh plugin --profile web add \
  "https://hub.ifunx.com/skyle1995/dsh-plugins.git#main&path:packages/dsh-plugin-message-recall"
```

安装后重启 Web GUI，助手消息动作行会出现「撤回」按钮。

## 测试

```bash
node test/smoke.mjs            # 纯逻辑（capture / recall 规划）
node test/engine.smoke.mjs     # 撤回引擎（真实 dsh-session SessionStore）
node test/persistence.smoke.mjs # 撤回引擎（真实 dsh-session-persistence-jsonl 冷路径）
node test/client.smoke.mjs     # 浏览器半区（slot 注册与请求载荷）
```

## 约定与限制

- 文件还原尽力而为：单个文件失败不影响撤回本身，占位文案会报告失败数；
- 该轮之后被再次修改的文件不会还原（避免覆盖更新的工作）；
- 已被压缩 / 撤回过的消息不能再次撤回；
- 冷会话撤回成功后页面会刷新以加载最新日志；
- 撤回不改变文件外的副作用（进程、网络、外部系统）。
