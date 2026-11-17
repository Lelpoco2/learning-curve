import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderLatex } from "@earendil-works/pi-tui";
import { expandMacros, findMath, mapMath, mapMathInMarkdown, parsePreamble } from "../extensions/lib/macros.ts";

const preamble = parsePreamble(readFileSync(new URL("../templates/preamble.sty", import.meta.url), "utf8"));

test("the shipped preamble parses into the expected macros", () => {
	assert.deepEqual([...preamble.keys()].sort(), ["C", "N", "Q", "R", "Z", "abs", "dd", "dv", "inner", "norm", "pdv", "uv", "vb"].sort());
	assert.deepEqual(preamble.get("inner"), { args: 2, body: "\\left\\langle #1, #2 \\right\\rangle" });
});

test("parsePreamble handles forms without braces, operators, comments and defaults", () => {
	const t = parsePreamble(
		["% \\newcommand{\\ignored}{x}", "\\newcommand\\eps{\\varepsilon} % comment", "\\renewcommand{\\vec}[1]{\\mathbf{#1}}", "\\DeclareMathOperator{\\rank}{rank}", "\\newcommand{\\opt}[2][x]{#1+#2}"].join("\n"),
	);
	assert.equal(t.has("ignored"), false);
	assert.deepEqual(t.get("eps"), { args: 0, body: "\\varepsilon" });
	assert.deepEqual(t.get("vec"), { args: 1, body: "\\mathbf{#1}" });
	assert.deepEqual(t.get("rank"), { args: 0, body: "\\operatorname{rank}" });
	assert.equal(t.get("opt")?.args, 2);
});

test("expandMacros substitutes arguments, nests, and never touches longer command names", () => {
	assert.equal(expandMacros("\\vb{a}\\cdot\\vb b", preamble), "\\mathbf{a}\\cdot\\mathbf{b}");
	assert.equal(expandMacros("x\\in\\R, \\Rightarrow", preamble), "x\\in\\mathbb{R}, \\Rightarrow");
	assert.equal(expandMacros("\\R x", preamble), "\\mathbb{R} x");
	assert.equal(expandMacros("\\pdv{f}{x}", preamble), "\\frac{\\partial f}{\\partial x}");
	assert.equal(expandMacros("\\abs{\\vb{v}}", preamble), "\\left\\lvert \\mathbf{v} \\right\\rvert");
	assert.equal(expandMacros("\\{x\\} \\\\ y", preamble), "\\{x\\} \\\\ y");
	const rec = parsePreamble("\\newcommand{\\a}{\\a x}");
	assert.ok(expandMacros("\\a", rec).length < 200, "self-recursive macros stop");
});

test("expanded vault formulas render in the terminal", () => {
	for (const tex of ["\\vb{a}\\cdot\\vb{b} = \\norm{\\vb a}\\,\\norm{\\vb b}\\cos\\theta", "\\int_0^1 f(x)\\dd x", "x\\in\\R", "\\inner{u}{v}=0", "\\dv{y}{t}=\\pdv{f}{t}", "\\abs{x}<1"]) {
		assert.equal(renderLatex(tex), undefined, `raw ${tex} is not renderable`);
		assert.notEqual(renderLatex(expandMacros(tex, preamble)), undefined, `expanded ${tex} renders`);
	}
});

test("findMath and mapMath locate inline and display math, ignoring escaped dollars", () => {
	const text = "Costa \\$5. Sia $x\\in\\R$ e\n$$\n\\abs{x}<1\n$$\nfine $a$.";
	assert.deepEqual(
		findMath(text).map((s) => [s.tex.trim(), s.display]),
		[
			["x\\in\\R", false],
			["\\abs{x}<1", true],
			["a", false],
		],
	);
	assert.equal(mapMath("a $x$ b", (s) => `<${s.tex}>`), "a <x> b");
});

test("chat display: vault macros are expanded only where the result renders", async () => {
	const { expandMathForDisplay } = await import("../extensions/math-display.ts");
	const md = "Sia $x\\in\\R$ e $\\vb{v}\\in\\R^3$.\n\n$$\n\\norm{\\vb{v}} = \\sqrt{\\inner{\\vb v}{\\vb v}}\n$$\n\nIgnota: $\\foo{x}\\R$. Codice: `$\\R$`.";
	const out = expandMathForDisplay(md, preamble);
	assert.match(out, /\$x\\in\\mathbb\{R\}\$/);
	assert.match(out, /\$\$\n\\left\\lVert \\mathbf\{v\} \\right\\rVert = \\sqrt\{\\left\\langle \\mathbf\{v\}, \\mathbf\{v\} \\right\\rangle\}\n\$\$/);
	// Unknown commands make the formula unrenderable: it is left exactly as written.
	assert.match(out, /Ignota: \$\\foo\{x\}\\R\$/);
	assert.match(out, /`\$\\R\$`/);
	assert.equal(expandMathForDisplay("no math here", preamble), "no math here");
});

