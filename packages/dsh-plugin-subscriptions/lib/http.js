/**
 * Proxy routing for every outbound subscription request. When a proxy is
 * configured, {@link proxiedFetch} attaches an undici {@link ProxyAgent} as the
 * fetch `dispatcher`, so token exchanges, model-API streams, usage lookups,
 * model discovery, and the `web_search` / `x_search` / `image_generate` / `video_generate`
 * tools all leave through the proxy without touching their call sites.
 *
 * The config lives at `~/.dsh/plugins/subscriptions/proxy.json` (mode 0600,
 * it may carry a password), sibling to the auth store. The `proxyGet` /
 * `proxySet` / `proxyTest` RPC endpoints drive it from the web Settings page;
 * a saved config applies immediately to subsequent requests.
 *
 * The OAuth authorize step opens in the user's browser, which uses the
 * browser/system proxy and is outside this module's reach.
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { getDefaultAutoSelectFamilyAttemptTimeout, isIP, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { dirname } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
/**
 * undici's own fetch, typed to the DOM fetch signature: its bundled types are
 * stricter (Request requires `duplex`, `RequestInit.body` is non-null) and
 * incompatible with the DOM shapes the provider code passes. The runtime
 * object is the same Web-fetch implementation Node uses.
 */
const dispatchFetch = undiciFetch;
/** Destination the `proxyTest` endpoint probes when none is given. */
export const DEFAULT_PROXY_TEST_URL = 'https://api.x.ai/v1/models';
/** Probe deadline; a hung proxy must not pin the Settings dialog forever. */
export const DEFAULT_PROXY_TEST_TIMEOUT_MS = 15_000;
/**
 * Minimum per-address connect attempt budget for Node's Happy Eyeballs
 * (`net.autoSelectFamilyAttemptTimeout`). Node's default is 250ms, which is
 * shorter than one TCP handshake to Cloudflare-fronted hosts (registry.npmjs.org,
 * chatgpt.com) on a high-latency link: every address then fails with
 * ETIMEDOUT and the whole fetch dies even though curl succeeds.
 */
export const MIN_CONNECT_ATTEMPT_TIMEOUT_MS = 1500;
/**
 * Raise the process-wide Happy Eyeballs attempt timeout to at least `minMs`.
 * Never lowers a host-configured value. The setting is per process (there is
 * no per-dispatcher knob that survives the host's global dispatcher), so the
 * plugin restores the previous value on dispose.
 * @param minMs - the floor to enforce.
 * @returns the value in effect before the call.
 */
