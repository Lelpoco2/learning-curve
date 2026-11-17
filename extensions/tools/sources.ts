/** source_lookup: fact checking against the learner's textbooks and official/reference sources. */

import { join } from "node:path";
import { Type } from "../lib/schema.ts";
import { runProcess } from "../lib/exec.ts";
import { StringEnum } from "../lib/schema.ts";
import { type Chunk, loadLocalChunks, localCitation, searchChunks } from "../lib/sources/local.ts";
import { relevantExcerpt } from "../lib/sources/text.ts";
import { type LookupResult, type WebSourceId, webLookup } from "../lib/sources/web.ts";
import { today } from "../lib/types.ts";
import { notesRoot } from "../lib/workspace.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { requireWorkspace, textResult } from "../runtime.ts";

const SOURCES = ["auto", "local", "wikipedia", "eom", "nlab", "dlmf", "codata", "oeis", "arxiv", "crossref", "url"] as const;

const Params = Type.Object({
	query: Type.String({ description: "Key terms of the claim to verify (e.g. 'mean value theorem hypotheses', 'speed of light', 'gamma reflection formula')" }),
	source: Type.Optional(
		StringEnum(SOURCES, {
			description:
				"auto = learner's textbooks + Wikipedia. local = textbooks/course notes in the vault Sources folder. wikipedia, eom (Encyclopedia of Mathematics), nlab (advanced math), dlmf (NIST special functions/identities), codata (NIST physical constants), oeis (integer sequences), arxiv (papers), crossref (bibliographic metadata/DOIs), url (any page: set page to the URL).",
		}),
	),
	page: Type.Optional(Type.String({ description: "Open directly: page title (wikipedia/eom/nlab), DLMF section ('5.5'), OEIS id ('A000045'), arXiv id, local file name, or URL (source url)" })),
	lang: Type.Optional(Type.String({ description: "Wikipedia language code (default en; e.g. it). English pages are usually more complete." })),
	maxChars: Type.Optional(Type.Integer({ minimum: 500, maximum: 12000, description: "Excerpt budget (default 4000)" })),
});

interface Details {
	sources: string[];
	citations: string[];
	errors: string[];
}

function formatWeb(r: LookupResult, query: string, maxChars: number): { text: string; citation?: string } {
	const out = [`## ${r.source}${r.doc ? ` — "${r.doc.title}"` : ""}`];
	if (!r.doc && r.hits.length === 0) return { text: `${out[0]}\nNo results.` };
	if (r.doc) out.push(`URL: ${r.doc.url}`, `Cite as: ${r.doc.citation}`);
	const others = r.hits.filter((h) => h.title !== r.doc?.title).slice(0, 4);
	if (others.length) out.push(`Other matches: ${others.map((h) => `${h.title} <${h.url}>`).join("; ")}`);
	if (r.doc) out.push("Excerpt:", relevantExcerpt(r.doc.text, query, maxChars) || "(empty page)");
	return { text: out.join("\n"), citation: r.doc?.citation };
}

function formatLocal(hits: (Chunk & { score: number })[], query: string, maxChars: number): string {
	const per = Math.max(400, Math.floor(maxChars / Math.max(1, hits.length)));
	return [
		"## Your sources (vault Sources folder) — highest priority",
		...hits.map((h, i) => `${i + 1}. ${localCitation(h)}\n${relevantExcerpt(h.text, query, per)}`),
	].join("\n\n");
}

export const sourceTools = [
	defineTool({
		name: "source_lookup",
		label: "Source lookup",
		description:
			"Fact-check against sources: the learner's own textbooks and course notes (vault Sources folder, PDFs included), Wikipedia, Encyclopedia of Mathematics, nLab, NIST DLMF, NIST CODATA constants, OEIS, arXiv and Crossref. Returns relevant excerpts (LaTeX kept), URLs and ready-made citations. Results are cached.",
		parameters: Params,
		async execute(p, env) {
			const ws = requireWorkspace();
			const vault = notesRoot(ws);
			const source = p.source ?? "auto";
			const maxChars = p.maxChars ?? 4000;
			const cacheDir = join(ws.dataDir, "cache", "sources");
			const date = today();
			const parts: string[] = [];
			const details: Details = { sources: [], citations: [], errors: [] };
			const progress = (msg: string) => env.progress?.(msg);

			if (source === "auto" || source === "local") {
				const sourcesDir = join(vault, ws.config.sourcesFolder ?? "Sources");
				const { chunks, warnings } = await loadLocalChunks({ vault, sourcesDir, cacheDir, python: ws.config.python?.python, exec: runProcess, onProgress: progress, signal: env.signal });
				const pool = p.page && source === "local" ? chunks.filter((c) => c.file.toLowerCase().includes(p.page!.toLowerCase())) : chunks;
				const hits = searchChunks(pool, p.query, 4);
				if (hits.length) {
					parts.push(formatLocal(hits, p.query, Math.floor(maxChars * (source === "auto" ? 0.6 : 1))));
					details.sources.push("local");
					details.citations.push(...hits.map(localCitation));
				} else if (source === "local") {
					parts.push(chunks.length ? "## Your sources\nNothing relevant found in your sources." : `## Your sources\nNo documents yet: put textbooks/course notes (PDF, Markdown) in the vault folder "${ws.config.sourcesFolder ?? "Sources"}".`);
				}
				details.errors.push(...warnings);
			}

			const web: WebSourceId[] = source === "auto" ? ["wikipedia"] : source === "local" ? [] : [source];
			for (const id of web) {
				try {
					const r = await webLookup(id, p.query, p.page, { cacheDir, today: date, signal: env.signal, lang: p.lang });
					const f = formatWeb(r, p.query, source === "auto" && parts.length ? Math.floor(maxChars * 0.4) : maxChars);
					parts.push(f.text);
					details.sources.push(r.source);
					if (f.citation) details.citations.push(f.citation);
				} catch (error) {
					const msg = `${id}: ${error instanceof Error ? error.message : String(error)}`;
					details.errors.push(msg);
					parts.push(`## ${id}\nLookup failed: ${msg}. Try another source.`);
				}
			}

			if (details.errors.length) parts.push(`Notes: ${details.errors.join(" | ")}`);
			parts.push(
				"Reminder: a claim counts as verified only if an excerpt above states it (same hypotheses, same convention). Cite it in the note; otherwise mark it unverified.",
			);
			return textResult(parts.join("\n\n"), details);
		},
	}),
];
