/** Text helpers for source lookups: HTML/wikitext to text with LaTeX kept, excerpt selection. Pure. */

const NAMED: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
	times: "×",
	minus: "−",
	sect: "§",
	diams: "♦",
	middot: "·",
	deg: "°",
	plusmn: "±",
};

export function decodeEntities(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
		.replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m);
}

function tidy(s: string): string {
	return s
		.replace(/[ \t\f\v\u00a0]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** HTML → readable text. MathML/images with LaTeX alttext become `$…$`; scripts, styles and navigation are dropped. */
export function htmlToText(html: string): string {
	let s = html;
	s = s.replace(/<(script|style|noscript|head|nav|footer|svg)\b[\s\S]*?<\/\1>/gi, " ");
	s = s.replace(/<!--[\s\S]*?-->/g, " ");
	s = s.replace(/<math\b[^>]*\balttext="([^"]*)"[\s\S]*?<\/math>/gi, (_m, tex: string) => ` $${decodeEntities(tex).trim()}$ `);
	s = s.replace(/<img\b[^>]*\balt="([^"]+)"[^>]*>/gi, (_m, alt: string) => ` ${decodeEntities(alt)} `);
	s = s.replace(/<br\s*\/?>/gi, "\n");
	s = s.replace(/<li\b[^>]*>/gi, "\n- ");
	s = s.replace(/<\/(p|div|h[1-6]|tr|section|table|dd|dt|blockquote|ul|ol)>/gi, "\n");
	s = s.replace(/<(h[1-6])\b[^>]*>/gi, "\n## ");
	s = s.replace(/<[^>]+>/g, " ");
	return tidy(decodeEntities(s)).replace(/^## *\n+/gm, "## ");
}

/** Text inside the first <textarea> (nLab page sources). */
export function textareaContent(html: string): string | undefined {
	const m = html.match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i);
	return m ? decodeEntities(m[1]) : undefined;
}

