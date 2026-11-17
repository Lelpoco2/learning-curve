import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { disablePlugins, enablePlugins, listInstalledPlugins, readEnabledPlugins, removePlugins } from "../extensions/lib/obsidian.ts";
import { formatDownloads, searchCatalog, toPluginInfo } from "../extensions/lib/plugins.ts";
import { syncPluginConfig } from "../extensions/plugins-command.ts";
import type { LcConfig } from "../extensions/lib/types.ts";
import { saveConfig } from "../extensions/lib/workspace.ts";

const catalog = [
	{ id: "mathlive", name: "MathLive", author: "a", description: "Visual LaTeX math editor with formula OCR.", repo: "x/mathlive" },
	{ id: "obsidian-latex-suite", name: "Latex Suite", author: "b", description: "Type LaTeX fast.", repo: "artisticat1/obsidian-latex-suite" },
	{ id: "quick-latex", name: "Quick Latex", author: "c", description: "Simplify LaTeX math typing.", repo: "x/quick" },
	{ id: "chem", name: "Chemistry", author: "d", description: "Render molecules.", repo: "x/chem" },
];
const stats = { mathlive: { downloads: 33_000 }, "obsidian-latex-suite": { downloads: 713_000 }, "quick-latex": { downloads: 211_000 } };

test("searchCatalog ranks exact matches, then names, then descriptions, by downloads", () => {
	assert.deepEqual(searchCatalog(catalog, stats, "latex").map((h) => h.id), ["obsidian-latex-suite", "quick-latex", "mathlive"]);
	assert.equal(searchCatalog(catalog, stats, "mathlive")[0].id, "mathlive");
	assert.deepEqual(searchCatalog(catalog, stats, "latex ocr").map((h) => h.id), ["mathlive"]);
	assert.deepEqual(searchCatalog(catalog, stats, "   "), []);
	assert.equal(searchCatalog(catalog, stats, "molecules")[0].downloads, 0);
});

test("toPluginInfo keeps curated metadata for known plugins", () => {
	assert.equal(toPluginInfo(catalog[1]).recommended, true);
	assert.equal(toPluginInfo(catalog[0]).why, "Visual LaTeX math editor with formula OCR.");
	assert.equal(formatDownloads(713_000), "713k");
	assert.equal(formatDownloads(2_400_000), "2.4M");
});

function fakeVault(): string {
	const vault = mkdtempSync(join(tmpdir(), "lc-plugins-"));
	for (const [id, name] of [["dataview", "Dataview"], ["obsidian-desmos", "Desmos"]]) {
		mkdirSync(join(vault, ".obsidian", "plugins", id), { recursive: true });
		writeFileSync(join(vault, ".obsidian", "plugins", id, "manifest.json"), JSON.stringify({ id, name, version: "1.0.0" }));
		writeFileSync(join(vault, ".obsidian", "plugins", id, "data.json"), "{}");
	}
	mkdirSync(join(vault, ".obsidian", "plugins", "not-a-plugin"), { recursive: true });
	enablePlugins(vault, ["dataview", "obsidian-desmos"]);
	return vault;
}

test("list, disable and remove plugins in a vault", () => {
	const vault = fakeVault();
	assert.deepEqual(listInstalledPlugins(vault).map((p) => `${p.name}:${p.enabled}`), ["Dataview:true", "Desmos:true"]);
	disablePlugins(vault, ["obsidian-desmos"]);
	assert.deepEqual(readEnabledPlugins(vault), ["dataview"]);
	assert.ok(existsSync(join(vault, ".obsidian", "plugins", "obsidian-desmos", "data.json")), "disable keeps settings");
	removePlugins(vault, ["obsidian-desmos", "../../evil"]);
	assert.equal(existsSync(join(vault, ".obsidian", "plugins", "obsidian-desmos")), false);
	assert.deepEqual(listInstalledPlugins(vault).map((p) => p.id), ["dataview"]);
});

test("syncPluginConfig records enabled plugins in the workspace config", () => {
	const vault = fakeVault();
	const config: LcConfig = {
		version: 1,
		app: { id: "obsidian", name: "Obsidian" },
		notesRoot: ".",
		notesLanguage: "English",
		passThreshold: 0.8,
		learnerFolder: "00 Learner",
		flashcards: true,
		plugins: [],
		createdAt: "x",
		updatedAt: "x",
	};
	saveConfig(vault, config);
	const ws = { root: vault, dataDir: join(vault, ".learning-curve"), config };
	assert.equal(syncPluginConfig(ws), true);
	assert.deepEqual(config.plugins, ["dataview", "obsidian-desmos"]);
	assert.equal(syncPluginConfig(ws), false, "no change the second time");
	disablePlugins(vault, ["dataview"]);
	syncPluginConfig(ws);
	assert.deepEqual(JSON.parse(readFileSync(join(vault, ".learning-curve", "config.json"), "utf8")).plugins, ["obsidian-desmos"]);
});
