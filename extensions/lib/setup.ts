/**
 * Workspace setup and Obsidian plugin management, shared by pi (/learn-setup, /learn-plugins
 * wizards) and the Claude Code tools (workspace_setup, obsidian_plugins). No UI here: the
 * callers ask the questions, these functions act.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadCatalog } from "./community.ts";
import { runProcess } from "./exec.ts";
import { disablePlugins, enablePlugins, ensureVault, installPlugin, type InstallResult, listInstalledPlugins, removePlugins, seedPluginData } from "./obsidian.ts";
import { scaffoldLearner } from "./notes.ts";
import { learnerPaths, toPosix } from "./paths.ts";
import { findPlugin, PLUGIN_CATALOG, type PluginInfo, searchCatalog, toPluginInfo } from "./plugins.ts";
import { createVenv, detectLatex, installMiktex, PY_PACKAGES, probePython, type SetupStep, venvPython } from "./python.ts";
import { type LcConfig, type NoteAppId, WORKSPACE_DIR } from "./types.ts";
import { loadWorkspace, notesRoot, saveConfig, type Workspace } from "./workspace.ts";

export const NOTE_APPS: { id: NoteAppId; label: string; name: string }[] = [
	{ id: "obsidian", label: "Obsidian (recommended)", name: "Obsidian" },
	{ id: "logseq", label: "Logseq", name: "Logseq" },
	{ id: "zettlr", label: "Zettlr", name: "Zettlr" },
	{ id: "joplin", label: "Joplin", name: "Joplin" },
	{ id: "markdown", label: "Plain Markdown folder (any editor)", name: "Markdown" },
	{ id: "other", label: "Other… (the tutor will learn how to use it)", name: "Other" },
];

export interface SetupOptions {
	/** Absolute vault folder (created if missing). */
	vault: string;
	app: NoteAppId;
	/** Name of the app when app = "other". */
	appName?: string;
	notesLanguage: string;
	flashcards: boolean;
	/** Obsidian plugin ids to install (Obsidian only). */
	plugins: string[];
	/** Create or update the Python venv (SymPy, Manim…). */
	python: boolean;
	/** Install MiKTeX when LaTeX is missing (Windows, winget). */
	miktex: boolean;
}

export interface SetupResult {
	ws: Workspace;
	report: string[];
}

