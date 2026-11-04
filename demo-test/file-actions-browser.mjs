/**
 * 编辑器浏览器测试页，真实 React/编辑器组件配合最小平台桩。
 * 参数：无；运行后打印随机本地端口，Ctrl+C 关闭并释放端口，不写入测试缓存。
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "packages/dsh-plugin-file-actions");
const require = createRequire(join(plugin, "package.json"));
const reactRequire = createRequire(join(root, "packages/dsh-plugin-subscriptions/package.json"));
const { build } = require("esbuild");
const icons = ["IconArchiveOutlineRegular", "IconCheckCircleFillRegular", "IconCloseCircleFillRegular",
        "IconCloseOutlineRegular", "IconCopyOutlineRegular", "IconEditOutlineRegular", "IconFolderOpenOutlineRegular",
        "IconLinkOutlineRegular", "IconListPenOutlineRegular", "IconTrashOutlineRegular", "IconWarningOutlineRegular",
        "IconCheckOutlineRegular", "IconRefreshOutlineRegular"];
const result = await build({
        stdin: {
                contents: `
import React from "react";
import { createRoot } from "react-dom/client";
import { EditorTab, ToastStack, injectStyles } from ${JSON.stringify(join(plugin, "src/client/index.tsx"))};
injectStyles();
const tab = { contentId: "dsh-resource://file-edit/" + encodeURIComponent("/workspace") + "/" + encodeURIComponent("/workspace/code.js"),
 actions: { bindCommands() {} } };
const labels = { "edit.save":"保存", "edit.format":"格式化", "edit.reload":"重新加载", "edit.revert":"恢复原始",
 "edit.formatStale":"格式化期间内容已修改，未覆盖当前编辑", "edit.loading":"加载中", "edit.wrap":"自动换行", "edit.saved":"已保存" };
const translate = key => labels[key] ?? key;
createRoot(document.getElementById("app")).render(React.createElement(React.Fragment, null,
 React.createElement(EditorTab, { useTabInfo:()=>({tab}), t:translate }), React.createElement(ToastStack,{t:translate})));
document.getElementById("complete").onclick=()=>fetch("/complete",{method:"POST"});
`,
                loader: "jsx", resolveDir: plugin,
        },
        bundle: true, format: "esm", platform: "browser", jsx: "automatic", write: false,
        alias: { react: reactRequire.resolve("react"), "react-dom/client": reactRequire.resolve("react-dom/client") },
        plugins: [{
                name: "test-platform",
                /** 替换平台模块并仅在内存导出测试组件；参数为构建器，无返回值。 */
                setup(builder) {
                        builder.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: "ui", namespace: "stub" }));
                        builder.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
                                contents: `import React from "react";
export const ${icons.map((name) => `${name}=()=>null`).join(",")};
export const useCodeHighlighter=()=>null, languageForPath=()=>"javascript", modalSelector=()=>null, writeClipboard=async()=>{};
export const Menu=({children})=>React.createElement("div",null,children), MenuItemButton=({children,onSelect})=>React.createElement("button",{onClick:onSelect},children);
export const Modal=Menu, Button=MenuItemButton, RiskConfirmation=Menu;`,
                                loader: "js",
                        }));
                        builder.onLoad({ filter: /src[\\/]client[\\/]index\.tsx$/ }, async ({ path }) => ({
                                contents: `${await readFile(path, "utf8")}\nexport { EditorTab, ToastStack, injectStyles };`,
                                loader: "tsx", resolveDir: dirname(path),
                        }));
                },
        }],
});
let content = "const original = 1;\n";
let version = "v1";
let pendingFormat;
/** 返回 JSON；参数为响应、状态码和载荷，无返回值。 */
function json(res, status, payload) {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
}
/** 处理测试页面与桩接口；参数为 HTTP 请求/响应，返回异步处理结果。 */
const server = createServer(async (req, res) => {
        try {
                switch (req.url) {
                        case "/":
                                res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                                res.end('<!doctype html><html lang="zh"><meta charset="utf-8"><title>文件编辑器回归测试</title><body style="margin:16px;background:#fafafa"><button id="complete">完成格式化</button><div id="app" style="height:600px;margin-top:12px"></div><script type="module" src="/app.js"></script></body></html>');
                                return;
                        case "/app.js":
                                res.writeHead(200, { "content-type": "application/javascript" });
                                res.end(result.outputFiles[0].text);
                                return;
                        case "/api/dsh-file-actions/read":
                                json(res, 200, { ok: true, content, version });
                                return;
                        case "/api/dsh-file-actions/format":
                                if (pendingFormat) json(pendingFormat, 200, { ok: true, content: "const outdated = 0;\n" });
                                pendingFormat = res;
                                return;
                        case "/complete":
                                if (pendingFormat) json(pendingFormat, 200, { ok: true, content: "const outdated = 0;\n" });
                                pendingFormat = undefined;
                                json(res, 200, { ok: true });
                                return;
                        case "/api/dsh-file-actions/save": {
                                const chunks = [];
                                for await (const chunk of req) chunks.push(chunk);
                                const body = JSON.parse(Buffer.concat(chunks).toString());
                                if (body.version !== version) { json(res, 409, { ok: false, message: "版本冲突" }); return; }
                                content = body.content;
                                version = `${version}-next`;
                                json(res, 200, { ok: true, version });
                                return;
                        }
                        default: res.writeHead(404); res.end();
                }
        } catch (error) {
                json(res, 500, { ok: false, message: error.message });
        }
});
server.listen(0, "localhost", () => console.log(`浏览器测试页：http://localhost:${server.address().port}/`));
/** 终止测试服务；无参数，关闭挂起响应和所有连接，无返回值。 */
function close() {
        pendingFormat?.destroy();
        server.close();
        server.closeAllConnections();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
