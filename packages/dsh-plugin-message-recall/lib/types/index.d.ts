/**
 * dsh-plugin-message-recall 类型声明（无构建步骤，供编辑器/tsc 消费）。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface MessageRecallConfig {
	/** 单文件捕获内容上限（字节），默认 2 MiB；更大的文件撤回时跳过还原 */
	maxFileBytes: number;
	/** 捕获文件根目录；留空自动 $DSH_HOME/dsh-message-recall */
	capturesDir: string;
}

/** 单路径的「变更前」捕获。 */
export type FileCapture =
	| { kind: "content"; content: string }
	| { kind: "absent" }
	| { kind: "oversized" };

/** 撤回请求（HTTP 路由与 service 方法共用）。 */
export interface RecallRequest {
	sessionId: string;
	messageId: string;
}

/** 撤回成功结果。 */
export interface RecallResult {
	/** 会话是否为活跃（内存中）会话；冷会话客户端应刷新界面 */
	live: boolean;
	/** 被撤回消息所在轮次 */
	turn: number;
	/** 已还原内容的文件绝对路径 */
	restored: string[];
	/** 已删除（本轮新建）的文件绝对路径 */
	deleted: string[];
	/** 跳过的路径与原因 */
	skipped: Array<{ path: string; reason: "later-modified" | "oversized" }>;
	/** 还原失败路径与原因 */
	failed: Array<{ path: string; error: string }>;
	/** 写入会话的占位消息文本 */
	placeholder: string;
}

declare module "@deepseek-ai/cordis" {
	interface Context {
		messageRecall: MessageRecallService;
	}
}

/** dsh-plugin-message-recall 的 Cordis 服务：捕获记录器 + 撤回引擎 + Web 路由。 */
export declare class MessageRecallService extends Service {
	static inject: never[];
	static Config: import("@deepseek-ai/schemastery").default<MessageRecallConfig>;
	constructor(ctx: Context, config: MessageRecallConfig);
	/** 撤回一条助手消息并还原该轮文件变更。 */
	recall(request: RecallRequest): Promise<
		| { ok: true; value: RecallResult }
		| { ok: false; error: { code: string; message: string } }
	>;
}

export default MessageRecallService;