/** Create or reconfigure a workspace. Progress lines go to log; the summary is in report. */
export async function setupWorkspace(o: SetupOptions, log: (line: string) => void = () => {}, signal?: AbortSignal): Promise<SetupResult> {
	const vault = o.vault;
	if (!existsSync(vault)) mkdirSync(vault, { recursive: true });
	const prev = loadWorkspace(vault)?.config;
	const app = NOTE_APPS.find((a) => a.id === o.app) ?? NOTE_APPS[0];
	const appName = o.app === "other" ? (o.appName?.trim() || "Other") : app.name;
	const config: LcConfig = {
		version: 1,
		app: { id: app.id, name: appName },
		notesRoot: ".",
		notesLanguage: o.notesLanguage,
		passThreshold: prev?.passThreshold ?? 0.8,
		learnerFolder: prev?.learnerFolder ?? "00 Learner",
		flashcards: app.id === "obsidian" ? o.flashcards : false,
		numberTopicFolders: prev?.numberTopicFolders ?? true,
		mathExponents: prev?.mathExponents,
		sourcesFolder: prev?.sourcesFolder,
		python: prev?.python,
		plugins: prev?.plugins ?? [],
		createdAt: prev?.createdAt ?? new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	saveConfig(vault, config);
	log(`✓ Workspace: ${toPosix(join(vault, WORKSPACE_DIR))}`);
	const report: string[] = [];

	// Obsidian plugins
	if (app.id === "obsidian") {
		ensureVault(vault);
		if (o.plugins.length) {
			const infos = o.plugins.map((id) => findPlugin(id)).filter((x): x is PluginInfo => !!x);
			const unknown = o.plugins.filter((id) => !findPlugin(id));
			const results = await installPlugins(vault, config, infos, log, signal);
			config.plugins = [...new Set([...(config.plugins ?? []), ...results.filter((r) => r.ok).map((r) => r.id)])];
			report.push(`Plugins: ${results.filter((r) => r.ok).map((r) => `${r.name} ${r.version ?? ""}`.trim()).join(", ") || "none"}`);
			for (const r of results.filter((x) => !x.ok)) report.push(`  ✗ ${r.name}: ${r.error}`);
			if (unknown.length) report.push(`  ✗ not in the recommended list (use obsidian_plugins search/install): ${unknown.join(", ")}`);
			report.push("  → In Obsidian: Settings → Community plugins → turn off Restricted mode, then reload the vault.");
		}
	}

	// Python tools
	const venv = join(vault, WORKSPACE_DIR, "venv");
	if (o.python) {
		const res = await createVenv(runProcess, venv, PY_PACKAGES, log);
		reportSteps(report, "Python", res.steps);
	}
	if (o.miktex) {
		const latex = await detectLatex(runProcess);
		if (!latex.available) reportSteps(report, "MiKTeX", await installMiktex(runProcess, log, signal));
	}
	const python = existsSync(venvPython(venv)) ? venvPython(venv) : config.python?.python;
	if (python) {
		config.python = await probePython(runProcess, python, existsSync(venvPython(venv)) ? venv : undefined);
		const py = config.python;
		report.push(`Python: sympy ${mark(py.sympy)} · matplotlib ${mark(py.matplotlib)} · manim ${mark(py.manim)} · LaTeX ${mark(py.latex)}`);
	} else {
		const sys = await probePython(runProcess, process.platform === "win32" ? "python" : "python3");
		if (sys.sympy) {
			config.python = sys;
			report.push("Python: using the system interpreter (SymPy found).");
		} else report.push("Python: not configured — math_check, plots and Manim are disabled until setup is run again with Python.");
	}
	config.updatedAt = new Date().toISOString();
	saveConfig(vault, config);

	// Learner notes and app profile
	const ws: Workspace = { root: vault, dataDir: join(vault, WORKSPACE_DIR), config };
	const created = scaffoldLearner(ws);
	report.push(`Put your textbooks and course notes in "${config.sourcesFolder ?? "Sources"}/" (PDF/Markdown): the tutor checks facts there first.`);
	if (created.length) report.push(`Notes created: ${created.map((c) => toPosix(relative(vault, c))).join(", ")}`);
	if (app.id !== "obsidian") {
		const profile = join(ws.dataDir, "app-profile.md");
		if (!existsSync(profile)) {
			writeFileSync(
				profile,
				`---\napp: ${appName}\nstatus: to-learn\n---\n\n# ${appName} — how to write notes\n\nTo be completed by the tutor with the notes-adapter skill (research the app's documentation and/or interview the learner).\n`,
				"utf8",
			);
		}
		report.push("App profile: .learning-curve/app-profile.md (the tutor completes it on first use).");
	}
	report.push(`Dashboard: ${toPosix(relative(vault, learnerPaths(vault, config.learnerFolder).dashboard))}`);
	return { ws, report };
}

function mark(v: boolean): string {
	return v ? "✓" : "✗";
}

function reportSteps(report: string[], label: string, steps: SetupStep[]): void {
	for (const s of steps) {
		report.push(`${label} ${s.step}: ${s.ok ? "✓" : "✗"}`);
		if (!s.ok && s.output) report.push(...s.output.split(/\r?\n/).slice(-6).map((l) => `    ${l}`));
	}
}

/** Download, enable and seed settings of plugins. */
export async function installPlugins(vault: string, config: LcConfig, infos: PluginInfo[], log: (line: string) => void = () => {}, signal?: AbortSignal): Promise<InstallResult[]> {
	const results: InstallResult[] = [];
	for (const [i, info] of infos.entries()) {
		log(`… downloading ${info.name} (${i + 1}/${infos.length})`);
		results.push(await installPlugin(vault, info, signal));
	}
	const ok = results.filter((r) => r.ok).map((r) => r.id);
	enablePlugins(vault, ok);
	seedPluginSettings(vault, config, ok);
	return results;
}

/** Sensible defaults for plugins that have no settings yet (never overwrites). */
export function seedPluginSettings(vault: string, config: LcConfig, ids: string[]): void {
	const dashboard = `${toPosix(join(config.learnerFolder, "Dashboard"))}.md`;
	if (ids.includes("homepage")) {
		// Mirrors DEFAULT_DATA of mirnovov/obsidian-homepage (settings version 5).
		seedPluginData(vault, "homepage", {
			version: 5,
			homepages: {
				"Main Homepage": {
					value: dashboard,
					kind: "File",
					openOnStartup: true,
					openMode: "Replace all open notes",
					manualOpenMode: "Keep open notes",
					view: "Reading view",
					revertView: true,
					openWhenEmpty: false,
					openOnNewTab: false,
					refreshDataview: true,
					autoCreate: false,
					autoScroll: false,
					pin: false,
					commands: [],
					alwaysApply: false,
					hideReleaseNotes: false,
				},
			},
			separateMobile: false,
		});
	}
	if (ids.includes("obsidian-latex")) seedPluginData(vault, "obsidian-latex", { preamblePath: "preamble.sty" });
	// Folder notes defaults already match the layout (index note named like its folder, inside it): nothing to seed.
}

/** Record the enabled, installed plugins in config.plugins. Returns true when it changed. */
export function syncPluginConfig(ws: Workspace): boolean {
	if (ws.config.app.id !== "obsidian") return false;
	const enabled = listInstalledPlugins(notesRoot(ws))
		.filter((p) => p.enabled)
		.map((p) => p.id)
		.sort();
	const before = [...(ws.config.plugins ?? [])].sort();
	if (JSON.stringify(before) === JSON.stringify(enabled)) return false;
	ws.config.plugins = enabled;
	ws.config.updatedAt = new Date().toISOString();
	saveConfig(ws.root, ws.config);
	return true;
}

/** The recommended list with install state, and catalog search (for tools and wizards). */
export function recommendedWithState(vault: string): { info: PluginInfo; installed: boolean; enabled: boolean }[] {
	const installed = listInstalledPlugins(vault);
	return PLUGIN_CATALOG.map((info) => {
		const i = installed.find((p) => p.id === info.id);
		return { info, installed: !!i, enabled: !!i?.enabled };
	});
}

export async function searchCommunity(dataDir: string, query: string, limit = 15, signal?: AbortSignal): Promise<(PluginInfo & { downloads: number; description: string })[]> {
	const catalog = await loadCatalog(dataDir, signal);
	return searchCatalog(catalog.plugins, catalog.stats, query, limit).map((h) => ({ ...toPluginInfo(h), downloads: h.downloads, description: h.description }));
}

export { disablePlugins, ensureVault, listInstalledPlugins, removePlugins };
