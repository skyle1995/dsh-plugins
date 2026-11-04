/**
 * 提示音真实 React/IndexedDB 浏览器回归页。
 * 参数：无；运行后打印随机本地端口，Ctrl+C 关闭服务，不连接 DSH profile。
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "packages/dsh-plugin-sound-alert");
const require = createRequire(join(plugin, "package.json"));
const reactRequire = createRequire(join(root, "packages/dsh-plugin-subscriptions/package.json"));
const { build } = require("esbuild");
const result = await build({
        stdin: {
                contents: `
import React from "react";
import { createRoot } from "react-dom/client";
import { apply, SoundAlertPanel, setCustomSound } from ${JSON.stringify(join(plugin, "src/client/index.tsx"))};
let texts={}; const disposers=[];
const ctx={
 locale:{register:(name,dict)=>{texts=dict.zh;return()=>{};},bind:()=>key=>texts[key]??key},
 slots:{inject:()=>{},register:()=>()=>{}},
 effect:fn=>{const dispose=fn();if(typeof dispose==="function")disposers.push(dispose);},
 inject:(deps,fn)=>fn(ctx),
 uiSession:{sessionStatus:{getSnapshot:()=>new Map(),subscribe:()=>()=>{}}}
};
apply(ctx);
const app=createRoot(document.getElementById("app"));
app.render(React.createElement(SoundAlertPanel,{t:key=>texts[key]??key}));
document.getElementById("replace").onclick=async()=>{
 const blob=await(await fetch("/done.wav")).blob();
 const result=await setCustomSound("attention",new File([blob],"测试提示.wav",{type:"audio/wav"}));
 document.getElementById("status").textContent=result.ok?"写入成功":result.message;
};
document.getElementById("dispose").onclick=()=>{
 app.unmount();while(disposers.length)disposers.pop()();
 const request=indexedDB.deleteDatabase("dsh-plugin-sound-alert:audio");
 request.onsuccess=()=>document.getElementById("status").textContent="已卸载，测试数据库已删除";
 request.onblocked=()=>document.getElementById("status").textContent="数据库删除被连接阻塞";
};`,
                loader: "jsx", resolveDir: plugin,
        },
        bundle: true, format: "esm", platform: "browser", write: false,
        alias: { react: reactRequire.resolve("react"), "react-dom/client": reactRequire.resolve("react-dom/client") },
        plugins: [{
                name: "sound-browser-test",
                /** 注入真实 WAV 和测试组件导出；参数为构建器，无返回值。 */
                setup(builder) {
                        builder.onResolve({ filter: /^virtual:sound-alert-assets$/ }, () => ({ path: "sounds", namespace: "audio" }));
                        builder.onLoad({ filter: /.*/, namespace: "audio" }, async () => {
                                const attention = await readFile(join(plugin, "assets/attention.wav"));
                                const done = await readFile(join(plugin, "assets/done.wav"));
                                return { contents: `export const attentionSound=${JSON.stringify(`data:audio/wav;base64,${attention.toString("base64")}`)},doneSound=${JSON.stringify(`data:audio/wav;base64,${done.toString("base64")}`)};`, loader: "js" };
                        });
                        builder.onLoad({ filter: /src[\\/]client[\\/]index\.tsx$/ }, async ({ path }) => ({
                                contents: `${await readFile(path, "utf8")}\nexport { SoundAlertPanel };`,
                                loader: "tsx", resolveDir: dirname(path),
                        }));
                },
        }],
});
/** 服务测试页和真实音频；参数为 HTTP 请求/响应，返回空 Promise。 */
const server = createServer(async (req, res) => {
        try {
                switch (req.url) {
                        case "/":
                                res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                                res.end('<!doctype html><html lang="zh"><meta charset="utf-8"><title>提示音回归测试</title><body style="margin:24px;background:#fafafa"><button id="replace">写入测试音频</button> <button id="dispose">卸载插件并清理测试数据库</button><p id="status"></p><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
                                return;
                        case "/app.js":
                                res.writeHead(200, { "content-type": "application/javascript" });
                                res.end(result.outputFiles[0].text);
                                return;
                        case "/done.wav":
                                res.writeHead(200, { "content-type": "audio/wav" });
                                res.end(await readFile(join(plugin, "assets/done.wav")));
                                return;
                        default: res.writeHead(404); res.end();
                }
        } catch (error) {
                res.writeHead(500); res.end(error.message);
        }
});
server.listen(0, "localhost", () => console.log(`提示音测试页：http://localhost:${server.address().port}/`));
/** 释放服务端口与连接；无参数，无返回值。 */
function close() {
        server.close();
        server.closeAllConnections();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
