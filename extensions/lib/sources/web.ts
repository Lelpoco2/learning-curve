/**
 * Online reference sources for fact checking. Every adapter returns plain text with LaTeX kept
 * ($…$), a canonical URL and a ready-made citation. Responses are cached in the workspace.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeEntities, htmlToText, nlabSourceToText, normalize, queryTerms, scorePassage, stripTags, textareaContent, wikitextToText } from "./text.ts";

export type WebSourceId = "wikipedia" | "eom" | "nlab" | "dlmf" | "codata" | "oeis" | "arxiv" | "crossref" | "url";

export interface Hit {
	title: string;
	url: string;
	snippet?: string;
}

export interface Doc {
	title: string;
	url: string;
	text: string;
	citation: string;
}

export interface LookupResult {
	source: string;
	hits: Hit[];
	doc?: Doc;
}

export interface LookupContext {
	cacheDir: string;
	today: string;
	signal?: AbortSignal;
	lang?: string;
}

const UA = "learning-curve/0.4 (pi tutor; educational fact checking)";
const DAY = 24 * 60 * 60 * 1000;

async function getText(url: string, ctx: LookupContext, ttlDays = 14): Promise<string> {
	const dir = join(ctx.cacheDir, "web");
	const file = join(dir, `${createHash("sha1").update(url).digest("hex")}.txt`);
	if (existsSync(file) && Date.now() - statSync(file).mtimeMs < ttlDays * DAY) return readFileSync(file, "utf8");
	const signal = ctx.signal ? AbortSignal.any([ctx.signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000);
	const host = new URL(url).hostname;
	const get = async () => {
		try {
			return await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal });
		} catch (error) {
			if (ctx.signal?.aborted) throw error;
			const name = (error as { name?: string }).name;
			throw new Error(name === "TimeoutError" || name === "AbortError" ? `${host} did not answer within 25 s` : `${host} unreachable (offline?)`);
		}
	};
	let res = await get();
	let body = await res.text();
	if (res.status === 429 || body.startsWith("Rate exceeded")) {
		await new Promise((r) => setTimeout(r, 3500));
		res = await get();
		body = await res.text();
	}
	if (!res.ok || body.startsWith("Rate exceeded")) throw new Error(`${new URL(url).hostname} answered ${res.status}${body.startsWith("Rate exceeded") ? " (rate limited, retry in a few seconds)" : ""}`);
	if (/<title>Just a moment\.\.\.<\/title>/i.test(body)) throw new Error(`${new URL(url).hostname} blocks automated access`);
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, body, "utf8");
	return body;
}

async function getJson<T>(url: string, ctx: LookupContext, ttlDays = 14): Promise<T> {
	const text = await getText(url, ctx, ttlDays);
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(`${new URL(url).hostname} returned an unexpected response`);
	}
}

function cite(title: string, site: string, url: string, today: string): string {
	return `"${title}", ${site}, ${url} (accessed ${today})`;
}

/**
 * Search engines rank by text relevance; when the query names a page ("mean value theorem
 * hypotheses"), the page whose title appears in the query is the one to read.
 */
export function rankByTitleInQuery<T extends { title: string }>(hits: T[], query: string): T[] {
	const q = ` ${normalize(query).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
	const inQuery = (t: string) => q.includes(` ${normalize(t).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `);
	return hits
		.map((h, i) => ({ h, i, s: inQuery(h.title) ? h.title.length : 0 }))
		.sort((a, b) => b.s - a.s || a.i - b.i)
		.map((x) => x.h);
}

// ---------------------------------------------------------------- MediaWiki (Wikipedia, EoM)

interface WikiSite {
	name: string;
	api: string;
	page: (title: string) => string;
}

function wikiSite(id: "wikipedia" | "eom", lang = "en"): WikiSite {
	if (id === "eom") {
		return { name: "Encyclopedia of Mathematics (EMS)", api: "https://encyclopediaofmath.org/api.php", page: (t) => `https://encyclopediaofmath.org/wiki/${encodeURI(t.replace(/ /g, "_"))}` };
	}
	const l = /^[a-z-]{2,12}$/.test(lang) ? lang : "en";
	return { name: `Wikipedia (${l})`, api: `https://${l}.wikipedia.org/w/api.php`, page: (t) => `https://${l}.wikipedia.org/wiki/${encodeURI(t.replace(/ /g, "_"))}` };
}

