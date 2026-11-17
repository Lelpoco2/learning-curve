/**
 * Learning Curve — turns pi into a structured STEM tutor.
 *
 * Dormant outside a learning workspace (a folder containing .learning-curve/config.json).
 * Inside one it replaces the coding preamble with the tutor persona, activates the
 * learning tools and contributes the learning skills.
 */

import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands.ts";
import { nextLesson } from "./lib/curriculum.ts";
import { PROMPTS_DIR, refreshGenerated, scaffoldLearner, SKILLS_DIR } from "./lib/notes.ts";
import { buildLearningContext, TUTOR_PREAMBLE } from "./lib/persona.ts";
import { dueItems } from "./lib/srs.ts";
import { examDue, subjectProgress } from "./lib/subjects.ts";
import { today } from "./lib/types.ts";
import { pendingRenames, renumberTopics } from "./lib/renumber.ts";
import { loadState, loadWorkspace, notesRoot, saveConfig, type Workspace } from "./lib/workspace.ts";
import { getWorkspace, mutateState, setWorkspaceFromCwd } from "./runtime.ts";
import { registerMathDisplay } from "./math-display.ts";
import { registerNotesCheck } from "./notes-check.ts";
import { registerPluginsCommand, syncPluginConfig } from "./plugins-command.ts";
import { PENDING_INTRO, registerSetup } from "./setup.ts";
import { ALL_TOOLS, registerPiTools } from "./pi-tools.ts";
import { statusText } from "./lib/status.ts";

const LC_TOOLS = ALL_TOOLS.map((t) => t.name);
const STATUS_KEY = "learning-curve";

function updateStatus(ctx: ExtensionContext): void {
	try {
		const ws = getWorkspace();
		if (!ws || !ctx.hasUI) return;
		ctx.ui.setStatus(STATUS_KEY, statusText(loadState(ws)));
	} catch {
		// The context can be stale after a reload/session switch; the status is cosmetic.
	}
}

/**
 * Topic folders follow the syllabus order ("01 - Topic"). New workspaces have it enabled; older
 * ones are asked once (renames folders and updates links). Runs on every start when enabled, so
 * the folders stay in order after syllabus changes or manual state edits.
 */
async function numberTopicFoldersOnStart(ws: Workspace, ctx: ExtensionContext): Promise<void> {
	try {
		if (ws.config.numberTopicFolders === false) return;
		const vault = notesRoot(ws);
		if (ws.config.numberTopicFolders === undefined) {
			const pending = pendingRenames(loadState(ws), vault);
			if (pending.length > 0) {
				if (!ctx.hasUI) return; // decide in an interactive session
				const example = pending
					.slice(0, 3)
					.map((m) => `  ${m.subject}/${m.from} → ${m.to}`)
					.join("\n");
				const ok = await ctx.ui.confirm(
					"Number topic folders?",
					`Topic folders can follow the syllabus order, like lessons:\n${example}${pending.length > 3 ? `\n  … ${pending.length - 3} more` : ""}\n\n${pending.length} folder(s) and their index notes will be renamed, and every link in your notes updated. Obsidian can stay open.`,
				);
				ws.config.numberTopicFolders = ok;
			} else ws.config.numberTopicFolders = true;
			ws.config.updatedAt = new Date().toISOString();
			saveConfig(ws.root, ws.config);
			if (!ws.config.numberTopicFolders) return;
		}
		const r = await mutateState((state) => renumberTopics(state, vault));
		if (ctx.hasUI && (r.moved.length || r.conflicts.length)) {
			const msg = [
				r.moved.length ? `Numbered ${r.moved.length} topic folder(s) in syllabus order; links updated in ${r.filesUpdated} note(s).` : "",
				r.conflicts.length ? `Not renamed (target exists or in use): ${r.conflicts.map((c) => c.from).join(", ")}.` : "",
			]
				.filter(Boolean)
				.join(" ");
			ctx.ui.notify(msg, r.conflicts.length ? "warning" : "info");
		}
	} catch (error) {
		if (ctx.hasUI) ctx.ui.notify(`Topic folder numbering failed: ${error instanceof Error ? error.message : String(error)}`, "error");
	}
}

export default function learningCurve(pi: ExtensionAPI) {
	registerSetup(pi);
	registerPluginsCommand(pi);
	registerCommands(pi);
	registerPiTools(pi, ALL_TOOLS);
	registerNotesCheck(pi);
	registerMathDisplay(pi);

	pi.on("session_start", async (_event, ctx) => {
		const ws = setWorkspaceFromCwd(ctx.cwd);
		if (!ws) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		pi.setActiveTools([...new Set([...pi.getActiveTools(), ...LC_TOOLS])]);
		try {
			// Plugins may also be installed from Obsidian itself: keep the config in sync.
			syncPluginConfig(ws);
			scaffoldLearner(ws);
			refreshGenerated(ws, loadState(ws));
		} catch {
			// best effort
		}
		// Deferred: pi only reads dialog answers once startup has finished, so a prompt awaited
		// inside session_start would never get its reply.
		setTimeout(() => {
			void numberTopicFoldersOnStart(ws, ctx).then(() => updateStatus(ctx));
		}, 300);
		updateStatus(ctx);
		if (ctx.hasUI) ctx.ui.setTitle(`pi · Learning Curve`);

		const pending = join(ws.dataDir, PENDING_INTRO);
		if (existsSync(pending) && ctx.hasUI) {
			rmSync(pending, { force: true });
			ctx.ui.setEditorText("/style");
			ctx.ui.notify("Learning workspace ready. Press Enter to start the learning-style interview, or type /learn <topic>.", "info");
		}
	});

	pi.on("resources_discover", (event) => {
		const ws = loadWorkspace(event.cwd);
		if (!ws) return;
		return { skillPaths: [SKILLS_DIR], promptPaths: [PROMPTS_DIR] };
	});

	pi.on("before_agent_start", (event) => {
		const ws = getWorkspace();
		if (!ws) return;
		const opts = event.systemPromptOptions;
		opts.customPrompt = TUTOR_PREAMBLE;
		// Keep the tutor focused: only the learning skills are advertised inside a workspace.
		const ours = resolve(SKILLS_DIR).toLowerCase();
		opts.skills = opts.skills?.filter((s) => resolve(s.filePath).toLowerCase().startsWith(ours));
		const state = loadState(ws);
		opts.sections.learning_context = buildLearningContext({ ws, state, date: today() });
	});

	pi.on("agent_settled", (_event, ctx) => updateStatus(ctx));
}
