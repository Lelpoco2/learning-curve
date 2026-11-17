/**
 * Obsidian Flavored Markdown checker for learning notes. Pure: works on text plus an optional
 * index of the vault's files (for link checks).
 */

export type Severity = "error" | "warning";

export interface Issue {
	line: number;
	rule: string;
	severity: Severity;
	message: string;
}

export interface VaultIndex {
	/** Lower-case vault-relative paths of Markdown notes, without ".md". */
	notes: Set<string>;
	/** Lower-case note basenames, without ".md". */
	noteNames: Set<string>;
	/** Lower-case vault-relative paths of other files (with extension). */
	files: Set<string>;
	/** Lower-case basenames of other files (with extension). */
	fileNames: Set<string>;
}

export function buildVaultIndex(relativePaths: string[]): VaultIndex {
	const idx: VaultIndex = { notes: new Set(), noteNames: new Set(), files: new Set(), fileNames: new Set() };
	for (const raw of relativePaths) {
		const p = raw.replace(/\\/g, "/").toLowerCase();
		const base = p.split("/").pop() ?? p;
		if (p.endsWith(".md")) {
			idx.notes.add(p.slice(0, -3));
			idx.noteNames.add(base.slice(0, -3));
		} else {
			idx.files.add(p);
			idx.fileNames.add(base);
		}
	}
	return idx;
}

/** Built-in Obsidian callout types and aliases. Others render as "note" (allowed, but flagged). */
const CALLOUTS = new Set(
	"note abstract summary tldr info todo tip hint important success check done question help faq warning caution attention failure fail missing danger error bug example quote cite".split(
		" ",
	),
);

const REQUIRED: Record<string, string[]> = {
	lesson: ["type", "subject", "topic", "lesson", "status", "created", "updated", "tags"],
	"study-plan": ["type", "subject", "topic", "created", "tags"],
	quiz: ["type", "subject", "scope", "created", "tags"],
	test: ["type", "subject", "scope", "created", "tags"],
	exercises: ["type", "subject", "scope", "created", "tags"],
	exam: ["type", "subject", "scope", "created", "tags"],
	reinforcement: ["type", "subject", "topic", "concept", "status", "created", "tags"],
	topic: ["type", "subject", "topic", "status", "tags"],
	subject: ["type", "subject", "tags"],
};

const MEDIA_EXT = /\.(png|jpe?g|gif|svg|webp|bmp|mp4|webm|mov|mkv|ogv|mp3|wav|m4a|ogg|flac|pdf|excalidraw|canvas)$/i;

interface FrontmatterResult {
	end: number; // index of the closing --- line (exclusive body start), -1 when absent
	props: Map<string, string>;
}

