/**
 * 有界读取仓库插件 JSON 请求，避免上传耗尽内存及 null/数组载荷。
 * @param req Node 请求；ErrorType 插件错误类；prefix 错误码前缀；maxBytes 上限（默认 1MB）。
 * @returns JSON 对象；非法结构或超限抛出带错误码的异常。
 */
export async function readJsonBody(req, ErrorType, prefix, maxBytes = 1024 * 1024) {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
                bytes += Buffer.byteLength(chunk);
                if (bytes > maxBytes) throw new ErrorType(`${prefix}/body-too-large`, "请求体超过大小上限");
                chunks.push(Buffer.from(chunk));
        }
        let body;
        try {
                body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
                throw new ErrorType(`${prefix}/invalid-json`, "请求体不是合法 JSON");
        }
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
                throw new ErrorType(`${prefix}/invalid-json`, "请求体必须是 JSON 对象");
        }
        return body;
}
