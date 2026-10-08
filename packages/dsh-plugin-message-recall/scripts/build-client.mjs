/**
 * 构建 dsh-plugin-message-recall 的浏览器 bundle（lib/client.js）。
 *
 * DSH 客户端插件要求预构建产物：包在 package.json 声明 dsh.client，
 * 导出 ./client（lib/client.js），格式为向 window.__ModuleLoader__ 注册
 * factory 的 CJS 外壳。React / jsx-runtime 与 inject 列表里的包全部
 * 保持外部化（由平台模块表与模块图在运行时提供）。
 *
 * 运行：node scripts/build-client.mjs
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const result = await build({
	entryPoints: [join(pkgDir, "src/client/index.tsx")],
	bundle: true,
	format: "cjs",
	platform: "browser",
	jsx: "automatic",
	external: ["react*", "@deepseek-ai/*"],
	minify: false,
	sourcemap: false,
	write: false,
	logLevel: "info",
});

const body = result.outputFiles[0].text;
const wrapped = [
	"window.__ModuleLoader__.load({",
	`  id: ${JSON.stringify(pkg.name)},`,
	"  factory: (require) => {",
	'    var module = { exports: {} };',
	"    var exports = module.exports;",
	'    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
	body,
	"    return module.exports;",
	"  }",
	"});",
	"",
].join("\n");

const outFile = join(pkgDir, "lib/client.js");
writeFileSync(outFile, wrapped);
console.log(`built ${outFile} (${Buffer.byteLength(wrapped)} bytes)`);
