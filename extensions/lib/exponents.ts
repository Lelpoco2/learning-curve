/**
 * Readable exponents in the terminal. pi renders `2^3` as `2³`: Unicode superscripts are
 * half-height in most terminal fonts and easy to misread. In caret mode exponents are shown at
 * full size: `2^3`, `x^(n+1)`.
 * - Rendered single-line math: Unicode superscript runs → caret notation (`caretFromUnicode`).
 * - TeX handed to pi's renderer (display math, 2D layouts): a zero-width space inside each
 *   exponent makes the renderer fall back to `^(…)` while keeping the layout aligned
 *   (`forceCaretExponents`).
 */

/** Inverse of pi-tui's superscript table. */
const FROM_SUPERSCRIPT: Record<string, string> = {
	"⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
	"⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")",
	"ᵃ": "a", "ᵇ": "b", "ᶜ": "c", "ᵈ": "d", "ᵉ": "e", "ᶠ": "f", "ᵍ": "g", "ʰ": "h", "ⁱ": "i", "ʲ": "j",
	"ᵏ": "k", "ˡ": "l", "ᵐ": "m", "ⁿ": "n", "ᵒ": "o", "ᵖ": "p", "ʳ": "r", "ˢ": "s", "ᵗ": "t", "ᵘ": "u",
	"ᵛ": "v", "ʷ": "w", "ˣ": "x", "ʸ": "y", "ᶻ": "z",
};
const SUP_RUN = new RegExp(`[${Object.keys(FROM_SUPERSCRIPT).join("")}]+`, "gu");

export const ZWSP = "\u200B";

/** `2³ · 2⁴` → `2^3 · 2^4`, `xⁿ⁺¹` → `x^(n+1)`, `a⁻²` → `a^(-2)`, `2¹⁰` → `2^10`. */
export function caretFromUnicode(text: string): string {
	return text.replace(SUP_RUN, (run) => {
		const plain = Array.from(run, (c) => FROM_SUPERSCRIPT[c]).join("");
		return /^(?:[0-9]+|[a-z])$/.test(plain) ? `^${plain}` : `^(${plain})`;
	});
}

/** Exponents that already read well and must stay as symbols (degrees, primes, conjugates…). */
const KEEP = new Set(["\\circ", "\\prime", "\\prime\\prime", "\\ast", "*", "\\dagger", "\\star", "T", "\\top", "\\perp", "+", "-"]);

/**
 * Make pi's renderer print every superscript in caret form: `2^{3}` → `2^{3\u200B}` (renders as
 * `2^(3)`, full size, and keeps 2D layouts aligned because the zero-width space has no width).
 */
export function forceCaretExponents(tex: string): string {
	let out = "";
	let i = 0;
	while (i < tex.length) {
		const ch = tex[i];
		if (ch === "\\") {
			// Copy a whole command (\^ or \frac…) so its characters are never read as an exponent.
			const m = tex.slice(i).match(/^\\(?:[A-Za-z]+|.)/);
			const cmd = m ? m[0] : ch;
			out += cmd;
			i += cmd.length;
			continue;
		}
		if (ch !== "^") {
			out += ch;
			i++;
			continue;
		}
		// Parse the exponent token after ^.
		let j = i + 1;
		while (tex[j] === " ") j++;
		let content: string;
		let end: number;
		if (tex[j] === "{") {
			let depth = 0;
			end = j;
			for (; end < tex.length; end++) {
				if (tex[end] === "\\") {
					end++;
					continue;
				}
				if (tex[end] === "{") depth++;
				else if (tex[end] === "}" && --depth === 0) break;
			}
			if (end >= tex.length) {
				out += tex.slice(i);
				break;
			}
			content = tex.slice(j + 1, end);
			end++;
		} else if (tex[j] === "\\") {
			const m = tex.slice(j).match(/^\\(?:[A-Za-z]+|.)/);
			content = m ? m[0] : "\\";
			end = j + content.length;
		} else if (j < tex.length) {
			content = tex[j];
			end = j + 1;
		} else {
			out += tex.slice(i);
			break;
		}
		const trimmed = content.trim();
		if (KEEP.has(trimmed) || trimmed === "" || trimmed.includes(ZWSP)) out += tex.slice(i, end);
		else out += `^{${content}${ZWSP}}`;
		i = end;
	}
	return out;
}

/** Escape text so Markdown shows it literally (used for math pre-rendered into chat text). */
export function escapeMarkdownText(text: string): string {
	return text.replace(/[\\`*_[\]<>|~$]/g, (c) => `\\${c}`);
}
