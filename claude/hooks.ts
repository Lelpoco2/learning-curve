/**
 * Claude Code hooks (run by claude/run.mjs hook <event>, JSON on stdin):
 * - session-start: inside a learning workspace, do the start-up housekeeping (as pi does) and
 *   inject the tutor persona + learning context. Outside a workspace: nothing (coding sessions
 *   stay untouched).
 * - post-tool-use: after Write/Edit/MultiEdit of a vault note, check it and report problems to
 *   Claude (errors block-and-explain, warnings as context).
 */

import { checkWrittenNote } from "../extensions/lib/notecheck.ts";
import { refreshGenerated, scaffoldLearner } from "../extensions/lib/notes.ts";
import { renumberTopics } from "../extensions/lib/renumber.ts";
import { syncPluginConfig } from "../extensions/lib/setup.ts";
import { loadState, loadWorkspace, notesRoot, saveState } from "../extensions/lib/workspace.ts";
import { tutorContext } from "./tools.ts";

async function readStdin(): Promise<Record<string, unknown>> {
	let s = "";
	for await (const chunk of process.stdin) s += chunk;
	try {
		return JSON.parse(s || "{}") as Record<string, unknown>;
	} catch {
		return {};
	}
}

function out(obj: object): void {
	process.stdout.write(JSON.stringify(obj));
}

export function sessionStart(input: Record<string, unknown>): object | undefined {
	const cwd = String(input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
	const ws = loadWorkspace(cwd);
	if (!ws) return undefined;
	const notes: string[] = [];
	try {
		syncPluginConfig(ws);
		scaffoldLearner(ws);
		const state = loadState(ws);
		if (ws.config.numberTopicFolders === true) {
			const r = renumberTopics(state, notesRoot(ws));
			if (r.moved.length) {
				saveState(ws, state);
				notes.push(`Topic folders renumbered to follow the syllabus: ${r.moved.length} (links updated in ${r.filesUpdated} notes).`);
			}
		}
		refreshGenerated(ws, state);
	} catch {
		// housekeeping is best effort
	}
	const context = tutorContext(ws) + (notes.length ? `\n\n${notes.join("\n")}` : "");
	return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
}

export function postToolUse(input: Record<string, unknown>): object | undefined {
	const tool = String(input.tool_name ?? "");
	if (!/^(Write|Edit|MultiEdit)$/.test(tool)) return undefined;
	const path = (input.tool_input as { file_path?: string } | undefined)?.file_path;
	const cwd = String(input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
	const ws = loadWorkspace(cwd);
	if (!ws || !path) return undefined;
	try {
		const r = checkWrittenNote(ws, path, cwd);
		if (!r) return undefined;
		// "block" on PostToolUse does not undo the write: it shows the reason to Claude so it fixes it.
		if (r.errors > 0) return { decision: "block", reason: r.report };
		return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: r.report } };
	} catch {
		return undefined;
	}
}

/** Entry point: node run.mjs hook <session-start|post-tool-use>. */
export async function main(args: string[]): Promise<void> {
	const input = await readStdin();
	const result = args[0] === "session-start" ? sessionStart(input) : args[0] === "post-tool-use" ? postToolUse(input) : undefined;
	if (result) out(result);
}
