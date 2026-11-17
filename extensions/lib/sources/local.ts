/**
 * Local sources: the learner's textbooks and course notes (PDF, Markdown, text) in the vault's
 * Sources folder. PDFs are converted once with pypdf (page by page) and cached.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { Exec } from "../python.ts";
import { scorePassage, queryTerms } from "./text.ts";

export interface Chunk {
	/** Vault-relative path of the file (forward slashes). */
	file: string;
	/** 1-based PDF page, when known. */
	page?: number;
	/** Section heading (Markdown). */
	heading?: string;
	text: string;
}

export interface LocalHit extends Chunk {
	score: number;
}

const EXTENSIONS = new Set([".pdf", ".md", ".txt", ".tex"]);
const PDF_SCRIPT = [
	"import sys, json",
	"from pypdf import PdfReader",
	"r = PdfReader(sys.argv[1])",
	"pages = []",
	"for p in r.pages:",
	"    try:",
	"        pages.append(p.extract_text() or '')",
	"    except Exception:",
	"        pages.append('')",
	"title = None",
	"try:",
	"    title = r.metadata.title if r.metadata else None",
	"except Exception:",
	"    pass",
	"json.dump({'pages': pages, 'title': title}, open(sys.argv[2], 'w', encoding='utf-8'))",
].join("\n");

export function listSourceFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	const walk = (d: string) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			if (e.name.startsWith(".")) continue;
			const p = join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (EXTENSIONS.has(extname(e.name).toLowerCase()) && e.name.toLowerCase() !== "readme.md") out.push(p);
		}
	};
	walk(dir);
	return out.sort();
}

/** Split Markdown/text into sections by headings, then into ~1500-char chunks. */
export function chunkText(file: string, text: string, max = 1500): Chunk[] {
	const chunks: Chunk[] = [];
	let heading: string | undefined;
	let buf = "";
	const flush = () => {
		const t = buf.trim();
		if (t) chunks.push({ file, heading, text: t });
		buf = "";
	};
	for (const line of text.split(/\r?\n/)) {
		const h = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\\(?:sub)*section\*?\{(.*)\}/);
		if (h) {
			flush();
			heading = h[1].trim();
			continue;
		}
		if (buf.length + line.length > max) flush();
		buf += `${line}\n`;
	}
	flush();
	return chunks;
}

export function chunkPdfPages(file: string, pages: string[]): Chunk[] {
	return pages.map((text, i) => ({ file, page: i + 1, text: text.replace(/[ \t]+/g, " ").trim() })).filter((c) => c.text.length > 0);
}

export function searchChunks(chunks: Chunk[], query: string, limit = 5): LocalHit[] {
	const terms = queryTerms(query);
	if (terms.length === 0) return [];
	return chunks
		.map((c) => ({ ...c, score: scorePassage(`${c.heading ?? ""} ${c.text}`, terms) }))
		.filter((c) => c.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

/** Obsidian link to the exact place in the source (PDF pages open at that page). */
export function localCitation(hit: Chunk): string {
	const name = basename(hit.file).replace(/\.(md|txt|tex|pdf)$/i, "");
	const target = hit.file.replace(/\.md$/i, "");
	if (hit.page) return `[[${hit.file}#page=${hit.page}|${name}, p. ${hit.page}]]`;
	if (hit.heading) return `[[${target}#${hit.heading.replace(/[#|^[\]]/g, " ").trim()}|${name} — ${hit.heading}]]`;
	return `[[${target}|${name}]]`;
}

export interface LocalIndexOptions {
	vault: string;
	sourcesDir: string;
	cacheDir: string;
	python?: string;
	exec: Exec;
	onProgress?: (msg: string) => void;
	signal?: AbortSignal;
}

async function ensurePypdf(opts: LocalIndexOptions): Promise<boolean> {
	if (!opts.python) return false;
	const probe = await opts.exec(opts.python, ["-c", "import pypdf"], { timeout: 60_000 });
	if (probe.code === 0) return true;
	opts.onProgress?.("Installing pypdf (PDF text extraction) in the workspace Python…");
	const uv = await opts.exec("uv", ["pip", "install", "--python", opts.python, "pypdf"], { timeout: 600_000, signal: opts.signal });
	if (uv.code !== 0) await opts.exec(opts.python, ["-m", "pip", "install", "pypdf"], { timeout: 600_000, signal: opts.signal });
	return (await opts.exec(opts.python, ["-c", "import pypdf"], { timeout: 60_000 })).code === 0;
}

/** Load every source file as chunks; PDFs are extracted once and cached by path, size and mtime. */
export async function loadLocalChunks(opts: LocalIndexOptions): Promise<{ chunks: Chunk[]; warnings: string[] }> {
	const files = listSourceFiles(opts.sourcesDir);
	const chunks: Chunk[] = [];
	const warnings: string[] = [];
	const cache = join(opts.cacheDir, "local");
	let pypdf: boolean | undefined;
	for (const abs of files) {
		const rel = relative(opts.vault, abs).replace(/\\/g, "/");
		const ext = extname(abs).toLowerCase();
		if (ext !== ".pdf") {
			chunks.push(...chunkText(rel, readFileSync(abs, "utf8")));
			continue;
		}
		const st = statSync(abs);
		const key = createHash("sha1").update(`${abs}|${st.size}|${st.mtimeMs}`).digest("hex");
		const cached = join(cache, `${key}.json`);
		if (!existsSync(cached)) {
			pypdf ??= await ensurePypdf(opts);
			if (!pypdf) {
				warnings.push(`${rel}: PDF skipped (needs the workspace Python with pypdf; run /learn-setup).`);
				continue;
			}
			mkdirSync(cache, { recursive: true });
			opts.onProgress?.(`Reading ${basename(abs)} (first time only)…`);
			const script = join(cache, "extract_pdf.py");
			writeFileSync(script, PDF_SCRIPT, "utf8");
			const r = await opts.exec(opts.python!, ["-X", "utf8", script, abs, cached], { timeout: 900_000, signal: opts.signal });
			if (r.code !== 0 || !existsSync(cached)) {
				warnings.push(`${rel}: could not extract text (${r.stderr.trim().split(/\r?\n/).pop() ?? "error"}).`);
				continue;
			}
		}
		const data = JSON.parse(readFileSync(cached, "utf8")) as { pages: string[] };
		const pdfChunks = chunkPdfPages(rel, data.pages);
		if (pdfChunks.length === 0) warnings.push(`${rel}: no text layer (scanned PDF?). OCR it first to make it searchable.`);
		chunks.push(...pdfChunks);
	}
	return { chunks, warnings };
}
