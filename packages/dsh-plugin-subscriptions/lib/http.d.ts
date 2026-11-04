/** Stored proxy configuration (the proxy.json shape). */
export interface ProxyConfig {
    /** Whether outbound subscription requests route through {@link url}. */
    enabled: boolean;
    /** Proxy origin: `http://host:port` or `https://host:port`. */
    url: string;
    /** Optional proxy user for basic auth. */
    username?: string;
    /** Optional proxy password for basic auth; never sent back to the client. */
    password?: string;
    /** Hostnames (exact, suffix, or `*.example.com`) that use host routing instead. */
    bypass: string[];
}
/** The proxy config as served to the client: secrets replaced by a flag. */
export interface ProxyConfigView {
    enabled: boolean;
    url: string;
    username?: string;
    /** Whether a password is stored (the password itself never leaves the host). */
    passwordSet: boolean;
    bypass: string[];
    /** Last load/apply failure, when the stored config is unusable. */
    error?: string;
}
/** One `proxySet` payload. */
export interface ProxyInput {
    enabled: boolean;
    url: string;
    username?: string;
    /** `undefined` keeps the stored password, `null`/`''` clears it. */
    password?: string | null;
    bypass?: string[];
}
/** One `proxyTest` result. */
export interface ProxyTestResult {
    /** Whether the destination answered with an HTTP status. */
    ok: boolean;
    /** Whether the plugin proxy was used; false means host routing, not necessarily direct. */
    viaProxy: boolean;
    /** Status of the answered request, when one was received. */
    status?: number;
    /** Round-trip latency in milliseconds. */
    latencyMs?: number;
    /** Failure message, when no response was received. */
    error?: string;
}
/** A draft proxy for one test probe (never persisted). */
export interface ProxyDraft {
    url: string;
    username?: string;
    password?: string;
}
/** Destination the `proxyTest` endpoint probes when none is given. */
export declare const DEFAULT_PROXY_TEST_URL = "https://api.x.ai/v1/models";
/** Probe deadline; a hung proxy must not pin the Settings dialog forever. */
export declare const DEFAULT_PROXY_TEST_TIMEOUT_MS = 15000;
/**
 * Minimum per-address connect attempt budget for Node's Happy Eyeballs
 * (`net.autoSelectFamilyAttemptTimeout`). Node's default is 250ms, which is
 * shorter than one TCP handshake to Cloudflare-fronted hosts (registry.npmjs.org,
 * chatgpt.com) on a high-latency link: every address then fails with
 * ETIMEDOUT and the whole fetch dies even though curl succeeds.
 */
export declare const MIN_CONNECT_ATTEMPT_TIMEOUT_MS = 1500;
/**
 * Raise the process-wide Happy Eyeballs attempt timeout to at least `minMs`.
 * Never lowers a host-configured value. The setting is per process (there is
 * no per-dispatcher knob that survives the host's global dispatcher), so the
 * plugin restores the previous value on dispose.
 * @param minMs - the floor to enforce.
 * @returns the value in effect before the call.
 */
export declare function ensureConnectAttemptTimeout(minMs?: number): number;
/** Restore a value captured by {@link ensureConnectAttemptTimeout}. */
export declare function restoreConnectAttemptTimeout(previous: number): void;
/** Absolute path of the proxy config file. */
export declare function proxyFilePath(): string;
/**
 * Flatten a fetch failure into a readable message: undici wraps the true
 * cause (`connect ECONNREFUSED ...`) behind a bare "fetch failed", so walk
 * the cause chain and append each distinct layer (up to four, cycle-safe).
 * A hostname resolving to several addresses (e.g. `localhost` → ::1 and
 * 127.0.0.1) fails as an `AggregateError` with an empty message, so its
 * per-address `errors` entries are folded in too.
 */
export declare function describeFetchError(error: unknown): string;
/**
 * 校验 HTTP(S) 代理 URL，拒绝其它协议，错误信息不回显可能含凭据的原始地址。
 * @param raw 用户配置的地址。
 * @returns 解析后的 URL。
 */
export declare function parseProxyUrl(raw: string): URL;
/**
 * 判断主机是否绕过插件代理，支持 DNS 后缀、通配符及 IPv4/IPv6 精确地址。
 * @param hostname 请求主机；entries 绕过规则，可包含 URL、IPv6 方括号与端口。
 * @returns 是否匹配；IP 不参与 DNS 后缀匹配。
 */
export declare function matchesBypass(hostname: string, entries: readonly string[]): boolean;
/**
 * Current proxy config as served to the client (secrets omitted).
 * @returns the view; {@link ProxyConfigView.error} carries the last
 *   load/apply failure when the stored config is unusable.
 */
export declare function proxyGetConfig(): Promise<ProxyConfigView>;
/**
 * 串行校验、保存并应用代理配置，未提供密码时继承现值，null 或空串清除。
 * @param input 客户端输入。
 * @returns 脱敏配置视图，不返回密码或含凭据的 URL。
 */
export declare function proxySetConfig(input: ProxyInput): Promise<ProxyConfigView>;
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
export declare function proxiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
/**
 * 探测 HTTP(S) 目标，收到状态码后取消响应体并释放临时代理，不下载无关内容。
 * @param target 目标地址，默认 DEFAULT_PROXY_TEST_URL；draft 可选未保存代理输入。
 * @returns 状态、延迟和路由信息；任何 HTTP 状态均表示连接成功，传输失败返回错误。
 */
export declare function proxyTestConnection(target?: string, draft?: ProxyDraft): Promise<ProxyTestResult>;
