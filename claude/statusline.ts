/**
 * Optional Claude Code status line: the same progress line as pi ("📘 Analisi 1 0/19 › …").
 * Enable it in ~/.claude/settings.json (see README). Outside a learning workspace it prints the
 * folder name only, so it is harmless in coding projects.
 */

import { basename } from "node:path";
import { statusText } from "../extensions/lib/status.ts";
import { loadState, loadWorkspace } from "../extensions/lib/workspace.ts";

export async function main(): Promise<void> {
	let s = "";
	for await (const chunk of process.stdin) s += chunk;
	let input: { workspace?: { current_dir?: string }; cwd?: string; model?: { display_name?: string } } = {};
	try {
		input = JSON.parse(s || "{}");
	} catch {
		// keep defaults
	}
	const dir = input.workspace?.current_dir ?? input.cwd ?? process.cwd();
	const ws = loadWorkspace(dir);
	const model = input.model?.display_name ? ` · ${input.model.display_name}` : "";
	process.stdout.write(ws ? `${statusText(loadState(ws))}${model}` : `${basename(dir)}${model}`);
}