export function ensureConnectAttemptTimeout(minMs = MIN_CONNECT_ATTEMPT_TIMEOUT_MS) {
    const previous = getDefaultAutoSelectFamilyAttemptTimeout();
    if (previous < minMs)
        setDefaultAutoSelectFamilyAttemptTimeout(minMs);
    return previous;
}
/** Restore a value captured by {@link ensureConnectAttemptTimeout}. */
export function restoreConnectAttemptTimeout(previous) {
    setDefaultAutoSelectFamilyAttemptTimeout(previous);
}
/** Disabled configuration: the module state before the first load. */
const DISABLED = { enabled: false, url: '', bypass: [] };
/** Current config; updated by every load/apply/save. */
let current = DISABLED;
/** The live dispatcher, or undefined when proxies are off/errored. */
let agent;
/** Last load/apply failure, surfaced by the config view. */
let configError;
/** One lazy load of the on-disk config (module-import cheap; file read once). */
let ready;
/** 同一代理配置的写队列，避免并发保存丢失密码或让磁盘与内存状态不一致。 */
let configWrites = Promise.resolve();
/** Absolute path of the proxy config file. */
export function proxyFilePath() {
    return dshHomePath('plugins', 'subscriptions', 'proxy.json');
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Flatten a fetch failure into a readable message: undici wraps the true
 * cause (`connect ECONNREFUSED ...`) behind a bare "fetch failed", so walk
 * the cause chain and append each distinct layer (up to four, cycle-safe).
 * A hostname resolving to several addresses (e.g. `localhost` → ::1 and
 * 127.0.0.1) fails as an `AggregateError` with an empty message, so its
 * per-address `errors` entries are folded in too.
 */
export function describeFetchError(error) {
    const parts = [];
    let node = error;
    for (let depth = 0; depth < 4 && node !== undefined && node !== null; depth += 1) {
        const layer = node;
        if (Array.isArray(layer.errors)) {
            for (const child of layer.errors) {
                const childText = child instanceof Error && child.message !== '' ? child.message : String(child);
                if (childText !== '' && !parts.includes(childText))
                    parts.push(childText);
            }
        }
        let text = layer instanceof Error ? layer.message : String(node);
        const code = layer.code;
        if (typeof code === 'string' && code !== '') {
            if (text === '')
                text = code;
            else if (!text.includes(code))
                text = `${text} (${code})`;
        }
        if (text !== '' && !parts.includes(text))
            parts.push(text);
        const next = layer.cause;
        if (next === undefined || next === null || next === node)
            break;
        node = next;
    }
    return parts.join(' → ');
}
function withError(error) {
    configError = errorMessage(error);
}
/**
 * 校验 HTTP(S) 代理 URL，拒绝其它协议，错误信息不回显可能含凭据的原始地址。
 * @param raw 用户配置的地址。
 * @returns 解析后的 URL。
 */
export function parseProxyUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error('proxy URL is not a valid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('proxy URL must use the http:// or https:// scheme');
    }
    if (url.hostname === '')
        throw new Error('proxy URL must include a host');
    return url;
}
/**
 * 判断主机是否绕过插件代理，支持 DNS 后缀、通配符及 IPv4/IPv6 精确地址。
 * @param hostname 请求主机；entries 绕过规则，可包含 URL、IPv6 方括号与端口。
 * @returns 是否匹配；IP 不参与 DNS 后缀匹配。
 */
