import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVaultIndex, lintNote, resolveLink } from "../extensions/lib/lint.ts";

const index = buildVaultIndex([
	"Analisi 1/Derivate/Lessons/01 - Rapporto incrementale/01 - Rapporto incrementale.md",
	"Analisi 1/Derivate/Lessons/02 - Teorema di Lagrange/02 - Teorema di Lagrange.md",
	"Analisi 1/Derivate/Lessons/02 - Teorema di Lagrange/media/secante.png",
	"Sources/Analisi 1/Bramanti.pdf",
	"00 Learner/Dashboard.md",
]);

const GOOD = `---
type: lesson
subject: "Analisi 1"
topic: "Derivate"
subjects: ["Analisi 1", "Fisica 1"]
lesson: 2
block: "Teoremi"
difficulty: 3
status: in-progress
revision: 1
concepts: [teorema di Lagrange, punto medio]
sources: ["[[Sources/Analisi 1/Bramanti.pdf#page=212|Bramanti, p. 212]]"]
created: 2026-11-09
updated: 2026-11-09
tags: [learning/lesson, subject/analisi-1, topic/derivate]
---

# 02 - Teorema di Lagrange

> [!abstract] In una frase
> Su un intervallo, la pendenza media è raggiunta da una tangente.

## 1. Il teorema

### 1.1 Enunciato

> [!info] Teorema — Lagrange
> Se $f$ è continua su $[a,b]$ e derivabile su $(a,b)$,[^1] allora esiste $c\\in(a,b)$ con
> $$
> f'(c)=\\frac{f(b)-f(a)}{b-a}.
> $$

$$
\\begin{aligned}
g(x) &= f(x) - \\frac{f(b)-f(a)}{b-a}(x-a) \\\\[2pt]
g(a) &= g(b)
\\end{aligned}
$$

Costa \\$5 il libro, e $x^{{n}}$ resta LaTeX valido. Vedi [[01 - Rapporto incrementale|lezione 1]] e [[Analisi 1/Derivate/Lessons/02 - Teorema di Lagrange/02 - Teorema di Lagrange#1. Il teorema|sopra]].

![[Analisi 1/Derivate/Lessons/02 - Teorema di Lagrange/media/secante.png|500]]

| # | Lezione | Stato |
|---|---|---|
| 1 | [[01 - Rapporto incrementale\\|Rapporto incrementale]] | ✅ |

\`\`\`python
price = "$5" # {{not a placeholder}} \\(fine\\)
\`\`\`

\`\`\`dataview
LIST FROM "Analisi 1" WHERE type = "lesson"
\`\`\`

%% nota interna {{x}} %%

## 2. Conseguenze

### 2.1 Funzioni a derivata nulla

## Sources

[^1]: [[Sources/Analisi 1/Bramanti.pdf#page=212|Bramanti, p. 212]]
`;

test("a well-formed lesson produces no issues", () => {
	const issues = lintNote(GOOD, { index });
	assert.deepEqual(issues, [], issues.map((i) => `${i.line} ${i.rule} ${i.message}`).join("\n"));
});

const BAD = `---
type: lesson
subject: Analisi 1: limiti
topic: "Derivate
tags: [learning/lesson, #derivate
lesson: {{n}}
lesson: 3
---

# Titolo
# Secondo titolo

> [!definition] Derivata
> La derivata è
$$
f'(x)
$$

Testo con $ x^2 $ e \\(a+b\\) e $a+b senza chiusura.

| a | [[01 - Rapporto incrementale|uno]] |
|---|---|

Vedi [[Lezione che non esiste]] e ![[media/manca.png]] e [link](../altro.md).

Valore: {{concept}}. Citazione[^2].

<!-- lc:lessons:begin -->

\`\`\`python
non chiuso
`;

