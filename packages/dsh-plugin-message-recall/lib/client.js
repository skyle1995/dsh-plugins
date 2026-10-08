window.__ModuleLoader__.load({
  id: "dsh-plugin-message-recall",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/dsh-plugin-message-recall/src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  register: () => register
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var NS = "dsh-plugin-message-recall";
var API = "/api/dsh-message-recall";
var zh = {
  "action.recall": "\u64A4\u56DE",
  "action.title": "\u64A4\u56DE\u8FD9\u8F6E\u5BF9\u8BDD\u5E76\u8FD8\u539F\u8BE5\u8F6E\u6587\u4EF6\u53D8\u66F4",
  "action.copy": "\u590D\u5236",
  recallConfirmTitle: "\u64A4\u56DE\u6D88\u606F",
  recallConfirm: "\u5C06\u5220\u9664\u8FD9\u6761\u6D88\u606F\u53CA\u8BE5\u8F6E\u5BF9\u8BDD\uFF08\u52A9\u624B\u56DE\u590D\u4E0E\u5DE5\u5177\u8C03\u7528\uFF09\uFF0C\u5E76\u8FD8\u539F\u8BE5\u8F6E\u5BF9\u5DE5\u4F5C\u533A\u6587\u4EF6\u6240\u505A\u7684\u4FEE\u6539\u3002\u64A4\u56DE\u540E\u8FD9\u4E9B\u5185\u5BB9\u4E0D\u518D\u663E\u793A\u5728\u4F1A\u8BDD\u8BB0\u5F55\u4E2D\uFF0C\u4E5F\u4E0D\u518D\u8FDB\u5165\u6A21\u578B\u4E0A\u4E0B\u6587\u3002",
  recallAcknowledge: "\u6211\u5DF2\u77E5\u6653\u64A4\u56DE\u4F1A\u5220\u9664\u8BE5\u8F6E\u5BF9\u8BDD\u5E76\u8FD8\u539F\u6587\u4EF6\u53D8\u66F4",
  recallCancel: "\u53D6\u6D88",
  recallConfirmAction: "\u64A4\u56DE",
  recallFailed: "\u64A4\u56DE\u5931\u8D25\uFF1A{message}"
};
var en = {
  "action.recall": "Recall",
  "action.title": "Recall this turn and revert its file changes",
  "action.copy": "Copy",
  recallConfirmTitle: "Recall message",
  recallConfirm: "This message and its turn (the assistant reply and tool calls) will be deleted, and the turn's workspace file changes will be reverted. The recalled content will no longer appear in the transcript or the model context.",
  recallAcknowledge: "I understand the turn will be deleted and file changes reverted",
  recallCancel: "Cancel",
  recallConfirmAction: "Recall",
  recallFailed: "Recall failed: {message}"
};
function format(text, params) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
var pendingRecall = null;
var listeners = /* @__PURE__ */ new Set();
function requestRecall(sessionId, messageId) {
  pendingRecall = { sessionId, messageId };
  for (const listener of listeners) listener();
}
function settleRecall() {
  pendingRecall = null;
  for (const listener of listeners) listener();
}
function usePendingRecall() {
  const [state, setState] = (0, import_react.useState)(pendingRecall);
  (0, import_react.useEffect)(() => {
    const listener = () => setState(pendingRecall);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
var css = `
.mru{display:flex;flex-direction:column;align-items:flex-end;gap:2px;position:relative;padding:2px 0}
.mru-bubble{max-width:82%;min-width:0;background:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-1,#f5f7fa));border:.5px solid var(--dsw-alias-border-l3,#e3e6ea);border-radius:14px;padding:9px 13px}
.mru-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65;color:var(--dsw-alias-label-primary,#1f2329)}
.mru-images{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.mru-images img{max-width:220px;max-height:160px;border-radius:8px;object-fit:cover}
.mru-refs{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a919c);overflow-wrap:anywhere}
.mru-actions{display:flex;gap:2px;align-items:center;opacity:0;transition:opacity .12s ease}
.mru:hover .mru-actions{opacity:1}
.mru-btn{appearance:none;border:none;background:0 0;color:var(--dsw-alias-label-tertiary,#8a919c);cursor:pointer;width:28px;height:28px;border-radius:var(--dsw-radius-sm,6px);justify-content:center;align-items:center;padding:5px;display:inline-flex}
.mru-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f0f2f5);color:var(--dsw-alias-label-secondary,#4b5563)}
`;
function RecallUserNodeView(props) {
  const { node, t, requestRecall: requestRecall2 } = props;
  const [hover, setHover] = (0, import_react.useState)(false);
  const [copied, setCopied] = (0, import_react.useState)(false);
  const data = node?.data ?? {};
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks.filter((block) => block?.type === "text").map((block) => block.text).join("\n");
  const images = blocks.filter((block) => block?.type === "image" && typeof block.image?.preview?.url === "string");
  const labels = Array.isArray(data.referenceLabels) ? data.referenceLabels : [];
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {
    });
  };
  return (0, import_react.createElement)(
    "div",
    {
      className: "mru",
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false)
    },
    (0, import_react.createElement)(
      "div",
      { className: "mru-bubble" },
      text !== "" ? (0, import_react.createElement)("div", { className: "mru-text" }, text) : null,
      images.length > 0 ? (0, import_react.createElement)("div", { className: "mru-images" }, images.map((block, index) => (0, import_react.createElement)("img", { key: index, src: block.image.preview.url, alt: block.image.name ?? "" }))) : null,
      labels.length > 0 ? (0, import_react.createElement)("div", { className: "mru-refs" }, labels.join(" \xB7 ")) : null
    ),
    hover || copied ? (0, import_react.createElement)(
      "div",
      { className: "mru-actions" },
      (0, import_react.createElement)("button", { className: "mru-btn", type: "button", title: t("action.recall"), "aria-label": t("action.recall"), onClick: () => requestRecall2(data.id) }, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })),
      (0, import_react.createElement)("button", { className: "mru-btn", type: "button", title: t("action.copy"), "aria-label": t("action.copy"), onClick: copy }, copied ? (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 }) : (0, import_react.createElement)(import_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 }))
    ) : null
  );
}
function RecallAction({ messageId, requestRecall: open, t }) {
  const style = {
    width: "calc(28px + var(--dsh-content-font-delta, 0px))",
    height: "calc(28px + var(--dsh-content-font-delta, 0px))",
    borderRadius: "var(--dsw-radius-sm)",
    color: "var(--dsw-alias-label-tertiary)",
    cursor: "pointer",
    background: "0 0",
    border: "none",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    display: "inline-flex"
  };
  return (0, import_react.createElement)("button", {
    type: "button",
    title: t("action.title"),
    "aria-label": t("action.recall"),
    style,
    onClick: () => open(messageId),
    onMouseEnter: (event) => {
      event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)";
      event.currentTarget.style.color = "var(--dsw-alias-label-secondary)";
    },
    onMouseLeave: (event) => {
      event.currentTarget.style.background = "";
      event.currentTarget.style.color = "";
    }
  }, (0, import_react.createElement)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 15 }));
}
function RecallConfirmDialog({ t, usePendingRecall: usePending, settleRecall: settle, confirmRecall }) {
  const request = usePending();
  const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (request !== null) setAcknowledged(false);
  }, [request]);
  return (0, import_react.createElement)(import_dsh_client_ui_primitives.RiskConfirmation, {
    open: request !== null,
    title: t("recallConfirmTitle"),
    description: t("recallConfirm"),
    acknowledgeLabel: t("recallAcknowledge"),
    cancelLabel: t("recallCancel"),
    confirmLabel: t("recallConfirmAction"),
    acknowledged,
    onAcknowledgedChange: setAcknowledged,
    onCancel: settle,
    onConfirm: () => {
      const target = request;
      settle();
      if (target !== null) confirmRecall(target.sessionId, target.messageId);
    }
  });
}
function apply(ctx) {
  register(ctx);
}
var inject = [
  "slots",
  "locale"
];
function register(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "message-recall: dictionaries");
  const t = ctx.locale.bind(NS);
  const confirmRecall = (sessionId, messageId) => {
    void fetch(`${API}/recall`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sessionId, messageId })
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        globalThis.alert(format(t("recallFailed"), { message: payload.message ?? `HTTP ${response.status}` }));
        return;
      }
      if (payload.value?.live !== true) globalThis.location.reload();
    }).catch((error) => {
      globalThis.alert(format(t("recallFailed"), { message: error.message }));
    });
  };
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "user",
    priority: -1,
    locale: NS,
    inject: (sessionId) => ({
      requestRecall: (messageId) => requestRecall(sessionId, messageId)
    })
  }, (props) => (0, import_react.createElement)(RecallUserNodeView, props)));
  ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
    name: "conversation.chat.assistant-actions",
    id: "recall",
    order: 30,
    locale: NS,
    inject: (sessionId) => ({
      requestRecall: (messageId) => requestRecall(sessionId, messageId)
    })
  }, RecallAction));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "message-recall-confirm",
    locale: NS,
    inject: () => ({ usePendingRecall, settleRecall, confirmRecall })
  }, RecallConfirmDialog));
  ctx.effect(() => {
    if (typeof document === "undefined") return;
    const style = document.createElement("style");
    style.textContent = css;
    style.setAttribute("data-dsh-plugin", "dsh-plugin-message-recall");
    document.head.appendChild(style);
    return () => style.remove();
  }, "message-recall: styles");
}

    return module.exports;
  }
});
