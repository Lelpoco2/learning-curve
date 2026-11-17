/** Workspace discovery and persistence. Uses node:fs only (no pi imports). */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { CONFIG_FILE, emptyState, type LcConfig, type LcState, STATE_FILE, WORKSPACE_DIR } from "./types.ts";

export interface Workspace {
	/** Directory that contains `.learning-curve/`. */
	root: string;
	dataDir: string;
	config: LcConfig;
}

/** Walk up from `cwd` to find a directory containing `.learning-curve/config.json`. */
export function findWorkspaceRoot(cwd: string): string | undefined {
	let dir = resolve(cwd);
	for (;;) {
		if (existsSync(join(dir, WORKSPACE_DIR, CONFIG_FILE))) return dir;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

export function loadWorkspace(cwd: string): Workspace | undefined {
	const root = findWorkspaceRoot(cwd);
	if (!root) return undefined;
	const dataDir = join(root, WORKSPACE_DIR);
	const config = readJson<LcConfig>(join(dataDir, CONFIG_FILE));
	if (!config) return undefined;
	return { root, dataDir, config };
}

/** Absolute notes root (the vault folder). */
export function notesRoot(ws: Workspace): string {
	const r = ws.config.notesRoot || ".";
	return isAbsolute(r) ? r : resolve(ws.root, r);
}

export function saveConfig(root: string, config: LcConfig): void {
	const dataDir = join(root, WORKSPACE_DIR);
	mkdirSync(dataDir, { recursive: true });
	writeJsonAtomic(join(dataDir, CONFIG_FILE), config);
}

export function loadState(ws: Workspace): LcState {
	const state = readJson<LcState>(join(ws.dataDir, STATE_FILE));
	if (!state) return emptyState();
	// Forward-compatible defaults for older files.
	const base = emptyState();
	return { ...base, ...state };
}

export function saveState(ws: Workspace, state: LcState): void {
	writeJsonAtomic(join(ws.dataDir, STATE_FILE), state);
}

/** Run a read-modify-write on the state file. Callers in pi wrap this in the file mutation queue. */
export function updateState<T>(ws: Workspace, fn: (state: LcState) => T): T {
	const state = loadState(ws);
	const result = fn(state);
	saveState(ws, state);
	return result;
}

export function readJson<T>(path: string): T | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return undefined;
	}
}

export function writeJsonAtomic(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	renameSync(tmp, path);
}

/** Write a file only when it does not exist yet. Returns true when written. */
export function writeIfMissing(path: string, content: string): boolean {
	if (existsSync(path)) return false;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
	return true;
}

/** Replace the text between `<!-- lc:NAME:begin -->` and `<!-- lc:NAME:end -->` markers (append if missing). */
export function replaceMarkedSection(content: string, name: string, body: string): string {
	const begin = `<!-- lc:${name}:begin -->`;
	const end = `<!-- lc:${name}:end -->`;
	const block = `${begin}\n${body.trim()}\n${end}`;
	const start = content.indexOf(begin);
	const stop = content.indexOf(end);
	if (start !== -1 && stop > start) {
		return content.slice(0, start) + block + content.slice(stop + end.length);
	}
	return `${content.replace(/\s*$/, "")}\n\n${block}\n`;
}
