/** Tools that exist only in Claude Code (pi has interactive wizards for these). */

import { isAbsolute, resolve } from "node:path";
import { buildLearningContext } from "../extensions/lib/persona.ts";
import { PLUGIN_CATALOG } from "../extensions/lib/plugins.ts";
import { Type } from "../extensions/lib/schema.ts";
import {
	disablePlugins,
	installPlugins,
	listInstalledPlugins,
	NOTE_APPS,
	recommendedWithState,
	removePlugins,
	searchCommunity,
	setupWorkspace,
	syncPluginConfig,
} from "../extensions/lib/setup.ts";
import { StringEnum } from "../extensions/lib/schema.ts";
import { defineTool } from "../extensions/lib/tool.ts";
import { today } from "../extensions/lib/types.ts";
import { loadState, notesRoot, type Workspace } from "../extensions/lib/workspace.ts";
import { getWorkspace, requireWorkspace, setWorkspaceFromCwd, textResult } from "../extensions/runtime.ts";
import { claudeTutorPrompt } from "./platform.ts";

/** Persona + learning context, as injected at session start. */
export function tutorContext(ws: Workspace | undefined): string {
	const persona = claudeTutorPrompt();
	if (!ws) return `${persona}\n\n<learning_context>\nNo learning workspace in this folder yet: suggest /learning-curve:learn-setup.\n</learning_context>`;
	return `${persona}\n\n<learning_context>\n${buildLearningContext({ ws, state: loadState(ws), date: today() })}\n</learning_context>`;
}

