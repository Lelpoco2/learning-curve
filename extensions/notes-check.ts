/**
 * Obsidian note checking in pi:
 * - automatic: after every successful write/edit of a .md file in the vault, problems are
 *   appended to the tool result so the tutor fixes them immediately;
 * - /check-notes command: the learner runs the check and can ask the tutor to fix.
 * The note_check tool is defined in tools/notecheck.ts; the checking logic in lib/notecheck.ts.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { checkFiles, checkScope, checkWrittenNote, type FileReport, summarize } from "./lib/notecheck.ts";
import { listVaultFiles } from "./lib/vault-files.ts";
import { getWorkspace, setWorkspaceFromCwd } from "./runtime.ts";

export { checkFiles, checkScope, type FileReport, listVaultFiles };

export function registerNotesCheck(pi: ExtensionAPI): void {
	// ---------------------------------------------------------------- automatic check
	pi.on("tool_result", (event, ctx) => {
		if ((event.toolName !== "write" && event.toolName !== "edit") || event.isError) return;
		const ws = getWorkspace();
		const p = typeof event.input.path === "string" ? event.input.path : undefined;
		if (!ws || !p) return;
		try {
			const r = checkWrittenNote(ws, p, ctx.cwd);
			if (!r) return;
			return { content: [...event.content, { type: "text" as const, text: `\n\n${r.report}` }] };
		} catch {
			// Never break a write because of the checker.
		}
	});

	// ---------------------------------------------------------------- command
	pi.registerEntryRenderer("lc-note-check", (entry, _opts, theme) => {
		const data = entry.data as { lines: string[] };
		return new Text(`${theme.fg("accent", theme.bold("Note check"))}\n${data.lines.join("\n")}`, 1, 0);
	});

	pi.registerCommand("check-notes", {
		description: "Learning Curve: check notes for Obsidian formatting problems (a note, a folder, or the whole vault)",
		handler: async (args, ctx) => {
			const ws = getWorkspace() ?? setWorkspaceFromCwd(ctx.cwd);
			if (!ws) {
				ctx.ui.notify("Not inside a learning workspace.", "warning");
				return;
			}
			try {
				const scope = args.trim() || undefined;
				const { reports, checked } = checkScope(ws, scope);
				const s = summarize(reports, checked);
				if (s.errors + s.warnings === 0) {
					ctx.ui.notify(`Checked ${checked} note(s): no problems.`, "info");
					return;
				}
				pi.appendEntry("lc-note-check", { lines: s.text.split("\n") });
				if (!ctx.hasUI) {
					console.log(s.text);
					return;
				}
				if (s.errors > 0 && (await ctx.ui.confirm("Fix them?", `${s.errors} error(s) found. Ask the tutor to fix them now?`))) {
					const target = scope ? `"${scope}"` : "the whole vault";
					const text = `Run note_check on ${target} and fix every error (and the warnings that are real mistakes) without changing the content of the notes.`;
					if (ctx.isIdle()) pi.sendUserMessage(text);
					else pi.sendUserMessage(text, { deliverAs: "followUp" });
				}
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