export function matchesBypass(hostname, entries) {
    const host = normalizeHostname(hostname);
    for (const raw of entries) {
        let entry = raw.trim().toLowerCase();
        if (entry === '')
            continue;
        if (entry.includes('://') || entry.includes(':') && isIP(entry) === 0) {
            try {
                entry = new URL(entry.includes('://') ? entry : `http://${entry}`).hostname;
            }
            catch {
                continue;
            }
        }
        entry = normalizeHostname(entry);
        if (entry === '' || entry === '*')
            continue;
        if (host === entry)
            return true;
        if (isIP(host) !== 0 || isIP(entry) !== 0)
            continue;
        if (entry.startsWith('*.')) {
            if (host.endsWith(entry.slice(1)))
                return true;
        }
        else if (host.endsWith(`.${entry}`)) {
            return true;
        }
    }
    return false;
}
/** 规范化 DNS/IP 主机名；参数为主机名，返回去掉 IPv6 方括号和 DNS 尾点的小写名称。 */
function normalizeHostname(hostname) {
    let host = hostname.toLowerCase();
    if (host.startsWith('[') && host.endsWith(']'))
        return host.slice(1, -1);
    while (host.endsWith('.'))
        host = host.slice(0, -1);
    return host;
}
/** 校验并净化配置；参数为输入，返回将 URL 凭据拆入受保护字段的配置，非法输入抛错。 */
function normalizeConfig(input) {
    const url = input.url.trim();
    if (input.enabled && url === '') {
        throw new Error('a proxy URL is required when the proxy is enabled');
    }
    const parsed = url !== '' ? parseProxyUrl(url) : undefined;
    const embeddedUsername = parsed?.username ? decodeURIComponent(parsed.username) : undefined;
    const embeddedPassword = parsed?.password ? decodeURIComponent(parsed.password) : undefined;
    const username = input.username ?? embeddedUsername;
    const password = input.password === undefined ? embeddedPassword : input.password;
    let cleanUrl = url;
    if (parsed !== undefined && (parsed.username !== '' || parsed.password !== '')) {
        parsed.username = '';
        parsed.password = '';
        cleanUrl = parsed.toString();
    }
    const bypass = Array.from(new Set((input.bypass ?? [])
        .map(entry => entry.trim())
        .filter(entry => entry !== '')));
    return {
        enabled: input.enabled,
        url: cleanUrl,
        ...username !== undefined && username !== '' ? { username: username.trim() } : {},
        ...password !== undefined && password !== '' && password !== null ? { password } : {},
        bypass,
    };
}
/** Build the undici agent for a config (throws on an unusable URL). */
function buildAgent(cfg) {
    if (!cfg.enabled || cfg.url === '')
        return undefined;
    const url = parseProxyUrl(cfg.url);
    if (cfg.username !== undefined)
        url.username = cfg.username;
    if (cfg.password !== undefined)
        url.password = cfg.password;
    return new ProxyAgent(url.toString());
}
/** Swap in a config and its agent; a failed agent falls back to host routing. */
async function applyConfig(cfg) {
    let next;
    if (cfg !== undefined) {
        configError = undefined;
        try {
            next = buildAgent(cfg);
        }
        catch (error) {
            withError(error);
            next = undefined;
        }
        current = cfg;
    }
    const previous = agent;
    agent = next;
    if (previous !== undefined)
        void previous.close().catch(() => undefined);
}
/** Read the on-disk config. A missing file is the disabled default. */
async function loadConfigFile(path) {
    let text;
    try {
        text = await readFile(path, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return { ...DISABLED, bypass: [] };
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error(`subscriptions proxy config at ${path} is not valid JSON; fix or delete the file`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('subscriptions proxy config must be a JSON object');
    }
    const record = parsed;
    const enabled = record.enabled === true;
    const url = typeof record.url === 'string' ? record.url : '';
    const username = typeof record.username === 'string' ? record.username : undefined;
    const password = typeof record.password === 'string' ? record.password : undefined;
    const bypass = Array.isArray(record.bypass)
        ? record.bypass.filter((entry) => typeof entry === 'string')
        : [];
    return normalizeConfig({
        enabled,
        url,
        ...username === undefined ? {} : { username },
        ...password === undefined ? {} : { password },
        bypass,
    });
}
/** Resolve the module state once from disk; failures disable the proxy. */
async function ensureReady() {
    ready ??= loadConfigFile(proxyFilePath()).then(async (cfg) => {
        await applyConfig(cfg);
        return current;
    }, async (error) => {
        withError(error);
        await applyConfig(undefined);
        return current;
    });
    return ready;
}
/** Persist a config atomically with owner-only permissions, then apply it. */
async function persistConfig(cfg, path) {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
        await writeFile(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
        await chmod(tmp, 0o600);
        await rename(tmp, path);
    }
    catch (error) {
        await rm(tmp, { force: true });
        throw error;
    }
}
/**
 * 等待配置写入完成后关闭代理并清除缓存，仅用于测试清理。
 * @returns 清理完成的 Promise。
 * @internal Exported for tests only; not part of the plugin's public surface.
 */
export async function resetProxyForTests() {
    await configWrites;
    await ready?.catch(() => undefined);
    const previous = agent;
    agent = undefined;
    current = { ...DISABLED, bypass: [] };
    ready = undefined;
    configError = undefined;
    if (previous !== undefined)
        await previous.close().catch(() => undefined);
}
/**
 * Current proxy config as served to the client (secrets omitted).
 * @returns the view; {@link ProxyConfigView.error} carries the last
 *   load/apply failure when the stored config is unusable.
 */
export async function proxyGetConfig() {
    await ensureReady();
    return {
        enabled: current.enabled,
        url: current.url,
        ...current.username === undefined ? {} : { username: current.username },
        passwordSet: current.password !== undefined && current.password !== '',
        bypass: [...current.bypass],
        ...configError === undefined ? {} : { error: configError },
    };
}
/**
 * 串行校验、保存并应用代理配置，未提供密码时继承现值，null 或空串清除。
 * @param input 客户端输入。
 * @returns 脱敏配置视图，不返回密码或含凭据的 URL。
 */
export async function proxySetConfig(input) {
    const next = configWrites.then(() => saveProxyConfig(input));
    configWrites = next.then(() => undefined, () => undefined);
    return next;
}
/** 校验、落盘并应用一份代理配置；参数为客户端输入，返回脱敏视图，仅在写队列中调用。 */
async function saveProxyConfig(input) {
    await ensureReady();
    const embeddedPassword = input.url.trim() === '' ? '' : parseProxyUrl(input.url.trim()).password;
    const password = input.password === undefined
        ? embeddedPassword !== '' ? decodeURIComponent(embeddedPassword) : current.password
        : input.password === null || input.password === ''
            ? undefined
            : input.password;
    const next = normalizeConfig({
        enabled: input.enabled,
        url: input.url,
        ...input.username === undefined ? {} : { username: input.username },
        ...password === undefined ? {} : { password },
        bypass: input.bypass ?? current.bypass,
    });
    await persistConfig(next, proxyFilePath());
    await applyConfig(next);
    return proxyGetConfig();
}
/**
 * The fetch caller all subscription code uses: routes through the configured
 * proxy unless the host bypasses it. Identity-passthrough otherwise: the host
 * may itself route global fetch through an environment-configured proxy.
 *
 * Proxied requests run on undici's own fetch (not the global one) so the
 * ProxyAgent dispatcher always comes from the same undici build the request
 * is issued with — a mismatched dispatcher can be silently ignored by the
 * host's global fetch.
 */
export async function proxiedFetch(input, init = {}) {
    await ensureReady();
    let dispatcher;
    if (current.enabled && agent !== undefined) {
        let hostname = '';
        try {
            const url = typeof input === 'string' ? new URL(input) : input instanceof URL ? input : new URL(input.url);
            hostname = url.hostname;
        }
        catch {
            hostname = '';
        }
        if (!matchesBypass(hostname, current.bypass))
            dispatcher = agent;
    }
    if (dispatcher === undefined)
        return fetch(input, init);
    const proxied = { ...init, dispatcher };
    return dispatchFetch(input, proxied);
}
/**
 * 探测 HTTP(S) 目标，收到状态码后取消响应体并释放临时代理，不下载无关内容。
 * @param target 目标地址，默认 DEFAULT_PROXY_TEST_URL；draft 可选未保存代理输入。
 * @returns 状态、延迟和路由信息；任何 HTTP 状态均表示连接成功，传输失败返回错误。
 */
export async function proxyTestConnection(target = DEFAULT_PROXY_TEST_URL, draft) {
    let parsed;
    try {
        parsed = new URL(target);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return { ok: false, viaProxy: false, error: `test destination must be http or https (got "${parsed.protocol}//")` };
        }
    }
    catch (error) {
        return { ok: false, viaProxy: false, error: errorMessage(error) };
    }
    await ensureReady();
    let probeAgent;
    let viaProxy;
    let closeProbe = false;
    if (draft !== undefined) {
        // Test the typed values: a throw here is a config problem, not a route one.
        try {
            probeAgent = buildAgent(normalizeConfig({
                enabled: true,
                url: draft.url,
                ...draft.username === undefined || draft.username === '' ? {} : { username: draft.username },
                ...draft.password === undefined || draft.password === '' ? {} : { password: draft.password },
                bypass: [],
            }));
            viaProxy = probeAgent !== undefined;
            closeProbe = true;
        }
        catch (error) {
            return { ok: false, viaProxy: false, error: errorMessage(error) };
        }
    }
    else {
        viaProxy = current.enabled && agent !== undefined && !matchesBypass(parsed.hostname, current.bypass);
        probeAgent = viaProxy ? agent : undefined;
    }
    const started = Date.now();
    try {
        const init = probeAgent !== undefined
            ? { method: 'GET', dispatcher: probeAgent, signal: AbortSignal.timeout(DEFAULT_PROXY_TEST_TIMEOUT_MS) }
            : { method: 'GET', signal: AbortSignal.timeout(DEFAULT_PROXY_TEST_TIMEOUT_MS) };
        const response = probeAgent !== undefined
            ? await dispatchFetch(parsed.toString(), init)
            : await fetch(parsed.toString(), init);
        // 探测只需状态码，取消响应体，避免下载大文件或等待长连接才关闭临时代理。
        await response.body?.cancel().catch(() => undefined);
        return { ok: true, viaProxy, status: response.status, latencyMs: Date.now() - started };
    }
    catch (error) {
        return { ok: false, viaProxy, latencyMs: Date.now() - started, error: describeFetchError(error) };
    }
    finally {
        if (closeProbe && probeAgent !== undefined) {
            await probeAgent.close().catch(() => undefined);
        }
    }
}
