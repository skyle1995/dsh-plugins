/**
 * 构建 dsh-plugin-skills 的浏览器 bundle（lib/client.js）。
 * 与 dsh-plugin-repo 相同的客户端契约：CJS 外壳 + window.__ModuleLoader__
 * 注册，React 与平台模块保持外部化。运行：node scripts/build-client.mjs
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
	external: ["*"],
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