export const claudeTools = [
	defineTool({
		name: "tutor_context",
		label: "Tutor context",
		description:
			"Return the Learning Curve tutor instructions and the current learning context (subjects, active topic and lesson, lesson kind, gaps, reviews due, learning style). Call it after workspace_setup, or when the context seems missing or stale.",
		parameters: Type.Object({}),
		async execute(_p, env) {
			const ws = setWorkspaceFromCwd(env.cwd) ?? getWorkspace();
			return textResult(tutorContext(ws), { workspace: !!ws });
		},
	}),

	defineTool({
		name: "workspace_setup",
		label: "Workspace setup",
		description:
			"Create or reconfigure the learning workspace (what /learn-setup does in pi). Ask the learner first, one question at a time: note app, vault folder, notes language, flashcards (Obsidian), Obsidian plugins (show the recommended list from obsidian_plugins), Python tools (SymPy, Manim…: a few minutes), MiKTeX (≈1 GB, only for formulas in Manim videos). Then call this once with the answers.",
		parameters: Type.Object({
			vault: Type.Optional(Type.String({ description: "Vault folder (absolute, or relative to the project folder). Default: the project folder." })),
			app: StringEnum(NOTE_APPS.map((a) => a.id) as ["obsidian", "logseq", "zettlr", "joplin", "markdown", "other"], { description: "Note-taking app" }),
			appName: Type.Optional(Type.String({ description: "Name of the app when app = other" })),
			notesLanguage: Type.String({ description: "Language of the notes, e.g. Italiano, English" }),
			flashcards: Type.Boolean({ description: "Obsidian: write Spaced Repetition flashcards (one note per topic)" }),
			plugins: Type.Optional(Type.Array(Type.String(), { description: "Obsidian plugin ids to install (from obsidian_plugins recommended), or ['recommended']" })),
			python: Type.Boolean({ description: "Create/update the Python environment (SymPy, NumPy, SciPy, matplotlib, Manim, pypdf)" }),
			miktex: Type.Optional(Type.Boolean({ description: "Install MiKTeX with winget if LaTeX is missing (Windows)" })),
		}),
		async execute(p, env) {
			const vault = p.vault ? (isAbsolute(p.vault) ? p.vault : resolve(env.cwd, p.vault)) : env.cwd;
			const plugins = p.app !== "obsidian" ? [] : p.plugins?.includes("recommended") ? PLUGIN_CATALOG.filter((x) => x.recommended).map((x) => x.id) : (p.plugins ?? []);
			const log: string[] = [];
			const { ws, report } = await setupWorkspace(
				{ vault, app: p.app, appName: p.appName, notesLanguage: p.notesLanguage, flashcards: p.flashcards, plugins, python: p.python, miktex: p.miktex ?? false },
				(line) => {
					log.push(line);
					env.progress?.(line);
				},
				env.signal,
			);
			setWorkspaceFromCwd(ws.root);
			const sameFolder = resolve(ws.root) === resolve(env.cwd);
			report.push(
				sameFolder
					? "Next: call tutor_context, then propose the learning-style interview (/learning-curve:style), then /learning-curve:learn <topic>."
					: `Next: open Claude Code in ${ws.root} (the workspace folder) and run /learning-curve:style there.`,
			);
			return textResult(report.join("\n"), { vault: ws.root });
		},
	}),

	defineTool({
		name: "obsidian_plugins",
		label: "Obsidian plugins",
		description:
			"Manage the Obsidian plugins of the workspace vault (what /learn-plugins does in pi): list installed ones, show the recommended list, search the whole community catalog, install, update (reinstall latest), disable or remove. Ask the learner before changing anything.",
		parameters: Type.Object({
			action: StringEnum(["installed", "recommended", "search", "install", "update", "disable", "remove"] as const),
			ids: Type.Optional(Type.Array(Type.String(), { description: "Plugin ids (install/update/disable/remove)" })),
			query: Type.Optional(Type.String({ description: "search: words to look for" })),
		}),
		async execute(p, env) {
			const ws = requireWorkspace();
			if (ws.config.app.id !== "obsidian") throw new Error("The workspace does not use Obsidian.");
			const vault = notesRoot(ws);
			const lines: string[] = [];
			switch (p.action) {
				case "installed": {
					const list = listInstalledPlugins(vault);
					lines.push(list.length ? list.map((x) => `- ${x.id} — ${x.name} ${x.version ?? ""} ${x.enabled ? "(enabled)" : "(disabled)"}`).join("\n") : "No community plugins installed.");
					break;
				}
				case "recommended":
					for (const r of recommendedWithState(vault)) {
						lines.push(`- ${r.info.id} — ${r.info.name} [${r.info.category}]${r.info.recommended ? " ★" : ""}${r.installed ? (r.enabled ? " ✓ installed" : " (installed, disabled)") : ""}: ${r.info.why}`);
					}
					lines.push("★ = preselected in the pi wizard.");
					break;
				case "search": {
					if (!p.query?.trim()) throw new Error("query is required");
					const hits = await searchCommunity(ws.dataDir, p.query, 15, env.signal);
					lines.push(hits.length ? hits.map((h) => `- ${h.id} — ${h.name} (${h.downloads.toLocaleString("en")} downloads): ${h.description}`).join("\n") : "No plugin found.");
					break;
				}
				case "install":
				case "update": {
					if (!p.ids?.length) throw new Error("ids are required");
					const known = new Map(PLUGIN_CATALOG.map((x) => [x.id, x]));
					const infos = [];
					for (const id of p.ids) {
						const info = known.get(id) ?? (await searchCommunity(ws.dataDir, id, 5, env.signal)).find((h) => h.id === id);
						if (info) infos.push(info);
						else lines.push(`✗ ${id}: not found in the community catalog`);
					}
					const results = await installPlugins(vault, ws.config, infos, (l) => env.progress?.(l), env.signal);
					for (const r of results) lines.push(r.ok ? `✓ ${r.name} ${r.version ?? ""}`.trim() : `✗ ${r.name}: ${r.error}`);
					lines.push("Reload Obsidian (or toggle the plugin) to load new versions.");
					break;
				}
				case "disable":
					if (!p.ids?.length) throw new Error("ids are required");
					disablePlugins(vault, p.ids);
					lines.push(`Disabled: ${p.ids.join(", ")}.`);
					break;
				case "remove":
					if (!p.ids?.length) throw new Error("ids are required");
					removePlugins(vault, p.ids);
					lines.push(`Removed: ${p.ids.join(", ")}.`);
					break;
			}
			syncPluginConfig(ws);
			return textResult(lines.join("\n"), { action: p.action });
		},
	}),
];
