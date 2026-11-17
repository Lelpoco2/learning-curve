/**
 * Curated Obsidian community plugins for STEM learning.
 * Selection based on the official community-plugin-stats.json (downloads, Nov 2026)
 * filtered for general quality of life, LaTeX, graphs and math.
 */

export type PluginCategory = "math" | "graphs" | "learning" | "quality-of-life";

export interface PluginInfo {
	id: string;
	name: string;
	repo: string;
	category: PluginCategory;
	why: string;
	recommended: boolean;
}

export const PLUGIN_CATALOG: PluginInfo[] = [
	// Math / LaTeX
	{ id: "obsidian-latex-suite", name: "Latex Suite", repo: "artisticat1/obsidian-latex-suite", category: "math", why: "Type LaTeX fast: snippets, auto-fractions, matrix shortcuts, inline preview.", recommended: true },
	{ id: "obsidian-latex", name: "Extended MathJax", repo: "wei2912/obsidian-latex", category: "math", why: "Shared preamble.sty with custom macros and extra MathJax packages.", recommended: true },
	{ id: "obsidian-tikzjax", name: "TikZJax", repo: "artisticat1/obsidian-tikzjax", category: "graphs", why: "Render TikZ diagrams: geometry, circuits, commutative diagrams, plots (pgfplots).", recommended: true },
	{ id: "obsidian-desmos", name: "Desmos", repo: "nigecat/obsidian-desmos", category: "graphs", why: "Interactive function graphs embedded in notes.", recommended: true },
	{ id: "obsidian-charts", name: "Charts", repo: "phibr0/obsidian-charts", category: "graphs", why: "Data charts (lines, bars, scatter) from code blocks.", recommended: false },
	{ id: "obsidian-excalidraw-plugin", name: "Excalidraw", repo: "zsviczian/obsidian-excalidraw-plugin", category: "graphs", why: "Hand-drawn sketches and diagrams with LaTeX support.", recommended: true },
	// Learning
	{ id: "obsidian-spaced-repetition", name: "Spaced Repetition", repo: "st3v3nmw/obsidian-spaced-repetition", category: "learning", why: "Review the flashcards the tutor writes for each topic, inside Obsidian.", recommended: true },
	{ id: "dataview", name: "Dataview", repo: "blacksmithgu/obsidian-dataview", category: "learning", why: "Progress dashboards built from note properties.", recommended: true },
	{ id: "media-extended", name: "Media Extended", repo: "aidenlx/media-extended", category: "learning", why: "Better playback for Manim videos (speed, loops, timestamps).", recommended: false },
	{ id: "execute-code", name: "Execute Code", repo: "twibiral/obsidian-execute-code", category: "learning", why: "Run Python (SymPy) code blocks directly in notes.", recommended: false },
	// Quality of life
	{ id: "folder-notes", name: "Folder notes", repo: "lostpaul/obsidian-folder-notes", category: "quality-of-life", why: "Subject and topic index notes open when clicking their folder.", recommended: true },
	{ id: "omnisearch", name: "Omnisearch", repo: "scambier/obsidian-omnisearch", category: "quality-of-life", why: "Fast full-text search across all notes.", recommended: true },
	{ id: "homepage", name: "Homepage", repo: "mirnovov/obsidian-homepage", category: "quality-of-life", why: "Open the learning Dashboard when Obsidian starts.", recommended: true },
	{ id: "table-editor-obsidian", name: "Advanced Tables", repo: "tgrosinger/advanced-tables-obsidian", category: "quality-of-life", why: "Comfortable Markdown table editing.", recommended: true },
	{ id: "templater-obsidian", name: "Templater", repo: "SilentVoid13/Templater", category: "quality-of-life", why: "Templates for notes you write by hand.", recommended: false },
	{ id: "obsidian-git", name: "Git", repo: "Vinzent03/obsidian-git", category: "quality-of-life", why: "Version and back up the vault (undo reformulations).", recommended: false },
	{ id: "obsidian-style-settings", name: "Style Settings", repo: "obsidian-community/obsidian-style-settings", category: "quality-of-life", why: "Tune theme appearance.", recommended: false },
	{ id: "obsidian-icon-folder", name: "Iconize", repo: "FlorianWoelki/obsidian-iconize", category: "quality-of-life", why: "Icons for subjects and topics in the file tree.", recommended: false },
];

export function recommendedPlugins(): PluginInfo[] {
	return PLUGIN_CATALOG.filter((p) => p.recommended);
}

export function findPlugin(id: string): PluginInfo | undefined {
	return PLUGIN_CATALOG.find((p) => p.id === id);
}

/** Entry of the official obsidianmd/obsidian-releases community-plugins.json. */
export interface CommunityPlugin {
	id: string;
	name: string;
	author?: string;
	description: string;
	repo: string;
}

export interface CatalogHit extends CommunityPlugin {
	downloads: number;
}

/**
 * Search the community catalog by id, name and description.
 * Ranking: exact id/name, then name/id containing the query, then description; ties by downloads.
 */
export function searchCatalog(
	plugins: CommunityPlugin[],
	stats: Record<string, { downloads?: number }>,
	query: string,
	limit = 15,
): CatalogHit[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];
	const q = terms.join(" ");
	const scored: { hit: CatalogHit; score: number }[] = [];
	for (const p of plugins) {
		const id = p.id.toLowerCase();
		const name = p.name.toLowerCase();
		const desc = (p.description ?? "").toLowerCase();
		let score = 0;
		if (id === q || name === q) score = 100;
		else if (terms.every((t) => name.includes(t) || id.includes(t))) score = 50;
		else if (terms.every((t) => name.includes(t) || id.includes(t) || desc.includes(t))) score = 10;
		if (score === 0) continue;
		scored.push({ hit: { ...p, downloads: stats[p.id]?.downloads ?? 0 }, score });
	}
	scored.sort((a, b) => b.score - a.score || b.hit.downloads - a.hit.downloads);
	return scored.slice(0, limit).map((s) => s.hit);
}

/** Convert a catalog entry to the installer's PluginInfo (curated metadata wins when known). */
export function toPluginInfo(p: CommunityPlugin): PluginInfo {
	return findPlugin(p.id) ?? { id: p.id, name: p.name, repo: p.repo, category: "quality-of-life", why: p.description, recommended: false };
}

export function formatDownloads(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return String(n);
}

/** Merge plugin ids into the content of `.obsidian/community-plugins.json`. */
export function mergeEnabledPlugins(existingJson: string | undefined, ids: string[]): string {
	let current: string[] = [];
	if (existingJson) {
		try {
			const parsed = JSON.parse(existingJson);
			if (Array.isArray(parsed)) current = parsed.filter((x): x is string => typeof x === "string");
		} catch {
			current = [];
		}
	}
	for (const id of ids) if (!current.includes(id)) current.push(id);
	return `${JSON.stringify(current, null, 2)}\n`;
}
