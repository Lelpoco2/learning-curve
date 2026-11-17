import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chunkPdfPages, chunkText, loadLocalChunks, localCitation, searchChunks } from "../extensions/lib/sources/local.ts";
import { htmlToText, nlabSourceToText, queryTerms, relevantExcerpt, wikitextToText } from "../extensions/lib/sources/text.ts";
import { formatCrossref, oeisId, parseArxiv, parseCodata, searchConstants } from "../extensions/lib/sources/web.ts";

test("htmlToText keeps LaTeX from MathML alttext and drops scripts", () => {
	const html = `<html><head><title>x</title></head><body><script>var a=1;</script><p>Euler: <math alttext="\\Gamma\\left(z+1\\right)=z\\Gamma\\left(z\\right)"><mi>Γ</mi></math> holds &amp; more.</p><ul><li>one</li><li>two</li></ul></body></html>`;
	const t = htmlToText(html);
	assert.match(t, /Euler: \$\\Gamma\\left\(z\+1\\right\)=z\\Gamma\\left\(z\\right\)\$ holds & more\./);
	assert.match(t, /- one\n- two/);
	assert.doesNotMatch(t, /var a/);
});

test("wikitextToText converts math, templates, links and headings", () => {
	const w = [
		"{{Short description|Theorem}}",
		"In [[calculus]], the '''mean value theorem''' states that if {{mvar|f}} is [[continuous function|continuous]] on <math>[a,b]</math><ref>Rudin, p. 108</ref>:",
		'<math display="block">f\'(c) = \\frac{f(b)-f(a)}{b-a}</math>',
		"== Statement ==",
		"[[File:Mvt2.svg|thumb|Illustration]]",
		"{| class=wikitable",
		"| a || b",
		"|}",
		"See [https://example.org the example].",
	].join("\n");
	const t = wikitextToText(w);
	assert.match(t, /In calculus, the mean value theorem states that if f is continuous on \$\[a,b\]\$:/);
	assert.match(t, /\$\$f'\(c\) = \\frac\{f\(b\)-f\(a\)\}\{b-a\}\$\$/);
	assert.match(t, /## Statement/);
	assert.doesNotMatch(t, /Short description|Rudin|Mvt2|wikitable/);
	assert.match(t, /See the example\./);
});

test("nLab source markup is cleaned", () => {
	const src = "+-- {: .rightHandSide}\n[[!include algebra - contents]]\n=--\n## Definition\nA __vector space__ over $k$ is a [[module]] over the [[ring|ring]] $k$.\n{:toc}";
	const t = nlabSourceToText(src);
	assert.match(t, /## Definition\nA __vector space__ over \$k\$ is a module over the ring \$k\$\./);
	assert.doesNotMatch(t, /include|rightHandSide|toc/);
});

test("relevantExcerpt keeps the opening, the matching passages and their neighbours", () => {
	const text = [
		"Intro definition paragraph.",
		"Unrelated history A.",
		"Unrelated history B.",
		"The hypotheses: f continuous on [a,b] and differentiable on (a,b).",
		"$f'(c)=\\frac{f(b)-f(a)}{b-a}$",
		"Unrelated C.",
		"Unrelated D.",
	].join("\n\n");
	const ex = relevantExcerpt(text, "hypotheses continuous differentiable", 300);
	assert.match(ex, /^Intro definition paragraph\.\n\n\[…\]\n\nUnrelated history B\.\n\nThe hypotheses.*\n\n\$f'\(c\)/s);
	assert.doesNotMatch(ex, /history A|Unrelated C|Unrelated D/);
	assert.deepEqual(queryTerms("Teorema di Lagrange: ipotesi"), ["teorema", "lagrange", "ipotesi"]);
});

const CODATA = [
	"             Fundamental Physical Constants --- Complete Listing",
	"             2022 CODATA adjustment",
	"",
	"  Quantity                                                       Value                 Uncertainty           Unit",
	"-----------------------------------------------------------------------------------------------------------------------------",
	"Newtonian constant of gravitation                           6.674 30 e-11            0.000 15 e-11            m^3 kg^-1 s^-2",
	"speed of light in vacuum                                    299 792 458              (exact)                  m s^-1",
	"electron mass                                               9.109 383 7139 e-31      0.000 000 0028 e-31      kg",
].join("\n");

test("DLMF equations carry their number and keywords", async () => {
	const { dlmfToText, titleCandidates, rankByTitleInQuery } = await import("../extensions/lib/sources/web.ts");
	const html = `<div class="ltx_para"><table id="E3" class="ltx_equation ltx_eqn_table"><tr><td><math alttext="\\Gamma\\left(z\\right)\\Gamma\\left(1-z\\right)=\\pi/\\sin\\left(\\pi z\\right)"><mi>x</mi></math></td></tr></table><div class="ltx_infocontent"><dl><dt>Keywords:</dt><dd><a>gamma function</a>, <a>reflection formula</a></dd><dt>Permalink:</dt><dd>x</dd></dl></div></div>`;
	const t = dlmfToText(html, "5.5");
	assert.match(t, /Equation 5\.5\.3: \$\\Gamma\\left\(z\\right\)\\Gamma\\left\(1-z\\right\)=\\pi\/\\sin\\left\(\\pi z\\right\)\$ — keywords: gamma function, reflection formula/);
	assert.doesNotMatch(t, /Permalink/);
	assert.deepEqual(titleCandidates("mean value theorem hypotheses").slice(0, 3), ["mean value theorem hypotheses", "mean value theorem", "value theorem hypotheses"]);
	assert.deepEqual(
		rankByTitleInQuery([{ title: "Central limit theorem" }, { title: "Mean value theorem" }], "mean value theorem hypotheses").map((h) => h.title),
		["Mean value theorem", "Central limit theorem"],
	);
});

test("CODATA table parsing and search", () => {
	const { year, constants } = parseCodata(CODATA);
	assert.equal(year, "2022");
	assert.equal(constants.length, 3);
	assert.deepEqual(constants[1], { name: "speed of light in vacuum", value: "299 792 458", uncertainty: "(exact)", unit: "m s^-1" });
	assert.equal(searchConstants(constants, "speed of light")[0].name, "speed of light in vacuum");
	assert.equal(searchConstants(constants, "gravitational constant G").length, 0 + searchConstants(constants, "gravitational constant G").length);
	assert.equal(searchConstants(constants, "electron mass")[0].unit, "kg");
});

test("arXiv Atom, Crossref and OEIS formatting", () => {
	const atom = `<feed><entry><id>http://arxiv.org/abs/2101.00001v2</id><published>2021-01-01T00:00:00Z</published><title>A note on\n the MVT</title><summary> We prove things. </summary><author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author></entry></feed>`;
	const [e] = parseArxiv(atom);
	assert.deepEqual(e, { id: "2101.00001v2", title: "A note on the MVT", summary: "We prove things.", authors: ["Ada Lovelace", "Alan Turing"], published: "2021" });
	assert.equal(
		formatCrossref({ DOI: "10.1/x", title: ["Mean Value Theorem"], author: [{ given: "W.", family: "Rudin" }], issued: { "date-parts": [[1976]] }, "container-title": ["Principles"] }),
		"W. Rudin (1976). Mean Value Theorem. Principles. https://doi.org/10.1/x",
	);
	assert.equal(oeisId(45), "A000045");
});

test("local chunks: markdown sections, pdf pages, search and Obsidian citations", () => {
	const md = chunkText("Sources/Notes.md", "# Limiti\nDefinizione di limite con epsilon e delta.\n## Teorema di Lagrange\nSe f è continua in [a,b] e derivabile in (a,b) allora esiste c.");
	assert.equal(md.length, 2);
	const pdf = chunkPdfPages("Sources/Book.pdf", ["Copertina", "", "Teorema di Lagrange: ipotesi di continuità e derivabilità."]);
	assert.deepEqual(pdf.map((c) => c.page), [1, 3]);
	const hits = searchChunks([...md, ...pdf], "teorema di Lagrange derivabile");
	assert.equal(hits[0].heading, "Teorema di Lagrange");
	assert.equal(localCitation(hits[0]), "[[Sources/Notes#Teorema di Lagrange|Notes — Teorema di Lagrange]]");
	assert.equal(localCitation(pdf[1]), "[[Sources/Book.pdf#page=3|Book, p. 3]]");
});

test("loadLocalChunks reads markdown without Python and reports PDFs it cannot read", async () => {
	const vault = mkdtempSync(join(tmpdir(), "lc-src-"));
	mkdirSync(join(vault, "Sources", "Analisi"), { recursive: true });
	writeFileSync(join(vault, "Sources", "README.md"), "# ignored");
	writeFileSync(join(vault, "Sources", "Analisi", "Appunti.md"), "# Derivate\nLa derivata è il limite del rapporto incrementale.");
	writeFileSync(join(vault, "Sources", "Analisi", "Libro.pdf"), "%PDF-1.4 fake");
	const exec = async () => ({ stdout: "", stderr: "", code: 1 });
	const { chunks, warnings } = await loadLocalChunks({ vault, sourcesDir: join(vault, "Sources"), cacheDir: join(vault, ".cache"), exec });
	assert.deepEqual(chunks.map((c) => c.file), ["Sources/Analisi/Appunti.md"]);
	assert.match(warnings[0], /Libro\.pdf: PDF skipped/);
});
