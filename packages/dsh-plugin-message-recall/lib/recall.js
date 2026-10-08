/**
 * dsh-plugin-message-recall 撤回规划纯逻辑：从会话事件日志中定位要撤回的
 * 助手消息、计算被遮蔽的 surface 范围、规划文件回滚，并生成占位消息文案。
 *
 * 本模块只依赖 Node 内置模块，可脱离 Cordis 单独测试；所有输入都是普通
 * 数据（事件数组、捕获表），由宿主服务负责真实的 Session / 持久化写入。
 *
 * 术语：
 * - surface 节点：system/developer/user/assistant/tool 五类带 surfaceOp 的事件；
 * - 撤回范围：目标助手消息所在轮次中，从第一条 assistant/message 到该轮
 *   最后一条 surface 节点的闭区间（用户提问保留，助手侧全部遮蔽）；
 * - 占位节点：替换该范围的 user/message「消息已撤回」记录（模型可见）。
 *
 * @module dsh-plugin-message-recall/recall
 */

/** 参与 surface 的事件类型集合。 */
export const SURFACE_EVENT_TYPES = new Set([
	"system/message",
	"developer/message",
	"user/message",
	"assistant/message",
	"tool/result",
]);

/** 事件是否为 surface 节点（类型符合且带 surfaceOp 标记）。 */
export function isSurfaceEvent(event) {
	return SURFACE_EVENT_TYPES.has(event.type) && event.surfaceOp !== undefined;
}

/** 事件是否以追加方式进入 surface（而非替换）。 */
export function isAppendSurfaceEvent(event) {
	return isSurfaceEvent(event) && event.surfaceOp === "append";
}

/** 带错误码的撤回规划失败。 */
export class RecallPlanError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "RecallPlanError";
		this.code = code;
	}
}

/**
 * 重放事件的 surface 折叠（复刻官方 foldSurface 的节点序），返回当前
 * surface 上的事件序号列表。替换不合法时抛 RecallPlanError（日志损坏）。
 *
 * @param {Array<{ seq: number, type: string, surfaceOp?: unknown }>} events - 按 seq 升序的事件。
 * @returns {number[]} 当前 surface 节点序号。
 */
export function foldSurfaceNodes(events) {
	const nodes = [];
	for (const event of events) {
		if (!isSurfaceEvent(event)) continue;
		const op = event.surfaceOp;
		if (typeof op === "object" && op !== null && op.op === "replace") {
			const startIdx = nodes.indexOf(op.startSeq);
			const endIdx = nodes.indexOf(op.endSeq);
			if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
				throw new RecallPlanError("recall/surface-fold", `surface 替换端点无效（${op.startSeq}..${op.endSeq}）`);
			}
			nodes.splice(startIdx, endIdx - startIdx + 1, event.seq);
		} else {
			nodes.push(event.seq);
		}
	}
	return nodes;
}

/**
 * 按 turn/start..turn/end 括号给每个 surface 节点标注所属轮次。
 * 注意：user/message 的 data 就是消息本身、没有 turn 字段，system/developer/
 * assistant/tool 的 data 里才有 turn；统一用括号位置判定。
 *
 * @param {Array<object>} events - 会话事件（按 seq 升序）。
 * @returns {Map<number, number | undefined>} seq → 轮次（括号外为 undefined）。
 */
export function turnAtSeqMap(events) {
	const map = new Map();
	let turn;
	for (const event of events) {
		if (event.type === "turn/start") turn = event.data.turn;
		else if (event.type === "turn/end") turn = undefined;
		if (isSurfaceEvent(event)) map.set(event.seq, turn);
	}
	return map;
}

/**
 * 轻量定位撤回目标轮次（不做范围/完整性校验）：撤回编辑只还原该轮文件
 * 变更并插入提示消息，不折叠会话。
 *
 * @param {Array<object>} events - 会话事件（含 type/data/seq/surfaceOp）。
 * @param {string} messageId - 消息 id（可选；用户消息视图节点没有 id）。
 * @param {number | undefined} seq - 目标 surface 事件的序号（优先）。
 * @returns {{ ok: true, turn: number } | { ok: false, code: string, message: string }}
 */
