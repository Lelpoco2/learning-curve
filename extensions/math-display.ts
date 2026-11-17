/**
 * Terminal display of math. pi already renders `$…$` / `$$…$$` in chat as Unicode
 * (stacked fractions, limits, matrices); this module
 * - expands the vault preamble macros (\vb, \R, \pdv, …) right before display so formulas using
 *   them render too (display-only: notes and model context are unchanged);
 * - renders math in plain-text places such as quiz dialogs.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { renderLatex } from "@earendil-works/pi-tui";
import { caretFromUnicode, escapeMarkdownText, forceCaretExponents, ZWSP } from "./lib/exponents.ts";
import { setMathRenderer } from "./lib/mathtext.ts";
import { expandMacros, type MacroTable, mapMath, mapMathInMarkdown, parsePreamble } from "./lib/macros.ts";
import { TEMPLATES_DIR } from "./lib/notes.ts";
import { notesRoot } from "./lib/workspace.ts";
import { getWorkspace } from "./runtime.ts";

const RECHECK_MS = 3000;
let cache: { file: string; mtime: number; table: MacroTable; checkedAt: number } | undefined;

/** Macros of the vault preamble (or the shipped default), re-read when the file changes. */
export function currentMacros(): MacroTable {
	const ws = getWorkspace();
	const vaultFile = ws ? join(notesRoot(ws), "preamble.sty") : undefined;
	const file = vaultFile && existsSync(vaultFile) ? vaultFile : join(TEMPLATES_DIR, "preamble.sty");
	const now = Date.now();
	if (cache && cache.file === file && now - cache.checkedAt < RECHECK_MS) return cache.table;
	try {
		const mtime = statSync(file).mtimeMs;
		if (!cache || cache.file !== file || cache.mtime !== mtime) {
			cache = { file, mtime, table: parsePreamble(readFileSync(file, "utf8")), checkedAt: now };
		} else cache.checkedAt = now;
	} catch {
		cache = { file, mtime: 0, table: new Map(), checkedAt: now };
	}
	return cache.table;
}

export interface MathDisplayOptions {
	/** Show exponents in caret form (`2^3`, `x^(n+1)`) instead of small Unicode superscripts. */
	caret?: boolean;
}

/** Whether the workspace wants caret exponents (config `mathExponents`, default "caret"). */
export function caretExponents(): boolean {
	return getWorkspace()?.config.mathExponents !== "superscript";
}

/**
 * Markdown for display (chat). Math using vault macros is expanded; with `caret`, exponents are
 * shown full size: inline formulas are pre-rendered by us (`2^3`), display formulas are handed to
 * pi with forced caret exponents so their 2D layout stays aligned. Notes and context unchanged.
 */
export function expandMathForDisplay(md: string, macros: MacroTable, opts: MathDisplayOptions = {}): string {
	if (!md.includes("$")) return md;
	const caret = opts.caret === true && md.includes("^");
	if (!caret && (macros.size === 0 || !md.includes("\\"))) return md;
	return mapMathInMarkdown(md, (seg) => {
		const expanded = macros.size ? expandMacros(seg.tex, macros) : seg.tex;
		if (caret && expanded.includes("^")) {
			// Single-line results (all inline math, display math without a 2D layout): render here.
			const rendered = renderLatex(expanded.trim(), { display: seg.display });
			if (rendered !== undefined && !rendered.includes("\n")) return escapeMarkdownText(caretFromUnicode(rendered.trim()));
			const forced = forceCaretExponents(expanded);
			if (renderLatex(forced.trim(), { display: seg.display }) !== undefined) return seg.display ? `$$${forced}$$` : `$${forced}$`;
		}
		if (expanded === seg.tex) return undefined;
		if (renderLatex(expanded.trim(), { display: seg.display }) === undefined) return undefined;
		return seg.display ? `$$${expanded}$$` : `$${expanded}$`;
	});
}

/** Plain text (dialogs): replace math with its Unicode rendering; unrenderable math stays as LaTeX. */
export function renderMathText(text: string, macros: MacroTable = currentMacros(), opts: MathDisplayOptions = { caret: caretExponents() }): string {
	if (!text.includes("$")) return text;
	return mapMath(text, (seg) => {
		const tex = expandMacros(seg.tex, macros).trim();
		if (seg.display) {
			const rendered = renderLatex(opts.caret ? forceCaretExponents(tex) : tex, { display: true });
			return rendered === undefined ? undefined : `\n${rendered.replaceAll(ZWSP, "")}\n`;
		}
		const rendered = renderLatex(tex);
		if (rendered === undefined) return undefined;
		return opts.caret ? caretFromUnicode(rendered) : rendered;
	});
}

export function registerMathDisplay(pi: ExtensionAPI): void {
	// Quiz dialogs show math rendered as Unicode.
	setMathRenderer((text) => renderMathText(text));
	pi.registerMarkdownTransformer((markdown, ctx) => {
		if (!getWorkspace()) return markdown;
		// The learner's own messages: readable exponents only (their macros are left as typed).
		return expandMathForDisplay(markdown, ctx.messageType === "user" ? new Map() : currentMacros(), { caret: caretExponents() });
	});
}