test("dialog text: math is rendered as Unicode, display math on its own lines", async () => {
	const { renderMathText } = await import("../extensions/math-display.ts");
	assert.equal(renderMathText("Calcola $\\int_0^1 x^2\\dd x$ per $x\\in\\R$.", preamble, { caret: false }), "Calcola ∫₀¹ x² d x per x ∈ ℝ.");
	const display = renderMathText("Vero o falso?\n$$\\frac{a}{b}=1$$", preamble);
	assert.equal(display, "Vero o falso?\n\na\n─ = 1\nb\n");
	assert.equal(renderMathText("Costa \\$5", preamble), "Costa \\$5");
	assert.equal(renderMathText("$\\unknowncmd$", preamble), "$\\unknowncmd$");
});

test("caret exponents: unicode superscripts become full-size caret notation", async () => {
	const { caretFromUnicode, forceCaretExponents, ZWSP } = await import("../extensions/lib/exponents.ts");
	assert.equal(caretFromUnicode("2³ · 2⁴ = 2⁷"), "2^3 · 2^4 = 2^7");
	assert.equal(caretFromUnicode("xⁿ⁺¹ + a⁻² + 2¹⁰ + x₁²"), "x^(n+1) + a^(-2) + 2^10 + x₁^2");
	assert.equal(forceCaretExponents("2^3 + x^{n+1} + e^{i\\pi}"), `2^{3${ZWSP}} + x^{n+1${ZWSP}} + e^{i\\pi${ZWSP}}`);
	// Degrees, primes, transposes and escaped carets stay as they are.
	assert.equal(forceCaretExponents("90^\\circ + f^{\\prime} + A^T + \\^{o}"), "90^\\circ + f^{\\prime} + A^T + \\^{o}");
	// Idempotent.
	const once = forceCaretExponents("\\frac{a^2}{b^{3}}");
	assert.equal(forceCaretExponents(once), once);
});

test("dialogs and chat show exponents full size in caret mode", async () => {
	const { renderMathText, expandMathForDisplay } = await import("../extensions/math-display.ts");
	assert.equal(renderMathText("Semplifica $2^3 \\cdot 2^4$ e $x^{n+1}$.", preamble, { caret: true }), "Semplifica 2^3 · 2^4 e x^(n+1).");
	// Display: the 2D layout stays aligned (fraction bar as wide as the caret numerator).
	assert.equal(renderMathText("$$\\frac{a^2}{b^3}$$", preamble, { caret: true }), "\na^(2)\n─────\nb^(3)\n");
	// Chat: inline math pre-rendered (Markdown-escaped), display math left to pi with forced carets.
	const md = "Calcola $2^3 \\cdot 2^4$ e $|x|^2$.\n\n$$\n\\frac{a^2}{b}\n$$\n\nPrezzo: $x$, codice `$2^3$`.";
	const out = expandMathForDisplay(md, new Map(), { caret: true });
	assert.match(out, /Calcola 2\^3 · 2\^4 e \\\|x\\\|\^2\./);
	assert.match(out, /\$\$\n\\frac\{a\^\{2\u200B\}\}\{b\}\n\$\$/);
	assert.match(out, /Prezzo: \$x\$, codice `\$2\^3\$`\./);
	assert.equal(expandMathForDisplay(md, new Map(), { caret: false }), md);
	// Display math without a 2D layout is rendered like inline math (no parentheses on single digits).
	assert.equal(expandMathForDisplay("$$\n2^3 \\cdot 2^4 = 2^7\n$$", new Map(), { caret: true }), "2^3 · 2^4 = 2^7");
});

test("mapMathInMarkdown skips code blocks and inline code", () => {
	const md = "Text $\\R$ and `$\\R$` code.\n\n```latex\n$\\R$\n```\n\nAfter $\\R$.";
	const out = mapMathInMarkdown(md, (s) => `$${expandMacros(s.tex, preamble)}$`);
	assert.equal(out, "Text $\\mathbb{R}$ and `$\\R$` code.\n\n```latex\n$\\R$\n```\n\nAfter $\\mathbb{R}$.");
});
