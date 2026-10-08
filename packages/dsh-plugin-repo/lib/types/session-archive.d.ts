/**
 * dsh-plugin-session-archive 类型声明。
 */
import type { Context, Service } from "@deepseek-ai/cordis";

export interface SessionArchiveConfig {
	/** 会话根目录；留空时自动使用 $DSH_HOME/sessions（或 ~/.dsh/sessions） */
	sessionsDir: string;
}

export interface SessionEntry {
	id: string;
	title: string;
	workspaceTitle: string;
	workspacePath: string;
	archived: boolean;
}

export interface WorkspaceView {
	id: string;
	title: string;
	path: string;
	sessionIds: string[];
}

export class SessionArchiveError extends Error {
	code: string;
}

export function resolveDshHome(): string;
export function encodeSessionSegment(raw: string): string;
export function readSessionTitles(projcacheDir: string): Promise<Record<string, string>>;
export function findSessionDirs(sessionsRoot: string, sessionId: string): Promise<string[]>;
export function buildSessionList(input: { workspaces?: WorkspaceView[]; archivedIds?: string[]; titles?: Record<string, string>; extraIds?: string[] }): SessionEntry[];

export class SessionArchiveService extends Service {
	constructor(ctx: Context, config: SessionArchiveConfig);
	config: SessionArchiveConfig;
	sessionsDir: string;
	projcacheDir: string;
	snapshot(): Promise<{ workspaces: WorkspaceView[]; archivedIds: string[]; sessions: SessionEntry[] }>;
	deleteSession(sessionId: string): Promise<{ removedDirs: string[] }>;
}

declare const SessionArchive: typeof SessionArchiveService;
export default SessionArchive;
