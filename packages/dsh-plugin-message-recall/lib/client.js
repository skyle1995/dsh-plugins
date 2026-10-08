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
  "action.title": "\u64A4\u56DE\u6B64\u6D88\u606F\u5E76\u8FD8\u539F\u8BE5\u8F6E\u6587\u4EF6\u53D8\u66F4",
  recallConfirmTitle: "\u64A4\u56DE\u6D88\u606F",
  recallConfirm: "\u5C06\u64A4\u56DE\u8FD9\u6761\u52A9\u624B\u56DE\u590D\u53CA\u5176\u5DE5\u5177\u8C03\u7528\uFF0C\u5E76\u8FD8\u539F\u8BE5\u8F6E\u5BF9\u5DE5\u4F5C\u533A\u6587\u4EF6\u6240\u505A\u7684\u4FEE\u6539\u3002\u64A4\u56DE\u540E\u8BE5\u6D88\u606F\u4E0D\u518D\u663E\u793A\u5728\u4F1A\u8BDD\u8BB0\u5F55\u4E2D\uFF0C\u4E5F\u4E0D\u518D\u8FDB\u5165\u6A21\u578B\u4E0A\u4E0B\u6587\u3002",
  recallAcknowledge: "\u6211\u5DF2\u77E5\u6653\u64A4\u56DE\u4F1A\u8FD8\u539F\u6587\u4EF6\u53D8\u66F4",
  recallCancel: "\u53D6\u6D88",
  recallConfirmAction: "\u64A4\u56DE",
  recallFailed: "\u64A4\u56DE\u5931\u8D25\uFF1A{message}"
};
var en = {
  "action.recall": "Recall",
  "action.title": "Recall this message and revert its file changes",
  recallConfirmTitle: "Recall message",
  recallConfirm: "This assistant reply and its tool calls will be retracted, and the turn's workspace file changes will be reverted. The message will no longer appear in the transcript or the model context.",
  recallAcknowledge: "I understand the file changes will be reverted",
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
}

    return module.exports;
  }
});
