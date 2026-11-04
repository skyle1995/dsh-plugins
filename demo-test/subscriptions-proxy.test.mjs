/**
 * 订阅代理跨平台回归，使用隔离 DSH_HOME 和内存 HTTP 响应。
 * 参数：无；node --test demo-test/subscriptions-proxy.test.mjs，不访问真实代理或账号。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import {
        matchesBypass, parseProxyUrl, proxyGetConfig, proxySetConfig, proxyTestConnection, resetProxyForTests,
} from "../packages/dsh-plugin-subscriptions/lib/http.js";

const directory = dirname(fileURLToPath(import.meta.url));

/** 创建隔离代理配置；参数为测试上下文，返回临时 DSH_HOME，测试后关闭代理并清理。 */
async function fixture(t) {
        const folder = await mkdtemp(join(directory, ".subscriptions-proxy-"));
        const previousHome = process.env.DSH_HOME;
        process.env.DSH_HOME = folder;
        await resetProxyForTests();
        t.after(async () => {
                try { await resetProxyForTests(); }
                finally {
                        if (previousHome === undefined) delete process.env.DSH_HOME;
                        else process.env.DSH_HOME = previousHome;
                        await rm(folder, { recursive: true, force: true });
                }
        });
        return folder;
}

test("IPv6 代理绕过支持裸地址、方括号及端口，不把 IP 当 DNS 后缀", () => {
        for (const entry of ["::1", "[::1]", "[::1]:8080", "http://[::1]:8080"]) {
                assert.equal(matchesBypass("[::1]", [entry]), true, entry);
                assert.equal(matchesBypass("::1", [entry]), true, entry);
        }
        assert.equal(matchesBypass("2001:db8::1", ["2001:db8::1"]), true);
        assert.equal(matchesBypass("[2001:db8::2]", ["2001:db8::1"]), false);
        assert.equal(matchesBypass("127.0.0.1", ["0.1"]), false);
        assert.equal(matchesBypass("api.EXAMPLE.com.", ["example.com:443"]), true);
        assert.equal(matchesBypass("api.example.com", ["*.example.com"]), true);
        assert.equal(matchesBypass("example.com", ["*.example.com"]), false);
        assert.equal(matchesBypass("evil-example.com", ["example.com"]), false);
});

test("并发保存按顺序继承密码和 bypass，最终磁盘/内存一致", async (t) => {
        const folder = await fixture(t);
        const password = randomUUID();
        const [first, second] = await Promise.all([
                proxySetConfig({ enabled: false, url: "http://first.example", password, bypass: ["first.example"] }),
                proxySetConfig({ enabled: false, url: "http://second.example" }),
        ]);
        assert.equal(first.passwordSet, true);
        assert.equal(second.passwordSet, true);
        assert.deepEqual(second.bypass, ["first.example"]);
        const view = await proxyGetConfig();
        assert.equal(view.url, "http://second.example");
        assert.equal(view.passwordSet, true);
        const file = join(folder, "plugins/subscriptions/proxy.json");
        const saved = JSON.parse(await readFile(file, "utf8"));
        assert.equal(saved.password, password);
        assert.equal(saved.url, view.url);
        assert.deepEqual(saved.bypass, view.bypass);
        if (process.platform !== "win32") assert.equal((await lstat(file)).mode & 0o777, 0o600);
});

test("前一保存失败不会堵塞后续配置写入", async (t) => {
        await fixture(t);
        const results = await Promise.allSettled([
                proxySetConfig({ enabled: true, url: "" }),
                proxySetConfig({ enabled: false, url: "http://valid.example" }),
        ]);
        assert.equal(results[0].status, "rejected");
        assert.equal(results[1].status, "fulfilled");
        assert.equal((await proxyGetConfig()).url, "http://valid.example");
});

test("URL 内嵌凭据存为受保护字段，不泄漏到返回 URL 或校验错误", async (t) => {
        const folder = await fixture(t);
        const password = randomUUID();
        const input = `http://test-user:${encodeURIComponent(password)}@proxy.example:8080`;
        const view = await proxySetConfig({ enabled: false, url: input });
        assert.equal(view.username, "test-user");
        assert.equal(view.passwordSet, true);
        assert.equal(view.url.includes(password), false);
        assert.equal(new URL(view.url).username, "");
        const saved = JSON.parse(await readFile(join(folder, "plugins/subscriptions/proxy.json"), "utf8"));
        assert.equal(saved.password, password);
        assert.equal(saved.url, view.url);
        assert.throws(() => parseProxyUrl(`socks5://test-user:${password}@proxy.example`), (error) => !error.message.includes(password));
});

test("连接探测只读取状态码并取消响应体，不下载无限流", async (t) => {
        await fixture(t);
        const previousFetch = globalThis.fetch;
        t.after(() => { globalThis.fetch = previousFetch; });
        let canceled = false;
        globalThis.fetch = async () => new Response(new ReadableStream({
                /** 生成不结束的响应；参数为控制器，无返回值。 */
                start(controller) { controller.enqueue(new TextEncoder().encode("stream")); },
                /** 取消测试响应；无参数，无返回值。 */
                cancel() { canceled = true; },
        }), { status: 200 });
        const result = await proxyTestConnection("https://test.example");
        assert.equal(result.ok, true);
        assert.equal(result.status, 200);
        assert.equal(result.viaProxy, false);
        assert.equal(canceled, true);
});
