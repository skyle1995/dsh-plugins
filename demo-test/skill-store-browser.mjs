/**
 * 技能商店真实 React 浏览器测试页，自动读取仓库技能子目录的 SKILL.md。
 * 参数：无；运行后打印本地随机端口，安装接口仅模拟状态，不修改真实技能。
 * 返回：HTTP 测试页；Ctrl+C 或 /shutdown 显式关闭监听及连接。
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillMetadata } from "../packages/dsh-plugin-repo/lib/skill-metadata.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "packages/dsh-plugin-repo");
const require = createRequire(join(plugin, "package.json"));
const reactRequire = createRequire(join(root, "packages/dsh-plugin-subscriptions/package.json"));
const { build } = require("esbuild");
const ids = (await readdir(join(root, "skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const entries = await Promise.all(ids.map(async (id) => ({
        id, ...readSkillMetadata(await readFile(join(root, "skills", id, "SKILL.md"), "utf8"), id),
        treeSha: "1".repeat(40), installed: false, managed: false, modified: false, updateAvailable: false,
})));
for (const entry of entries) entry.version ??= entry.treeSha.slice(0, 8);
const result = await build({
        stdin: {
                contents: `
import React from "react";
import { createRoot } from "react-dom/client";
import { register } from ${JSON.stringify(join(plugin, "src/client/skills.tsx"))};
let texts={}; let Section;
const ctx={
 locale:{register:(name,dict)=>{texts=dict.zh;return()=>{}},bind:()=>key=>texts[key]??key},
 effect:fn=>fn(),
 slots:{inject:(name,fn)=>fn(),register:(info,component)=>{if(info.id==="skills-manager")Section=component;return()=>{}}}
};
register(ctx);
createRoot(document.getElementById("app")).render(React.createElement(Section,{t:key=>texts[key]??key}));
`,
                loader: "jsx", resolveDir: plugin,
        },
        bundle: true, format: "esm", platform: "browser", write: false,
        alias: { react: reactRequire.resolve("react"), "react-dom/client": reactRequire.resolve("react-dom/client") },
});
/** 提供页面及模拟商店 API；参数为 HTTP 请求和响应，无返回值。 */
const server = createServer((req, res) => {
        switch (req.url) {
                case "/":
                        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                        res.end('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>技能商店浏览器回归</title><body style="margin:20px;font-family:system-ui"><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
                        return;
                case "/app.js":
                        res.writeHead(200, { "content-type": "application/javascript" });
                        res.end(result.outputFiles[0].text);
                        return;
                case "/api/dsh-plugin-skills/store":
                        res.writeHead(200, { "content-type": "application/json" });
                        res.end(JSON.stringify({ ok: true, entries, warnings: [] }));
                        return;
                case "/api/dsh-plugin-skills/skills":
                        res.writeHead(200, { "content-type": "application/json" });
                        res.end(JSON.stringify({ ok: true, skills: [], dir: "browser-fixture" }));
                        return;
                case "/api/dsh-plugin-skills/store/install": {
                        const chunks = [];
                        req.on("data", (data) => chunks.push(data));
                        req.on("end", () => {
                                const body = JSON.parse(Buffer.concat(chunks).toString());
                                const entry = entries.find((item) => item.id === body.id);
                                if (!entry) { res.writeHead(400); res.end(); return; }
                                entry.installed = true;
                                entry.managed = true;
                                res.writeHead(200, { "content-type": "application/json" });
                                res.end(JSON.stringify({ ok: true, id: entry.id }));
                        });
                        return;
                }
                case "/shutdown":
                        res.end("closed");
                        close();
                        return;
                default: res.writeHead(404); res.end();
        }
});
server.listen(0, "localhost", () => console.log(`技能商店测试页：http://localhost:${server.address().port}/`));
/** 显式清理服务及所有连接；无参数，无返回值。 */
function close() {
        server.close();
        server.closeAllConnections();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
