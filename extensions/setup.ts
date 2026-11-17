/** /learn-setup wizard: note app, vault, language, Obsidian plugins, Python/Manim/LaTeX, learner notes. */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { runProcess } from "./lib/exec.ts";
import { toPosix } from "./lib/paths.ts";
import { PLUGIN_CATALOG } from "./lib/plugins.ts";
import { detectLatex, PY_PACKAGES, venvPython } from "./lib/python.ts";
import { NOTE_APPS, setupWorkspace } from "./lib/setup.ts";
import { WORKSPACE_DIR } from "./lib/types.ts";
import { loadWorkspace } from "./lib/workspace.ts";
import { checklist } from "./ui/checklist.ts";

export const PENDING_INTRO = "pending-intro";

const APPS = NOTE_APPS;

const LANGUAGES = ["Italiano", "English", "Español", "Français", "Deutsch", "Português", "Other…"];

function step(ctx: ExtensionCommandContext, lines: string[]): void {
	ctx.ui.setWidget("lc-setup", ["Learning Curve setup", ...lines.slice(-8)]);
}

export function registerSetup(pi: ExtensionAPI): void {
	pi.registerEntryRenderer("lc-setup-report", (entry, _opts, theme) => {
		const data = entry.data as { lines: string[] };
		return new Text(`${theme.fg("accent", theme.bold("Learning Curve setup"))}\n${data.lines.join("\n")}`, 1, 0);
	});

	pi.registerCommand("learn-setup", {
		description: "Create or reconfigure a learning workspace (note app, vault, language, plugins, Python/Manim)",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/learn-setup needs the interactive UI.", "error");
				return;
			}
			await ctx.waitForIdle();
			const progress: string[] = [];
			const log = (line: string) => {
				progress.push(line);
				step(ctx, progress);
			};

			try {
				const existing = loadWorkspace(ctx.cwd);
				const prev = existing?.config;

				// 1. Note app
				const appLabel = await ctx.ui.select(
					prev ? `Note-taking app (current: ${prev.app.name})` : "Which note-taking app should hold your notes?",
					APPS.map((a) => a.label),
				);
				if (!appLabel) return;
				const app = APPS.find((a) => a.label === appLabel)!;
				let appName = app.name;
				if (app.id === "other") {
					const name = await ctx.ui.input("Name of the app", "e.g. Notion, Obsidian-like, Typora…");
					if (!name) return;
					appName = name.trim();
				}

				// 2. Vault folder
				const defaultVault = existing ? existing.root : ctx.cwd;
				const vaultInput = await ctx.ui.input(
					`${app.id === "obsidian" ? "Obsidian vault" : "Notes"} folder (absolute or relative to ${toPosix(ctx.cwd)}). Empty = ${toPosix(defaultVault)}`,
					toPosix(defaultVault),
				);
				if (vaultInput === undefined) return;
				const vault = vaultInput.trim() ? (isAbsolute(vaultInput.trim()) ? vaultInput.trim() : resolve(ctx.cwd, vaultInput.trim())) : defaultVault;
				if (!existsSync(vault)) {
					if (!(await ctx.ui.confirm("Create folder?", `${toPosix(vault)} does not exist. Create it?`))) return;
					mkdirSync(vault, { recursive: true });
				}

				// 3. Notes language
				let language = await ctx.ui.select(`Language for your notes${prev ? ` (current: ${prev.notesLanguage})` : ""}`, LANGUAGES);
				if (!language) return;
				if (language === "Other…") {
					const l = await ctx.ui.input("Notes language", "e.g. Nederlands");
					if (!l) return;
					language = l.trim();
				}

				// 4. Flashcards
				const flashcards =
					app.id === "obsidian"
						? await ctx.ui.confirm("Flashcards", "Write flashcards (Spaced Repetition plugin syntax) in a Flashcards note per topic, so you can also review inside Obsidian?")
						: false;

				// 5. Obsidian plugins
				let plugins: string[] = [];
				if (app.id === "obsidian") {
					const selected = await checklist(
						ctx,
						"Obsidian plugins to install (recommended ones are preselected)",
						PLUGIN_CATALOG.map((p) => ({
							id: p.id,
							label: p.name,
							description: p.why,
							group: p.category,
							checked: prev?.plugins?.includes(p.id) || p.recommended,
						})),
					);
					plugins = selected ?? [];
				}

				// 6. Python tools
				const venv = join(vault, WORKSPACE_DIR, "venv");
				const pyDesc = `Create a Python environment in ${toPosix(relative(vault, venv)) || venv} with ${PY_PACKAGES.join(", ")}.
Used to verify math (SymPy), draw plots and render Manim animations. Takes a few minutes.`;
				const python = await ctx.ui.confirm(existsSync(venvPython(venv)) ? "Update Python tools?" : "Install Python tools?", pyDesc);

				// 7. LaTeX for Manim
				let miktex = false;
				if ((python || existsSync(venvPython(venv))) && !(await detectLatex(runProcess)).available) {
					miktex = await ctx.ui.confirm(
						"Install MiKTeX?",
						"Manim needs LaTeX to show formulas inside videos (MathTex). MiKTeX is ≈1 GB and installs missing packages on the fly. Install it now with winget?",
					);
				}

				// 8. Do it
				const { ws, report } = await setupWorkspace({ vault, app: app.id, appName, notesLanguage: language, flashcards, plugins, python, miktex }, log);
				if (app.id === "obsidian" && plugins.length) report.push("  → Add or remove plugins later with /learn-plugins.");

				const inWorkspace = !relative(vault, ctx.cwd).startsWith("..") && !isAbsolute(relative(vault, ctx.cwd));
				report.push(
					inWorkspace
						? "Next: the learning-style interview (press Enter on /style), then /learn <topic>."
						: `Next: open a terminal in ${toPosix(vault)} and run pi there. Then /style and /learn <topic>.`,
				);

				ctx.ui.setWidget("lc-setup", undefined);
				pi.appendEntry("lc-setup-report", { lines: report });

				if (inWorkspace) {
					writeFileSync(join(ws.dataDir, PENDING_INTRO), "style", "utf8");
					await ctx.reload();
					return;
				}
			} catch (error) {
				ctx.ui.setWidget("lc-setup", undefined);
				ctx.ui.notify(`Setup failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}

