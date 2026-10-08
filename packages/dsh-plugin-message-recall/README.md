# dsh-plugin-message-recall

**消息撤回插件**：撤回**一整轮对话**——删除用户消息与助手回复，并把该轮
对工作区文件的修改**一起还原**。

在**用户自己发送的消息**上（悬停气泡显示）提供「撤回」按钮，助手消息
动作行保留备用入口；点击后弹出风险确认弹窗（需勾选确认），确认后由宿主
半区执行撤回：定位该轮的 surface 范围（用户提问到轮末），还原该轮文件
变更，再用一条「消息已撤回」占位记录替换整轮（对模型与界面都可见，后续
请求不再携带被遮蔽的消息）。

## 工作原理

- **变更捕获**（`lib/capture.js` + 主服务）：监听 `tools/pre-execute`，
  在 `write` / `edit` / `str_replace_editor` 等文件工具执行前，把目标文件
  的「变更前」内容按轮次记录（与官方 workspace-changes 相同的判定口径；
  子代理会话不记录）。每轮落盘到
  `$DSH_HOME/dsh-message-recall/<编码会话 id>/turn-<轮次>.json`；
- **撤回规划**（`lib/recall.js`）：从会话事件日志定位目标消息（用户或
  助手消息均可）→ 计算该轮完整 surface 闭区间（用户提问到轮末）→
  规划文件回滚（之后轮次又改过的路径跳过、
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