/** Contiguous word sequences of the query (2+ words), longest first: candidate page titles. */
export function titleCandidates(query: string, max = 40): string[] {
	const words = query.replace(/[?!.,;:()"]+/g, " ").split(/\s+/).filter(Boolean);
	const out: string[] = [];
	for (let len = Math.min(words.length, 6); len >= 1; len--) {
		for (let i = 0; i + len <= words.length; i++) {
			const phrase = words.slice(i, i + len).join(" ");
			if (len === 1 && phrase.length < 5) continue;
			out.push(phrase);
		}
	}
	return [...new Set(out)].slice(0, max);
}

/** The longest phrase of the query that is an existing page title (redirects followed), if any. */
async function titleInQuery(site: WikiSite, query: string, ctx: LookupContext): Promise<string | undefined> {
	const candidates = titleCandidates(query);
	if (candidates.length === 0) return undefined;
	const data = await getJson<{
		query?: { pages?: Record<string, { title: string; missing?: string }>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] };
	}>(`${site.api}?action=query&titles=${encodeURIComponent(candidates.join("|"))}&redirects=1&format=json`, ctx).catch(() => undefined);
	const q = data?.query;
	if (!q?.pages) return undefined;
	const existing = new Set(Object.values(q.pages).filter((p) => p.missing === undefined).map((p) => p.title));
	const resolve = (t: string) => {
		let x = q.normalized?.find((n) => n.from === t)?.to ?? t;
		x = q.redirects?.find((r) => r.from === x)?.to ?? x;
		return x;
	};
	for (const c of candidates) {
		const t = resolve(c);
		if (existing.has(t)) return t;
	}
	return undefined;
}

async function mediawiki(id: "wikipedia" | "eom", query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	const site = wikiSite(id, ctx.lang);
	let hits: Hit[] = [];
	let title = page;
	if (!title) {
		const named = await titleInQuery(site, query, ctx);
		const data = await getJson<{ query?: { search?: { title: string; snippet: string }[] } }>(
			`${site.api}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`,
			ctx,
		);
		hits = rankByTitleInQuery(
			(data.query?.search ?? []).map((h) => ({ title: h.title, url: site.page(h.title), snippet: stripTags(h.snippet) })),
			query,
		);
		if (named && !hits.some((h) => h.title === named)) hits.unshift({ title: named, url: site.page(named) });
		title = named ?? hits[0]?.title;
	}
	if (!title) return { source: site.name, hits };
	const parsed = await getJson<{ parse?: { title: string; wikitext: string }; error?: { info: string } }>(
		`${site.api}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&redirects=1&formatversion=2`,
		ctx,
		30,
	);
	if (!parsed.parse) throw new Error(parsed.error?.info ?? `page "${title}" not found`);
	const url = site.page(parsed.parse.title);
	return {
		source: site.name,
		hits,
		doc: { title: parsed.parse.title, url, text: wikitextToText(parsed.parse.wikitext), citation: cite(parsed.parse.title, site.name, url, ctx.today) },
	};
}

// ---------------------------------------------------------------- nLab

function nlabTitle(path: string): string {
	return decodeURIComponent(path.replace(/\+/g, " "));
}

async function nlab(query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	const open = async (title: string): Promise<Doc | undefined> => {
		const slug = encodeURIComponent(title).replace(/%20/g, "+");
		const html = await getText(`https://ncatlab.org/nlab/source/${slug}`, ctx, 30).catch(() => undefined);
		const src = html ? textareaContent(html) : undefined;
		if (!src?.trim()) return undefined;
		const url = `https://ncatlab.org/nlab/show/${slug}`;
		return { title, url, text: nlabSourceToText(src), citation: cite(title, "nLab", url, ctx.today) };
	};
	if (page) {
		const doc = await open(page);
		if (!doc) throw new Error(`nLab page "${page}" not found`);
		return { source: "nLab", hits: [], doc };
	}
	const html = await getText(`https://ncatlab.org/nlab/search?query=${encodeURIComponent(query)}`, ctx);
	const titles = [...new Set([...html.matchAll(/href="\/nlab\/show\/([^"#?]+)"/g)].map((m) => nlabTitle(m[1])))].filter((t) => t !== "HomePage");
	const q = normalize(query.trim());
	const terms = queryTerms(query);
	titles.sort((a, b) => Number(normalize(b) === q) - Number(normalize(a) === q) || scorePassage(b, terms) - scorePassage(a, terms) || a.length - b.length);
	const hits = titles.slice(0, 5).map((t) => ({ title: t, url: `https://ncatlab.org/nlab/show/${encodeURIComponent(t).replace(/%20/g, "+")}` }));
	const doc = (await open(query.trim())) ?? (hits[0] ? await open(hits[0].title) : undefined);
	return { source: "nLab", hits, doc };
}

// ---------------------------------------------------------------- DLMF

/**
 * DLMF page → text where every equation sits on one line with its number
 * ("Equation 5.5.3: $…$"), and each (sub)section — heading, keywords, text, equations — forms a
 * single passage, so a search for "reflection formula" returns the formulas of that subsection.
 */
export function dlmfToText(html: string, sectionId: string): string {
	let s = html;
	s = s.replace(/<table id="(E\d+)" class="ltx_equation[^"]*"[\s\S]*?<\/table>([\s\S]*?)(?=<table id="E\d+"|<div class="ltx_para|<section|$)/g, (_m, id: string, after: string) => {
		const table = _m.slice(0, _m.length - after.length);
		// The annotation box (symbols, keywords, permalink) may sit inside the equation table.
		const formulaPart = table.replace(/<div class="ltx_infocontent">[\s\S]*?<\/dl>\s*<\/div>/g, "");
		const tex = [...formulaPart.matchAll(/<math\b[^>]*\balttext="([^"]*)"/g)].map((m) =>
			decodeEntities(m[1])
				.replace(/(?<!\\)%\s*/g, "")
				.trim(),
		);
		const kw = _m.match(/<dt>Keywords:<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)?.[1];
		const keywords = kw ? stripTags(kw) : "";
		const num = `${sectionId}.${id.slice(1)}`;
		return `\n<p>Equation ${num}: $${tex.join(" ")}$${keywords ? ` — keywords: ${keywords}` : ""}</p>\n`;
	});
	s = s.replace(/<div class="ltx_infocontent">([\s\S]*?)<\/dl>\s*<\/div>/g, (_m, inner: string) => {
		const kw = inner.match(/<dt>Keywords:<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)?.[1];
		return kw ? `<p>Keywords: ${stripTags(kw)}</p>` : " ";
	});
	s = s.replace(/<span class="ltx_font_bold">ⓘ<\/span>/g, " ");
	// One passage per section: keep line breaks, drop blank lines inside a section.
	return htmlToText(s)
		.split(/\n(?=## )/)
		.map((section) => section.replace(/\n\s*\n/g, "\n"))
		.join("\n\n");
}


async function dlmf(query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	let hits: Hit[] = [];
	let id = page?.replace(/^https?:\/\/dlmf\.nist\.gov\//, "").replace(/^§/, "");
	if (!id) {
		const html = await getText(`https://dlmf.nist.gov/search/search?q=${encodeURIComponent(query)}`, ctx);
		hits = [...html.matchAll(/<h5 class="ltx_hittag">\s*\d+:\s*<a href="\.\.\/([^"#]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
			title: `§${stripTags(m[2])}`,
			url: `https://dlmf.nist.gov/${m[1]}`,
		}));
		id = hits[0]?.url.replace("https://dlmf.nist.gov/", "");
	}
	if (!id) return { source: "NIST DLMF", hits };
	const url = `https://dlmf.nist.gov/${id}`;
	const html = await getText(url, ctx, 60);
	const title = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? `DLMF ${id}`).replace(/^DLMF:\s*/, "");
	// Page content starts at the first heading (skips the site menu) and ends before the footer.
	const start = html.search(/<h1\b/i);
	const end = html.search(/<footer\b|<div class="ltx_page_footer"/i);
	const body = html.slice(start > 0 ? start : 0, end > start ? end : undefined);
	return {
		source: "NIST DLMF",
		hits,
		doc: { title, url, text: dlmfToText(body, id.split("#")[0]), citation: `NIST Digital Library of Mathematical Functions, ${title}, ${url} (accessed ${ctx.today})` },
	};
}

// ---------------------------------------------------------------- CODATA

export interface Constant {
	name: string;
	value: string;
	uncertainty: string;
	unit: string;
}

/** Parse NIST's allascii.txt table (fixed-width columns). */
export function parseCodata(table: string): { year?: string; constants: Constant[] } {
	const year = table.match(/(\d{4}) CODATA adjustment/)?.[1];
	const lines = table.split(/\r?\n/);
	const start = lines.findIndex((l) => /^-{20,}/.test(l));
	const constants: Constant[] = [];
	for (const line of lines.slice(start + 1)) {
		if (!line.trim()) continue;
		const name = line.slice(0, 60).trim();
		const value = line.slice(60, 85).trim();
		const uncertainty = line.slice(85, 110).trim();
		const unit = line.slice(110).trim();
		if (name && value) constants.push({ name, value, uncertainty, unit });
	}
	return { year, constants };
}

export function searchConstants(constants: Constant[], query: string, limit = 8): Constant[] {
	const terms = queryTerms(query);
	const q = normalize(query.trim());
	const scored = constants
		.map((c) => ({ c, s: (normalize(c.name) === q ? 100 : 0) + scorePassage(c.name, terms) - c.name.length / 100 }))
		.filter((x) => x.s > 0)
		.sort((a, b) => b.s - a.s);
	// Keep only strong matches (e.g. "Newtonian constant of gravitation" should not list every "constant").
	const best = scored[0]?.s ?? 0;
	return scored
		.filter((x) => x.s >= best * 0.6)
		.slice(0, limit)
		.map((x) => x.c);
}

async function codata(query: string, ctx: LookupContext): Promise<LookupResult> {
	const table = await getText("https://physics.nist.gov/cuu/Constants/Table/allascii.txt", ctx, 90);
	const { year, constants } = parseCodata(table);
	const found = searchConstants(constants, query);
	const url = "https://physics.nist.gov/cuu/Constants/";
	const text = found.length
		? found.map((c) => `${c.name} = ${c.value.replace(/ (?=\d)/g, "")}${c.uncertainty === "(exact)" ? " (exact)" : ` ± ${c.uncertainty.replace(/ (?=\d)/g, "")}`} ${c.unit}`.trim()).join("\n")
		: "No constant matches the query.";
	return {
		source: `NIST CODATA ${year ?? ""}`.trim(),
		hits: found.map((c) => ({ title: c.name, url })),
		doc: { title: `CODATA ${year ?? ""} recommended values`, url, text, citation: `CODATA ${year ?? ""} recommended values of the fundamental physical constants, NIST, ${url} (accessed ${ctx.today})` },
	};
}

// ---------------------------------------------------------------- OEIS

interface OeisEntry {
	number: number;
	name: string;
	data: string;
	formula?: string[];
	comment?: string[];
}

export function oeisId(n: number): string {
	return `A${String(n).padStart(6, "0")}`;
}

async function oeis(query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	const q = page ? `id:${page.trim().toUpperCase()}` : query;
	const data = await getJson<OeisEntry[] | { results?: OeisEntry[] | null } | null>(`https://oeis.org/search?q=${encodeURIComponent(q)}&fmt=json`, ctx);
	const entries = (Array.isArray(data) ? data : (data?.results ?? [])) ?? [];
	const hits = entries.slice(0, 5).map((e) => ({ title: `${oeisId(e.number)} ${e.name}`, url: `https://oeis.org/${oeisId(e.number)}` }));
	const e = entries[0];
	if (!e) return { source: "OEIS", hits };
	const id = oeisId(e.number);
	const text = [
		`${id}: ${e.name}`,
		`Data: ${e.data.split(",").slice(0, 30).join(", ")}`,
		...(e.formula?.length ? ["Formulas:", ...e.formula.slice(0, 6)] : []),
		...(e.comment?.length ? ["Comments:", ...e.comment.slice(0, 4)] : []),
	].join("\n");
	const url = `https://oeis.org/${id}`;
	return { source: "OEIS", hits, doc: { title: `${id} ${e.name}`, url, text, citation: `OEIS Foundation Inc., The On-Line Encyclopedia of Integer Sequences, ${url} (accessed ${ctx.today})` } };
}

// ---------------------------------------------------------------- arXiv

export interface ArxivEntry {
	id: string;
	title: string;
	summary: string;
	authors: string[];
	published: string;
}

export function parseArxiv(atom: string): ArxivEntry[] {
	return [...atom.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
		const get = (tag: string) => stripTags(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
		return {
			id: get("id").replace(/^https?:\/\/arxiv\.org\/abs\//, ""),
			title: get("title"),
			summary: get("summary"),
			authors: [...m[1].matchAll(/<name>([\s\S]*?)<\/name>/g)].map((a) => stripTags(a[1])),
			published: get("published").slice(0, 4),
		};
	});
}

async function arxiv(query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	const url = page
		? `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(page.replace(/^arxiv:/i, ""))}`
		: `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=5`;
	const entries = parseArxiv(await getText(url, ctx));
	const hits = entries.map((e) => ({ title: `${e.title} (${e.authors.slice(0, 3).join(", ")}${e.authors.length > 3 ? " et al." : ""}, ${e.published})`, url: `https://arxiv.org/abs/${e.id}` }));
	const e = entries[0];
	if (!e) return { source: "arXiv", hits };
	const abs = `https://arxiv.org/abs/${e.id}`;
	return {
		source: "arXiv",
		hits,
		doc: { title: e.title, url: abs, text: `Abstract: ${e.summary}`, citation: `${e.authors.join(", ")}, "${e.title}", arXiv:${e.id} (${e.published}), ${abs}` },
	};
}

// ---------------------------------------------------------------- Crossref

interface CrossrefItem {
	DOI: string;
	title?: string[];
	author?: { given?: string; family?: string; name?: string }[];
	issued?: { "date-parts"?: number[][] };
	"container-title"?: string[];
}

export function formatCrossref(i: CrossrefItem): string {
	const authors = (i.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean);
	const year = i.issued?.["date-parts"]?.[0]?.[0];
	const who = authors.length ? `${authors.slice(0, 3).join(", ")}${authors.length > 3 ? " et al." : ""}` : "Unknown author";
	return `${who}${year ? ` (${year})` : ""}. ${i.title?.[0] ?? "Untitled"}.${i["container-title"]?.[0] ? ` ${i["container-title"][0]}.` : ""} https://doi.org/${i.DOI}`;
}

async function crossref(query: string, ctx: LookupContext): Promise<LookupResult> {
	const data = await getJson<{ message?: { items?: CrossrefItem[] } }>(
		`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=6&select=DOI,title,author,issued,container-title`,
		ctx,
	);
	const items = data.message?.items ?? [];
	const refs = items.map(formatCrossref);
	return {
		source: "Crossref",
		hits: items.map((i, k) => ({ title: refs[k], url: `https://doi.org/${i.DOI}` })),
		doc: items.length ? { title: "Crossref bibliographic search", url: "https://search.crossref.org", text: refs.join("\n"), citation: refs[0] } : undefined,
	};
}

// ---------------------------------------------------------------- Any URL

async function anyUrl(page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	if (!page || !/^https?:\/\//i.test(page)) throw new Error("source url needs `page` set to an http(s) URL");
	const body = await getText(page, ctx);
	const title = stripTags(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? page);
	const host = new URL(page).hostname;
	const text = /^\s*[[{]/.test(body) ? body.slice(0, 20000) : htmlToText(body);
	return { source: host, hits: [], doc: { title, url: page, text, citation: cite(title, host, page, ctx.today) } };
}

export async function webLookup(source: WebSourceId, query: string, page: string | undefined, ctx: LookupContext): Promise<LookupResult> {
	switch (source) {
		case "wikipedia":
		case "eom":
			return mediawiki(source, query, page, ctx);
		case "nlab":
			return nlab(query, page, ctx);
		case "dlmf":
			return dlmf(query, page, ctx);
		case "codata":
			return codata(query, ctx);
		case "oeis":
			return oeis(query, page, ctx);
		case "arxiv":
			return arxiv(query, page, ctx);
		case "crossref":
			return crossref(query, ctx);
		case "url":
			return anyUrl(page, ctx);
	}
}