/** MediaWiki wikitext → readable text with `<math>` kept as `$…$` / `$$…$$`. */
export function wikitextToText(w: string): string {
	let s = w;
	s = s.replace(/<!--[\s\S]*?-->/g, "");
	s = s.replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
	s = s.replace(/<math\b[^>]*display\s*=\s*"?block"?[^>]*>([\s\S]*?)<\/math>/gi, (_m, t: string) => `\n$$${t.trim()}$$\n`);
	s = s.replace(/<math\b[^>]*>([\s\S]*?)<\/math>/gi, (_m, t: string) => `$${t.trim()}$`);
	// Inline math templates keep their content; other templates are removed (innermost first).
	for (let i = 0; i < 20; i++) {
		const before = s;
		s = s.replace(/\{\{\s*(?:tmath)\s*\|([^{}]*)\}\}/gi, (_m, t: string) => `$${t.trim()}$`);
		s = s.replace(/\{\{\s*(?:math|mvar|var|nowrap|bigmath)\s*\|(?:\s*\d+\s*=)?([^{}]*)\}\}/gi, "$1");
		s = s.replace(/\{\{[^{}]*\}\}/g, "");
		if (s === before) break;
	}
	for (let i = 0; i < 10; i++) {
		const before = s;
		s = s.replace(/\{\|[^{}]*?\|\}/g, ""); // tables
		if (s === before) break;
	}
	for (let i = 0; i < 10; i++) {
		const before = s;
		s = s.replace(/\[\[([^[\]|]*)\|([^[\]]*)\]\]/g, "$2").replace(/\[\[([^[\]]*)\]\]/g, "$1");
		if (s === before) break;
	}
	s = s.replace(/^(?:File|Image|Category|Datei|File):.*$/gim, "");
	s = s.replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
	s = s.replace(/'''?/g, "");
	s = s.replace(/^(=+)\s*(.*?)\s*\1\s*$/gm, (_m, eq: string, t: string) => `\n${"#".repeat(Math.min(6, eq.length))} ${t}`);
	s = s.replace(/<\/?[a-z][^>]*>/gi, "");
	return tidy(decodeEntities(s));
}

/** nLab source (Markdown + itex) → readable text. */
export function nlabSourceToText(src: string): string {
	// The "Context" sidebar (rightHandSide block) precedes the first real section.
	let body = src;
	if (/rightHandSide/.test(body)) {
		const first = body.search(/^#{1,2}\s+(?!Context)[^#\n]+$/m);
		if (first > 0) body = body.slice(first);
	}
	return tidy(
		body
			.replace(/^\+--.*$/gm, "")
			.replace(/^=--.*$/gm, "")
			.replace(/^\{:.*\}\s*$/gm, "")
			.replace(/\[\[!include[^\]]*\]\]/g, "")
			.replace(/\[\[!redirects[^\]]*\]\]/g, "")
			.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
			.replace(/\[\[([^\]]*)\]\]/g, "$1")
			.replace(/^\* table of contents$/gm, ""),
	);
}

const STOPWORDS = new Set(
	"the a an of and or to in on for with by is are be as at from that this which what when where how why it its into than then there their about between also not if all any can does do di del della dei degli delle il lo la gli le un uno una e ed o che per con su da in nel nella sono come quando perche cosa".split(
		" ",
	),
);

export function normalize(s: string): string {
	return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function queryTerms(query: string): string[] {
	const terms = normalize(query)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
	return [...new Set(terms)];
}

/** Score a passage: number of distinct query terms present, weighted by occurrences. */
export function scorePassage(passage: string, terms: string[]): number {
	const n = normalize(passage);
	let score = 0;
	for (const t of terms) {
		const count = n.split(t).length - 1;
		if (count > 0) score += 10 + Math.min(count, 5);
	}
	return score;
}

function splitPassages(text: string, max = 1200): string[] {
	const out: string[] = [];
	for (const para of text.split(/\n\s*\n/)) {
		const p = para.trim();
		if (!p) continue;
		if (p.length <= max) {
			out.push(p);
			continue;
		}
		let buf = "";
		for (const sentence of p.split(/(?<=[.!?])\s+|\n/)) {
			if (buf.length + sentence.length > max && buf) {
				out.push(buf.trim());
				buf = "";
			}
			buf += `${sentence} `;
		}
		if (buf.trim()) out.push(buf.trim());
	}
	return out;
}

/**
 * Pick the passages most relevant to the query (kept in document order), always including the
 * opening passage (usually the definition), within `maxChars`.
 */
export function relevantExcerpt(text: string, query: string, maxChars = 4000): string {
	const passages = splitPassages(text);
	if (passages.length === 0) return "";
	const terms = queryTerms(query);
	const scored = passages.map((p, i) => ({ p, i, s: scorePassage(p, terms) }));
	const chosen = new Set<number>([0]);
	let used = passages[0].length;
	const take = (i: number) => {
		if (i >= passages.length || chosen.has(i) || used + passages[i].length > maxChars) return;
		chosen.add(i);
		used += passages[i].length;
	};
	const ranked = [...scored].sort((a, b) => b.s - a.s || a.i - b.i).filter((c) => c.s > 0);
	for (const c of ranked) take(c.i);
	// Formulas usually sit right after (or, in DLMF, right before) the words that name them.
	for (const c of ranked) {
		if (!chosen.has(c.i)) continue;
		take(c.i + 1);
		if (c.i > 0) take(c.i - 1);
	}
	const parts: string[] = [];
	let last = -1;
	for (const i of [...chosen].sort((a, b) => a - b)) {
		if (last !== -1 && i !== last + 1) parts.push("[…]");
		parts.push(passages[i].length > maxChars ? `${passages[i].slice(0, maxChars)}…` : passages[i]);
		last = i;
	}
	return parts.join("\n\n");
}

export function stripTags(s: string): string {
	return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
