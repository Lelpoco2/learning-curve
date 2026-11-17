/** Per-session runtime: the active workspace and serialized state updates. */

import { join, relative, resolve } from "node:path";
import { refreshGenerated } from "./lib/notes.ts";
import { type LcState, STATE_FILE } from "./lib/types.ts";
import { loadState, loadWorkspace, notesRoot, saveState, type Workspace } from "./lib/workspace.ts";

let current: Workspace | undefined;

export function setWorkspaceFromCwd(cwd: string): Workspace | undefined {
	current = loadWorkspace(cwd);
	return current;
}

export function getWorkspace(): Workspace | undefined {
	return current;
}

export function requireWorkspace(): Workspace {
	if (!current) throw new Error("Not inside a learning workspace. Run /learn-setup first, then start pi inside the vault.");
	return current;
}

const queues = new Map<string, Promise<unknown>>();

/** Run fn after every earlier update of the same file has finished (in this process). */
function serialized<T>(file: string, fn: () => Promise<T>): Promise<T> {
	const prev = queues.get(file) ?? Promise.resolve();
	const next = prev.then(fn, fn);
	queues.set(
		file,
		next.catch(() => undefined),
	);
	return next;
}

/** Serialized read-modify-write of state.json, then refresh generated note sections. */
export async function mutateState<T>(fn: (state: LcState, ws: Workspace) => T): Promise<T> {
	const ws = requireWorkspace();
	return serialized(join(ws.dataDir, STATE_FILE), async () => {
		const state = loadState(ws);
		const result = fn(state, ws);
		saveState(ws, state);
		try {
			refreshGenerated(ws, state);
		} catch {
			// Generated sections are a convenience; never fail a tool because of them.
		}
		return result;
	});
}

export function readState(): LcState {
	return loadState(requireWorkspace());
}

/** Resolve a vault-relative (or absolute) path and make sure it stays inside the vault. */
export function resolveInVault(ws: Workspace, path: string): string {
	const vault = notesRoot(ws);
	const cleaned = path.replace(/^@/, "");
	const abs = resolve(vault, cleaned);
	const rel = relative(vault, abs);
	if (rel.startsWith("..") || resolve(vault, rel) !== abs) throw new Error(`Path must be inside the vault: ${path}`);
	return abs;
}

export function textResult<T>(text: string, details: T) {
	return { content: [{ type: "text" as const, text }], details };
}
