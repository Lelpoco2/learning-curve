/**
 * LaTeX macros from the vault preamble (\newcommand, \renewcommand, \DeclareMathOperator) and
 * their expansion inside math, plus helpers to find math segments in Markdown/plain text.
 * Pure: no pi imports.
 */

export interface Macro {
	args: number;
	body: string;
}

export type MacroTable = Map<string, Macro>;

/** Read a balanced {...} group starting at `i` (which must point at "{"). */
function readGroup(s: string, i: number): { content: string; end: number } | undefined {
	if (s[i] !== "{") return undefined;
	let depth = 0;
	for (let j = i; j < s.length; j++) {
		const c = s[j];
		if (c === "\\") {
			j++;
			continue;
		}
		if (c === "{") depth++;
		else if (c === "}" && --depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
	}
	return undefined;
}

function skipSpaces(s: string, i: number): number {
	while (i < s.length && /\s/.test(s[i])) i++;
	return i;
}

/** Parse \newcommand / \renewcommand / \providecommand / \DeclareMathOperator definitions. */
export function parsePreamble(text: string): MacroTable {
	const table: MacroTable = new Map();
	const src = text.replace(/(^|[^\\])%.*$/gm, "$1"); // drop comments
	const re = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator)\*?\s*/g;
	for (let m = re.exec(src); m; m = re.exec(src)) {
		let i = m.index + m[0].length;
		let name: string | undefined;
		if (src[i] === "{") {
			const g = readGroup(src, i);
			if (!g) continue;
			name = g.content.trim();
			i = g.end;
		} else {
			name = src.slice(i).match(/^\\[A-Za-z]+/)?.[0];
			if (!name) continue;
			i += name.length;
		}
		if (!/^\\[A-Za-z]+$/.test(name)) continue;
		i = skipSpaces(src, i);
		let args = 0;
		if (m[1] !== "DeclareMathOperator" && src[i] === "[") {
			const close = src.indexOf("]", i);
			args = Number(src.slice(i + 1, close)) || 0;
			i = skipSpaces(src, close + 1);
			if (src[i] === "[") i = skipSpaces(src, src.indexOf("]", i) + 1); // optional default arg: ignored
		}
		const body = readGroup(src, i);
		if (!body) continue;
		const key = name.slice(1);
		const macro = m[1] === "DeclareMathOperator" ? { args: 0, body: `\\operatorname{${body.content}}` } : { args, body: body.content };
		if (m[1] === "providecommand" && table.has(key)) continue;
		table.set(key, macro);
		re.lastIndex = body.end;
	}
	return table;
}

/** Expand user macros in a LaTeX math string (repeatedly, for macros that use other macros). */
export function expandMacros(tex: string, macros: MacroTable, maxPasses = 8): string {
	if (macros.size === 0) return tex;
	let s = tex;
	for (let pass = 0; pass < maxPasses; pass++) {
		let changed = false;
		let out = "";
		let i = 0;
		while (i < s.length) {
			if (s[i] !== "\\") {
				out += s[i++];
				continue;
			}
			const word = s.slice(i).match(/^\\([A-Za-z]+)/);
			if (!word) {
				out += s.slice(i, i + 2); // escaped char like \{ or \\
				i += 2;
				continue;
			}
			const macro = macros.get(word[1]);
			if (!macro) {
				out += word[0];
				i += word[0].length;
				continue;
			}
			let j = i + word[0].length;
			const args: string[] = [];
			for (let k = 0; k < macro.args; k++) {
				j = skipSpaces(s, j);
				const g = readGroup(s, j);
				if (g) {
					args.push(g.content);
					j = g.end;
				} else if (s[j] === "\\") {
					const tok = s.slice(j).match(/^\\([A-Za-z]+|.)/)?.[0] ?? "\\";
					args.push(tok);
					j += tok.length;
				} else if (j < s.length) {
					args.push(s[j]);
					j++;
				} else args.push("");
			}
			let body = macro.body.replace(/#([1-9])/g, (_m, n: string) => args[Number(n) - 1] ?? "");
			// Keep a following letter from gluing onto a macro body that ends in a control word (\R x → \mathbb{R} x).
			if (/\\[A-Za-z]+$/.test(body) && /^[A-Za-z]/.test(s.slice(j))) body += " ";
			out += body;
			i = j;
			changed = true;
		}
		s = out;
		if (!changed) break;
	}
	return s;
}

export interface MathSegment {
	start: number;
	end: number;
	tex: string;
	display: boolean;
}

/** `$$…$$` and `$…$` segments of plain text (escaped `\$` ignored). */
export function findMath(text: string): MathSegment[] {
	const out: MathSegment[] = [];
	const re = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<![\\$])\$(?!\$)([^$\n]+?)(?<![\\$])\$(?!\$)/g;
	for (let m = re.exec(text); m; m = re.exec(text)) {
		const display = m[1] !== undefined;
		out.push({ start: m.index, end: m.index + m[0].length, tex: (display ? m[1] : m[2]) ?? "", display });
	}
	return out;
}

/** Replace math segments of plain text through `fn` (return undefined to keep the original). */
export function mapMath(text: string, fn: (seg: MathSegment) => string | undefined): string {
	let out = "";
	let last = 0;
	for (const seg of findMath(text)) {
		out += text.slice(last, seg.start) + (fn(seg) ?? text.slice(seg.start, seg.end));
		last = seg.end;
	}
	return out + text.slice(last);
}

/** Same as mapMath but leaves fenced code blocks and inline code spans of Markdown untouched. */
export function mapMathInMarkdown(md: string, fn: (seg: MathSegment) => string | undefined): string {
	const parts = md.split(/(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^ {0,3}(?:```|~~~)[^\n]*$|(?![\s\S])))/m);
	return parts
		.map((part, k) => {
			if (k % 2 === 1) return part; // code block
			const spans = part.split(/(`+[^`]*?`+)/);
			return spans.map((span, j) => (j % 2 === 1 ? span : mapMath(span, fn))).join("");
		})
		.join("");
}