function checkFrontmatter(lines: string[], issues: Issue[]): FrontmatterResult {
	const props = new Map<string, string>();
	if (lines[0]?.trim() !== "---") return { end: -1, props };
	const close = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
	if (close === -1) {
		issues.push({ line: 1, rule: "frontmatter", severity: "error", message: "Frontmatter is not closed with a `---` line." });
		return { end: -1, props };
	}
	let lastKeyEmpty = false;
	for (let i = 1; i < close; i++) {
		const line = lines[i];
		const n = i + 1;
		if (!line.trim() || line.trim().startsWith("#")) continue;
		if (/^\t/.test(line)) {
			issues.push({ line: n, rule: "frontmatter", severity: "error", message: "Tabs are not allowed in YAML: indent with spaces." });
			continue;
		}
		if (/^\s+-\s/.test(line) || /^-\s/.test(line)) {
			if (!lastKeyEmpty) issues.push({ line: n, rule: "frontmatter", severity: "error", message: "List item without a property above it (`key:` with an empty value)." });
			continue;
		}
		const m = line.match(/^([A-Za-z0-9_][A-Za-z0-9_ -]*):(?:\s+(.*)|\s*)$/);
		if (!m) {
			issues.push({ line: n, rule: "frontmatter", severity: "error", message: `Not a valid property line: \`${line.trim()}\` (expected \`key: value\`).` });
			continue;
		}
		const key = m[1].trim();
		const value = (m[2] ?? "").trim();
		if (props.has(key)) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `Duplicate property \`${key}\`.` });
		props.set(key, value);
		lastKeyEmpty = value === "";
		if (!value) continue;
		const ph = value.match(/\{\{\s*[A-Za-z]\w*\s*\}\}/);
		if (ph) issues.push({ line: n, rule: "placeholder", severity: "error", message: `\`${key}\`: template placeholder \`${ph[0]}\` was not filled.` });
		if (value.startsWith("[") && !value.endsWith("]")) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: list not closed with \`]\`.` });
		if (value.startsWith("[")) {
			const opens = (value.match(/\[/g) ?? []).length;
			const closes = (value.match(/\]/g) ?? []).length;
			if (opens !== closes) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: unbalanced brackets (quote wikilinks inside lists: \`"[[Note]]"\`).` });
		}
		for (const q of ['"', "'"]) {
			if (value.startsWith(q) && (value.length < 2 || !value.endsWith(q))) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: quoted value not closed with ${q}.` });
		}
		const plain = !/^["'[{]/.test(value);
		if (plain && /:\s/.test(value)) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: unquoted value contains \": \" — wrap it in double quotes.` });
		if (plain && (value.startsWith("#") || /\s#/.test(value))) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: \"#\" starts a YAML comment — quote the value (tags go without #).` });
		if (plain && value.startsWith("[[")) issues.push({ line: n, rule: "frontmatter", severity: "error", message: `\`${key}\`: wikilinks in properties must be quoted: \`"[[Note]]"\`.` });
	}
	const type = props.get("type")?.replace(/^["']|["']$/g, "");
	for (const key of (type && REQUIRED[type]) || []) {
		if (!props.has(key)) issues.push({ line: 1, rule: "frontmatter", severity: "warning", message: `Missing property \`${key}\` for a note of type \`${type}\`.` });
	}
	return { end: close, props };
}

/** Remove inline code spans so their content is not checked. */
function stripInlineCode(line: string): string {
	return line.replace(/(`+)[\s\S]*?\1/g, (m) => " ".repeat(m.length));
}

/** Count `$` delimiters that are not escaped and not part of `$$`. */
function singleDollars(text: string): number {
	return (text.replace(/\\\$/g, "").replace(/\$\$/g, "").match(/\$/g) ?? []).length;
}

export function resolveLink(target: string, idx: VaultIndex): boolean {
	const t = target.trim().replace(/^\/+/, "").replace(/\\/g, "/").toLowerCase();
	if (!t) return true;
	if (MEDIA_EXT.test(t) || /\.[a-z0-9]{2,5}$/.test(t) && !t.endsWith(".md")) {
		return idx.files.has(t) || idx.fileNames.has(t.split("/").pop() ?? t) || idx.notes.has(t) || idx.noteNames.has(t.split("/").pop() ?? t);
	}
	const note = t.endsWith(".md") ? t.slice(0, -3) : t;
	return idx.notes.has(note) || idx.noteNames.has(note.split("/").pop() ?? note);
}

export interface LintOptions {
	index?: VaultIndex;
}

export function lintNote(content: string, opts: LintOptions = {}): Issue[] {
	const issues: Issue[] = [];
	const lines = content.replace(/\r\n?/g, "\n").split("\n");
	const fm = checkFrontmatter(lines, issues);
	const start = fm.end + 1;

	let inFence: { marker: string; line: number } | undefined;
	let displayOpen: number | undefined; // line where an unclosed $$ started
	let paragraph: { start: number; dollars: number } | undefined;
	let inCallout = false;
	let prevQuoted = false;
	const footRefs = new Map<string, number>();
	const footDefs = new Set<string>();
	let h1 = 0;
	const markers: { name: string; kind: string; line: number }[] = [];
	const headings: Heading[] = [];
	const fmProp = (name: string) =>
		lines
			.slice(0, Math.max(0, fm.end))
			.map((l) => l.match(new RegExp(`^${name}:\\s*["']?([\\w-]+)`))?.[1])
			.find(Boolean);
	const noteType = fmProp("type");
	const codeLesson = noteType === "lesson" && ["cs", "programming"].includes(fmProp("kind") ?? "");

	const endParagraph = () => {
		if (paragraph && paragraph.dollars % 2 === 1) {
			issues.push({ line: paragraph.start, rule: "math", severity: "error", message: "Unbalanced `$`: an inline formula is not closed (escape a literal dollar as `\\$`)." });
		}
		paragraph = undefined;
	};

	for (let i = start; i < lines.length; i++) {
		const raw = lines[i];
		const n = i + 1;

		// Fenced code blocks: skip their content entirely.
		const fence = raw.replace(/^(>\s?)+/, "").match(/^\s*(`{3,}|~{3,})/);
		if (fence) {
			if (!inFence && codeLesson && !/^\s*(?:`{3,}|~{3,})\s*[\w+#.-]/.test(raw.replace(/^(>\s?)+/, ""))) {
				issues.push({ line: n, rule: "code", severity: "warning", message: "Code block without a language: tag it (```python, ```cpp, ```sql…; program output in ```text)." });
			}
			if (!inFence) inFence = { marker: fence[1][0], line: n };
			else if (fence[1][0] === inFence.marker) inFence = undefined;
			endParagraph();
			continue;
		}
		if (inFence) continue;

		const lc = raw.match(/<!--\s*lc:([a-z-]+):(begin|end)\s*-->/);
		if (lc) markers.push({ name: lc[1], kind: lc[2], line: n });

		const quoted = /^\s*>/.test(raw);
		const body = stripInlineCode(raw.replace(/^(\s*>\s?)+/, "")).replace(/%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "");

		// Callouts: continuation lines must keep the ">" prefix.
		const calloutStart = raw.match(/^\s*>\s*\[!([^\]]+)\]([+-]?)/);
		if (calloutStart) {
			inCallout = true;
			const type = calloutStart[1].trim().toLowerCase();
			if (!CALLOUTS.has(type)) issues.push({ line: n, rule: "callout", severity: "warning", message: `Unknown callout type \`${type}\` (renders as a plain note).` });
		} else if (!quoted && raw.trim() === "") {
			inCallout = false;
		} else if (!quoted && inCallout && prevQuoted) {
			issues.push({ line: n, rule: "callout", severity: /\$\$/.test(raw) ? "error" : "warning", message: "Line inside a callout without the `>` prefix: prefix it with `> ` (or add a blank line to end the callout)." });
			inCallout = false;
		}
		prevQuoted = quoted;

		// Headings: one blank line after each; collected for the numbering check.
		if (/^#\s/.test(raw)) h1++;
		const hd = raw.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
		if (hd) {
			headings.push({ level: hd[1].length, text: hd[2], line: n });
			if (i + 1 < lines.length && lines[i + 1].trim() !== "") {
				issues.push({ line: n, rule: "heading", severity: "warning", message: `Heading \`${hd[2]}\` is not followed by a blank line: add one.` });
			}
		}

		// Math. A line is either inside a $$ block, opens/closes one, or is ordinary text.
		const insideDisplay = displayOpen !== undefined;
		const displayCount = (body.replace(/\\\$/g, "").match(/\$\$/g) ?? []).length;
		if (displayCount % 2 === 1) displayOpen = insideDisplay ? undefined : n;
		if (body.trim() === "" || displayCount % 2 === 1) endParagraph();
		if (!insideDisplay && displayCount % 2 === 0) {
			// Ordinary text line (it may also hold complete $$…$$ formulas).
			const d = singleDollars(body);
			if (body.trim()) {
				paragraph ??= { start: n, dollars: 0 };
				paragraph.dollars += d;
			}
			for (const m of body.replace(/\$\$[\s\S]*?\$\$/g, " ").matchAll(/(?<![\\$])\$(?!\$)([^$\n]+?)(?<![\\$])\$(?!\$)/g)) {
				if (/^\s|\s$/.test(m[1])) {
					issues.push({ line: n, rule: "math", severity: "error", message: `Inline math \`$${m[1]}$\` has a space next to \`$\`: Obsidian does not render it (write \`$${m[1].trim()}$\`).` });
				}
			}
			const prose = body.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/(?<!\\)\$[^$\n]*?(?<!\\)\$/g, " ");
			const ph = prose.match(/\{\{\s*[A-Za-z]\w*\s*\}\}/);
			if (ph) issues.push({ line: n, rule: "placeholder", severity: "error", message: `Template placeholder \`${ph[0]}\` was not filled.` });
			if (/\\\(|\\\[/.test(prose)) {
				issues.push({ line: n, rule: "math", severity: "error", message: "Use `$…$` / `$$…$$` for math, not `\\(…\\)` or `\\[…\\]` (Obsidian does not render them)." });
			}
		}

		// Tables: a wikilink alias pipe must be escaped.
		if (/^\s*\|/.test(raw)) {
			for (const m of stripInlineCode(raw).matchAll(/\[\[([^\]]*)\]\]/g)) {
				if (/(?<!\\)\|/.test(m[1])) issues.push({ line: n, rule: "table", severity: "error", message: `Wikilink \`[[${m[1]}]]\` inside a table: escape the alias pipe as \`\\|\`.` });
			}
		}

		// Links and embeds.
		for (const m of body.matchAll(/(!?)\[\[([^\]]+)\]\]/g)) {
			const target = m[2].split(/\\?\|/)[0].split("#")[0];
			if (opts.index && target.trim() && !resolveLink(target, opts.index)) {
				const embed = m[1] === "!";
				issues.push({
					line: n,
					rule: "link",
					severity: embed ? "error" : "warning",
					message: embed ? `Embedded file \`${target}\` does not exist.` : `Link to \`${target}\`: no such note yet (fine only if it will be created, e.g. a planned lesson).`,
				});
			}
		}
		if (/\]\((?!https?:|mailto:|#)[^)]*\.\.\//.test(body)) {
			issues.push({ line: n, rule: "link", severity: "warning", message: "Relative `../` Markdown link: use a vault-relative wikilink instead." });
		}

		// Footnotes.
		const def = body.match(/^\[\^([^\]]+)\]:/);
		if (def) footDefs.add(def[1]);
		for (const m of body.matchAll(/\[\^([^\]]+)\](?!:)/g)) if (!footRefs.has(m[1])) footRefs.set(m[1], n);
	}
	endParagraph();

	if (inFence) issues.push({ line: inFence.line, rule: "code", severity: "error", message: "Code block opened here is never closed." });
	if (displayOpen !== undefined) issues.push({ line: displayOpen, rule: "math", severity: "error", message: "Display math `$$` opened here is never closed." });
	for (const [ref, line] of footRefs) {
		if (!footDefs.has(ref)) issues.push({ line, rule: "footnote", severity: "error", message: `Footnote \`[^${ref}]\` has no definition (\`[^${ref}]: …\` in the Sources section).` });
	}
	if (noteType === "lesson" || noteType === "reinforcement") checkNumbering(headings, issues);
	if (noteType === "flashcards") {
		checkNumbering(headings, issues, true);
		checkFlashcards(lines, start, issues);
	}
	if (h1 > 1) issues.push({ line: 1, rule: "heading", severity: "warning", message: `${h1} top-level \`#\` headings: keep one title and use \`##\` for sections.` });
	const names = new Set(markers.map((m) => m.name));
	for (const name of names) {
		const b = markers.filter((m) => m.name === name && m.kind === "begin");
		const e = markers.filter((m) => m.name === name && m.kind === "end");
		if (b.length !== 1 || e.length !== 1 || b[0].line > e[0].line) {
			issues.push({ line: (b[0] ?? e[0]).line, rule: "generated", severity: "error", message: `Generated section markers \`lc:${name}\` are broken (need exactly one begin before one end).` });
		}
	}
	return issues.sort((a, b) => a.line - b.line);
}

interface Heading {
	level: number;
	text: string;
	line: number;
}

/**
 * Dotted section numbering ("## 1. Title", "### 1.1 Title"): in order, no gaps or repeats,
 * sub-numbers matching their parent. Unnumbered `##` sections are back matter (Sources…)
 * and must come after the numbered ones.
 */
function checkNumbering(headings: Heading[], issues: Issue[], freeTop = false): void {
	const sections = headings.filter((h) => h.level >= 2);
	const numOf = (h: Heading) => h.text.match(/^(\d+(?:\.\d+)*)\.?\s+\S/)?.[1]?.split(".").map(Number);
	const h2 = sections.filter((h) => h.level === 2);
	if (h2.length >= 2 && !h2.some((h) => numOf(h))) {
		issues.push({ line: h2[0].line, rule: "numbering", severity: "warning", message: "Sections are not numbered: use dotted notation (`## 1. Title`, `### 1.1 Title`); back matter like Sources stays unnumbered." });
		return;
	}
	const counters: number[] = []; // counters[d] = last number at depth d (H2 = depth 0)
	let backMatter: Heading | undefined;
	let parentNumbered = false;
	for (const h of sections) {
		const depth = h.level - 2;
		const num = numOf(h);
		if (!num) {
			if (depth === 0) {
				backMatter ??= h;
				parentNumbered = false;
			} else if (parentNumbered && counters.length >= depth) {
				const expected = [...counters.slice(0, depth), (counters[depth] ?? 0) + 1].join(".");
				issues.push({ line: h.line, rule: "numbering", severity: "warning", message: `Heading \`${h.text}\` has no number: expected \`${expected}\`.` });
			}
			continue;
		}
		if (depth === 0) {
			if (backMatter) {
				issues.push({ line: backMatter.line, rule: "numbering", severity: "warning", message: `Unnumbered section \`${backMatter.text}\` before numbered ones: number it, or move it to the end (back matter).` });
				backMatter = undefined;
			}
			parentNumbered = true;
		}
		const expected = [...counters.slice(0, depth), (counters[depth] ?? 0) + 1];
		// freeTop: top sections carry an external number (the lesson's), only increasing.
		const ok =
			num.length === depth + 1 &&
			(freeTop && depth === 0 ? num[0] > (counters[0] ?? 0) : num.every((v, k) => v === expected[k]));
		if (!ok) {
			issues.push({ line: h.line, rule: "numbering", severity: "warning", message: `Heading \`${h.text}\`: expected number \`${expected.join(".")}\` (dotted numbering in order, matching the parent section).` });
		}
		// Continue from what is written, so one mistake is reported once.
		counters.length = 0;
		counters.push(...(num.length === depth + 1 ? num : expected));
	}
}

/**
 * Topic flashcards notes (Spaced Repetition plugin): every card in the multi-line format
 * (question / `?` / answer) under its own heading; no `::` one-liners and no highlights
 * (the plugin turns `==text==` into cloze cards).
 */
function checkFlashcards(lines: string[], start: number, issues: Issue[]): void {
	let fence = false;
	for (let i = start; i < lines.length; i++) {
		const raw = lines[i];
		if (/^\s*(`{3,}|~{3,})/.test(raw)) fence = !fence;
		if (fence || raw.startsWith("<!--")) continue;
		const text = stripInlineCode(raw);
		const n = i + 1;
		if (text.includes("::")) {
			issues.push({ line: n, rule: "flashcard", severity: "warning", message: "One-line card (`::`): use the multi-line format — question, a line with only `?`, answer — under its own `###` heading." });
		}
		if (/==[^=\s][^=]*==/.test(text.replace(/\$[^$]*\$/g, ""))) {
			issues.push({ line: n, rule: "flashcard", severity: "warning", message: "Highlight `==…==` in a flashcards note: the Spaced Repetition plugin turns it into a cloze card. Remove it unless you want a cloze." });
		}
		if (raw.trim() === "?" || raw.trim() === "??") {
			let j = i - 1;
			while (j > start && lines[j].trim() !== "") j--;
			const before = lines[j - 1] ?? "";
			if (lines[j].trim() !== "" || !/^#{2,6}\s/.test(before)) {
				issues.push({ line: j + 2, rule: "flashcard", severity: "warning", message: "Card without its own heading: put each card under a `### N.k Topic` heading (a blank line between heading and question)." });
			}
		}
	}
}

export function formatIssues(file: string, issues: Issue[]): string {
	return issues.map((i) => `${file}:${i.line} ${i.severity === "error" ? "✗" : "⚠"} [${i.rule}] ${i.message}`).join("\n");
}
