/**
 * 构建 dsh-plugin-sound-alert 的浏览器 bundle（lib/client.js）。
 *
 * 与其他 DSH 客户端插件一致，产物是向 window.__ModuleLoader__ 注册 factory 的
 * CJS 外壳；react 保持外部化，由平台模块表在运行时提供。
 *
 * 本插件额外做一件事：把 assets/*.wav 转成 base64 data URI，经虚拟模块
 * `virtual:sound-alert-assets` 注入 bundle —— 这样运行时不需要宿主路由或
 * 静态文件服务，音频随 bundle 一起下发（浏览器按 revision 缓存）。
 *
 * 运行：node scripts/build-client.mjs
 */
import { build } from "esbuild";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

/** 读取音频资源并转成 data URI。 */
function readSound(file) {
	const path = join(pkgDir, "assets", file);
	if (!existsSync(path)) {
		throw new Error(`缺少音频资源 ${path}；先运行 node tools/generate-sounds.mjs`);
	}
	return `data:audio/wav;base64,${readFileSync(path).toString("base64")}`;
}

/** 虚拟模块：把 WAV 资源编译成两句 JS 常量。 */
const soundAssets = {
	name: "sound-alert-assets",
	setup(pluginBuild) {
		pluginBuild.onResolve({ filter: /^virtual:sound-alert-assets$/ }, () => ({
			path: "sound-alert-assets",
			namespace: "sound-alert",
		}));
		pluginBuild.onLoad({ filter: /.*/, namespace: "sound-alert" }, () => ({
			contents: [
				`export const attentionSound = ${JSON.stringify(readSound("attention.wav"))};`,
				`export const doneSound = ${JSON.stringify(readSound("done.wav"))};`,
				"",
			].join("\n"),
			loader: "js",
		}));
	},
};

const result = await build({
	entryPoints: [join(pkgDir, "src/client/index.tsx")],
	bundle: true,
	format: "cjs",
	platform: "browser",
	jsx: "automatic",
	external: ["react*", "@deepseek-ai/*"],
	plugins: [soundAssets],
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
	"    var module = { exports: {} };",
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
console.log(`built ${outFile} (${(Buffer.byteLength(wrapped) / 1024).toFixed(1)} KB)`);