test("a broken note triggers every rule", () => {
	const issues = lintNote(BAD, { index });
	const rules = (rule: string) => issues.filter((i) => i.rule === rule).map((i) => i.message);
	assert.ok(rules("frontmatter").some((m) => m.includes('": "')), "unquoted colon");
	assert.ok(rules("frontmatter").some((m) => m.includes("not closed with \"")), "open quote");
	assert.ok(rules("frontmatter").some((m) => m.includes("list not closed")), "open list");
	assert.ok(rules("frontmatter").some((m) => m.includes("Duplicate property `lesson`")), "duplicate");
	assert.ok(rules("frontmatter").some((m) => m.includes("Missing property `status`")), "required");
	assert.ok(rules("placeholder").some((m) => m.includes("{{n}}")), "frontmatter placeholder");
	assert.ok(rules("placeholder").some((m) => m.includes("{{concept}}")), "body placeholder");
	assert.ok(rules("heading").filter((m) => m.includes("top-level")).length === 1, "two H1");
	assert.ok(rules("callout").some((m) => m.includes("Unknown callout type")), "unknown callout");
	assert.ok(issues.some((i) => i.rule === "callout" && i.severity === "error"), "$$ escaping the callout");
	assert.ok(rules("math").some((m) => m.includes("space next to")), "spaced inline math");
	assert.ok(rules("math").some((m) => m.includes("\\(")), "\\( math");
	assert.ok(rules("math").some((m) => m.includes("Unbalanced `$`")), "unclosed inline math");
	assert.ok(rules("table").length === 1, "unescaped pipe in table");
	assert.ok(issues.some((i) => i.rule === "link" && i.severity === "warning" && i.message.includes("Lezione che non esiste")), "missing note link");
	assert.ok(issues.some((i) => i.rule === "link" && i.severity === "error" && i.message.includes("manca.png")), "missing embed");
	assert.ok(rules("link").some((m) => m.includes("../")), "relative link");
	assert.ok(rules("footnote").some((m) => m.includes("[^2]")), "undefined footnote");
	assert.ok(rules("generated").length === 1, "broken generated markers");
	assert.ok(rules("code").length === 1, "unclosed code fence");
});

const lesson = (body: string) => `---\ntype: lesson\nsubject: "A"\ntopic: "T"\nstatus: in-progress\ntags: [learning/lesson]\n---\n\n# 01 - L\n\n${body}`;
const numbering = (body: string) =>
	lintNote(lesson(body))
		.filter((i) => i.rule === "numbering" || i.rule === "heading")
		.map((i) => `${i.rule}: ${i.message}`);

test("headings need a blank line after them", () => {
	assert.deepEqual(numbering("## 1. A\nText.\n\n## 2. B\n\nText.\n"), ["heading: Heading `1. A` is not followed by a blank line: add one."]);
	// Any note, not only lessons.
	assert.equal(lintNote("# T\n\n## Notes\n- x\n").filter((i) => i.rule === "heading").length, 1);
});

test("dotted numbering: correct layouts pass, gaps, repeats, wrong parents and back matter are reported", () => {
	const ok = "## 1. A\n\n### 1.1 a\n\n#### 1.1.1 x\n\n### 1.2 b\n\n## 2. B\n\n### 2.1 c\n\n## Fonti\n\n## Flashcard\n\n### Sub of back matter\n\n";
	assert.deepEqual(numbering(ok), []);
	assert.deepEqual(numbering("## 1. A\n\n## 3. C\n\n## 4. D\n\n"), ["numbering: Heading `3. C`: expected number `2` (dotted numbering in order, matching the parent section)."]);
	assert.deepEqual(numbering("## 1. A\n\n### 2.1 a\n\n### 2.2 b\n\n"), ["numbering: Heading `2.1 a`: expected number `1.1` (dotted numbering in order, matching the parent section)."]);
	assert.deepEqual(numbering("## 1. A\n\n### 1.1 a\n\n### 1.1 b\n\n"), ["numbering: Heading `1.1 b`: expected number `1.2` (dotted numbering in order, matching the parent section)."]);
	assert.deepEqual(numbering("## 1. A\n\n### Unnumbered\n\n"), ["numbering: Heading `Unnumbered` has no number: expected `1.1`."]);
	assert.deepEqual(numbering("## Intro\n\n## 1. A\n\n"), ["numbering: Unnumbered section `Intro` before numbered ones: number it, or move it to the end (back matter)."]);
	assert.equal(numbering("## Perché\n\n## Cosa\n\n## Fonti\n\n")[0], "numbering: Sections are not numbered: use dotted notation (`## 1. Title`, `### 1.1 Title`); back matter like Sources stays unnumbered.");
	// Only lessons and reinforcement notes are numbered.
	assert.deepEqual(lintNote("---\ntype: topic\n---\n\n# T\n\n## Subjects\n\n## Lessons\n\n").filter((i) => i.rule === "numbering"), []);
});

