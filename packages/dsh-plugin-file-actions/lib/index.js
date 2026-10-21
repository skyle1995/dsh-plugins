/**
 * dsh-plugin-file-actions —— DSH 文件列表增强插件（宿主半区入口）。
 *
 * 默认导出的 Cordis 服务（服务键 fileActions，即 ctx.fileActions）提供：
 * - 复制 / 剪切（移动）/ 重命名 / 删除 / 压缩 工作区文件；
 * - 浏览器半区使用的 /api/dsh-file-actions/* HTTP 路由（webServer 存在时）。
 *
 * 全部写操作被约束在会话工作区内（见 lib/file-actions.js）。
 *
 * @module dsh-plugin-file-actions
 */
export { FileActionsService, FileActionsError, FILE_ACTIONS_API, DEFAULT_MAX_ZIP_FILE_BYTES, DEFAULT_MAX_EDIT_BYTES, zipNameFor, sanitizeZipName, sanitizeEntryName, parserForPath } from "./file-actions.js";
export { crc32, buildZipBuffer, collectZipEntries, createZipBuffer } from "./zip.js";
import { FileActionsService } from "./file-actions.js";

export default FileActionsService;