export function planTurn(events, messageId, seq) {
	let target;
	if (Number.isSafeInteger(seq)) {
		target = events.find((event) => event.seq === seq && isAppendSurfaceEvent(event) && (event.type === "user/message" || event.type === "assistant/message"));
	} else {
		target = [...events].reverse().find((event) => {
			if (!isAppendSurfaceEvent(event)) return false;
			if (event.type === "assistant/message") return event.data?.message?.id === messageId && (event.data?.message?.content?.length ?? 0) > 0;
			if (event.type === "user/message") return event.data?.id === messageId;
			return false;
		});
	}
	if (target === undefined) {
		return { ok: false, code: "recall/target-not-found", message: `没有找到撤回目标${Number.isSafeInteger(seq) ? `（seq ${seq}）` : `消息 ${messageId}`}：它可能不是已定稿的会话消息，或已被压缩。` };
	}
	const turn = turnAtSeqMap(events).get(target.seq);
	if (typeof turn !== "number") return { ok: false, code: "recall/target-turn", message: "目标消息缺少轮次信息，无法撤回。" };
	return { ok: true, turn };
}

/**
 * 定位撤回目标并计算被遮蔽范围。
 *
 * 撤回以「轮」为单位：目标是该轮内的任意一条消息（用户提问或助手消息），
 * 遮蔽范围是从该轮第一条 surface 节点（用户提问）到最后一条的闭区间——
 * 用户消息内容与助手回复、工具调用一起从会话中移除。
 *
 * @param {Array<object>} events - 会话事件（含 type/data/seq/surfaceOp）。
 * @param {string} messageId - 消息 id（用户或助手消息均可）；用户消息的视图
 *   节点没有 id 字段，可传空串并改用 seq 定位。
 * @param {number | undefined} seq - 目标 surface 事件的序号；与 messageId 二选一，
 *   seq 优先（用户消息气泡的撤回按钮只携带 seq）。
 * @returns {{ ok: true, turn: number, start: number, end: number, shadowedSeqs: number[] } | { ok: false, code: string, message: string }}
 */
export function planRecall(events, messageId, seq) {
	let target;
	if (Number.isSafeInteger(seq)) {
		target = events.find((event) => event.seq === seq && isAppendSurfaceEvent(event) && (event.type === "user/message" || event.type === "assistant/message"));
	} else {
		target = [...events].reverse().find((event) => {
			if (!isAppendSurfaceEvent(event)) return false;
			if (event.type === "assistant/message") return event.data?.message?.id === messageId && (event.data?.message?.content?.length ?? 0) > 0;
			if (event.type === "user/message") return event.data?.id === messageId;
			return false;
		});
	}
	if (target === undefined) {
		return { ok: false, code: "recall/target-not-found", message: `没有找到撤回目标${Number.isSafeInteger(seq) ? `（seq ${seq}）` : `消息 ${messageId}`}：它可能不是已定稿的会话消息，或已被压缩/撤回。` };
	}
	const turnAt = turnAtSeqMap(events);
	const turn = turnAt.get(target.seq);
	if (typeof turn !== "number") return { ok: false, code: "recall/target-turn", message: "目标消息缺少轮次信息，无法撤回。" };
	// 该轮全部 surface 节点（按括号归属）：从用户提问到轮末。
	const turnNodes = events.filter((event) => isSurfaceEvent(event) && turnAt.get(event.seq) === turn);
	if (turnNodes.length === 0) return { ok: false, code: "recall/range-empty", message: "该轮没有会话消息，无法撤回。" };
	const start = Math.min(...turnNodes.map((event) => event.seq));
	const end = Math.max(...turnNodes.map((event) => event.seq));
	if (start > target.seq || end < target.seq) {
		return { ok: false, code: "recall/range-outside", message: "目标消息不在该轮 surface 范围内。" };
	}
	// 防御：范围内不允许混入其它轮次的 surface 节点。
	const shadowedSeqs = [];
	for (const event of events) {
		if (!isSurfaceEvent(event) || event.seq < start || event.seq > end) continue;
		if (turnAt.get(event.seq) !== turn) return { ok: false, code: "recall/range-cross-turn", message: "撤回范围跨越了多个轮次，已拒绝。" };
		shadowedSeqs.push(event.seq);
	}
	// 范围必须在当前 surface 中完整、连续地存在（未被压缩/撤回遮蔽）。
	const nodes = foldSurfaceNodes(events);
	const startIdx = nodes.indexOf(start);
	const endIdx = nodes.indexOf(end);
	const span = nodes.slice(startIdx, endIdx + 1);
	if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
		return { ok: false, code: "recall/range-not-intact", message: "该消息已被压缩或撤回过，无法再次撤回。" };
	}
	if (span.length !== shadowedSeqs.length || span.some((seq, i) => seq !== shadowedSeqs[i])) {
		return { ok: false, code: "recall/range-not-intact", message: "该消息已被压缩或撤回过，无法再次撤回。" };
	}
	return { ok: true, turn, start, end, shadowedSeqs };
}