test("flashcards notes: multi-line cards under their own heading, no one-liners or highlights", () => {
	const note = (body: string) => `---\ntype: flashcards\nsubject: "A"\ntopic: "T"\ntags: [learning/flashcards]\n---\n\n# Flashcards — T\n\n#flashcards/a/t\n\n${body}`;
	const rules = (body: string) => lintNote(note(body)).map((i) => `${i.rule}: ${i.message.split(":")[0]}`);
	const good = "## 1. Lezione\n\nLezione: [[x|y]]\n\n### 1.1 Zeri\n\nPerché?\n?\nPerché sì, $a=b$.\n<!--SR:!2026-11-12,3,250-->\n\n### 1.2 Fattori\n\nDomanda su\ndue righe?\n?\nRisposta.\n\n## 3. Lezione tre\n\n### 3.1 Altro\n\nQ?\n?\nA.\n";
	assert.deepEqual(rules(good), [], "lesson numbers may skip (lesson 2 without cards)");
	assert.deepEqual(rules("## 1. L\n\n### 1.1 A\n\nDomanda?::Risposta\n"), ["flashcard: One-line card (`"]);
	assert.deepEqual(rules("## 1. L\n\n### 1.1 A\n\nQ?\n?\nLa ==chiave== è qui.\n"), ["flashcard: Highlight `==…==` in a flashcards note"]);
	assert.deepEqual(rules("## 1. L\n\n### 1.1 A\n\nQ1?\n?\nA1.\n\nQ2?\n?\nA2.\n"), ["flashcard: Card without its own heading"]);
	assert.deepEqual(rules("## 1. L\n\n### 1.2 A\n\nQ?\n?\nA.\n"), ["numbering: Heading `1.2 A`"]);
});

test("cs/programming lessons: every code block needs a language tag", () => {
	const note = (kind: string) => `---\ntype: lesson\nkind: ${kind}\nsubject: "A"\ntopic: "T"\nstatus: in-progress\ntags: [learning/lesson]\n---\n\n# 01 - L\n\n## 1. A\n\n\`\`\`python\nprint(1)\n\`\`\`\n\n\`\`\`\n1\n\`\`\`\n\n> [!info] Algorithm\n> \`\`\`text\n> x\n> \`\`\`\n`;
	const code = (kind: string) => lintNote(note(kind)).filter((i) => i.rule === "code");
	assert.equal(code("programming").length, 1);
	assert.equal(code("programming")[0].line, 18);
	assert.equal(code("cs").length, 1);
	assert.equal(code("math").length, 0);
});

test("link resolution follows Obsidian rules (path or unique name, any case)", () => {
	assert.equal(resolveLink("02 - teorema di lagrange", index), true);
	assert.equal(resolveLink("Analisi 1/Derivate/Lessons/01 - Rapporto incrementale/01 - Rapporto incrementale.md", index), true);
	assert.equal(resolveLink("secante.png", index), true);
	assert.equal(resolveLink("Sources/Analisi 1/Bramanti.pdf", index), true);
	assert.equal(resolveLink("Dashboard", index), true);
	assert.equal(resolveLink("Nope", index), false);
	assert.equal(resolveLink("nope.png", index), false);
});

test("notes without frontmatter or index are still checked safely", () => {
	assert.deepEqual(lintNote("# Hello\n\nPlain text with $x$.\n"), []);
	assert.equal(lintNote("---\ntype: lesson\n# never closed\n")[0].message, "Frontmatter is not closed with a `---` line.");
});