/**
 * 规划文件回滚：把目标轮次捕获的「变更前」状态按路径还原。
 * - 之后轮次再次捕获过的路径跳过（避免覆盖更新的工作）；
 * - oversized 捕获跳过；
 * - absent → 删除文件；content → 写回内容。
 *
 * @param {Record<string, Record<string, { kind: string, content?: string }>>} captures - 合并后的轮次捕获表。
 * @param {number} targetTurn - 要回滚的轮次。
 * @returns {{ operations: Array<{ path: string, action: 'restore' | 'delete', content?: string }>, skipped: Array<{ path: string, reason: 'later-modified' | 'oversized' }> }}
 */
export function planRollback(captures, targetTurn) {
	const operations = [];
	const skipped = [];
	const laterPaths = new Set();
	for (const turnKey of Object.keys(captures ?? {})) {
		const turnNumber = Number(turnKey);
		if (!Number.isSafeInteger(turnNumber) || turnNumber <= targetTurn) continue;
		for (const path of Object.keys(captures[turnKey] ?? {})) laterPaths.add(path);
	}
	const turnMap = captures?.[String(targetTurn)] ?? {};
	for (const path of Object.keys(turnMap)) {
		const capture = turnMap[path];
		if (laterPaths.has(path)) {
			skipped.push({ path, reason: "later-modified" });
			continue;
		}
		if (capture.kind === "oversized") {
			skipped.push({ path, reason: "oversized" });
			continue;
		}
		if (capture.kind === "absent") operations.push({ path, action: "delete" });
		else if (capture.kind === "content") operations.push({ path, action: "restore", content: capture.content });
	}
	return { operations, skipped };
}

/**
 * 生成撤回编辑的提示文案（作为普通消息追加进会话，模型与用户都可见）。
 *
 * @param {{ turn: number, restored: number, skipped: number, failed: number }} summary - 回滚结果摘要。
 * @returns {string}
 */
export function noticeContent(summary) {
	const { turn, restored, skipped, failed } = summary;
	const parts = [`已撤回第 ${turn} 轮的编辑：该轮对工作区文件的修改已还原。`];
	if (restored > 0) parts.push(`${restored} 个文件已还原或删除。`);
	if (skipped > 0) parts.push(`${skipped} 个文件因之后被再次修改或内容过大而未还原。`);
	if (failed > 0) parts.push(`${failed} 个文件还原失败（见操作结果）。`);
	return parts.join(" ");
}

/** @deprecated 旧版整轮折叠占位文案；保留导出以兼容旧调用。 */
export function placeholderContent(summary) {
	return noticeContent(summary);
}
