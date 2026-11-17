---
name: notes-obsidian
description: Obsidian Flavored Markdown rules for learning notes - vault layout, frontmatter properties, wikilinks and embeds, callouts, LaTeX/MathJax pitfalls, flashcards (Spaced Repetition plugin), Dataview-friendly metadata. Read before writing or editing any note in an Obsidian vault.
---

# Writing notes for Obsidian

## Layout (never improvise paths)

```
<Vault>/<Subject>/<Subject>.md                     subject index: syllabus, topic map, exam (folder note)
<Vault>/<Subject>/Exams/Exam - Final - N.md        final exams of the subject
<Vault>/<Subject>/NN - <Topic>/NN - <Topic>.md     topic index (folder note); NN = syllabus order
<Vault>/<Subject>/NN - <Topic>/Study Plan.md
<Vault>/<Subject>/NN - <Topic>/Flashcards.md        flashcards of the topic (when enabled), one section per lesson
<Vault>/<Subject>/NN - <Topic>/Lessons/NN - Title/NN - Title.md
<Vault>/<Subject>/NN - <Topic>/Lessons/NN - Title/Reinforcement - Concept.md
<Vault>/<Subject>/NN - <Topic>/Lessons/NN - Title/media/…   (png, svg, mp4)
<Vault>/<Subject>/NN - <Topic>/Quizzes|Tests|Exercises/…
<Vault>/00 Learner/Profile.md | Learning Style.md | Dashboard.md
<Vault>/Sources/…                                  learner's textbooks, course notes, syllabi (PDF/Markdown)
```

Always get paths from `learning_state` (action `paths`). Topic folders are numbered by
the plugin in syllabus order and renumbered (with links updated) when the syllabus changes:
never create, rename or number topic folders yourself. Tools take the topic NAME (without
the number). File names must not contain
`\ / : * ? " < > | # ^ [ ]`.

A topic lives in ONE subject folder (its home). Other subjects that use it link to it:
its notes carry `subjects: ["Home", "Other"]` and one `subject/…` tag per subject, so
Dataview and search find it from every subject. Never copy a topic into another folder.

## Properties (YAML frontmatter)

- Fill every `{{placeholder}}` of a template with the "Template values" returned by
  `learning_state` paths (tags like `subject/…`, `topic/…`); never leave `{{…}}` in a note.
- First thing in the file, between `---` lines. Keep every property of the template:
  `type`, `subject`, `topic`, `lesson`, `status`, `created`, `updated`, `tags`… Dataview
  dashboards depend on them.
- Dates `YYYY-MM-DD`. Quote strings containing `:` or `#`. Tags without `#` in YAML.
- On every edit, set `updated` to today. Lesson rewrites: `revision` + 1.
- Never write `<!-- lc:…:begin/end -->` sections by hand: the extension regenerates them.

## Links and embeds

- Link with vault-relative paths and an alias: `[[Math/Linear Algebra/Lessons/02 - Dot product/02 - Dot product|Dot product]]`.
  The `.md` extension is omitted. Section links: `[[note#Heading]]`.
- Embed media: `![[Math/…/media/projection.mp4]]`, images with width: `![[…/plot.png|600]]`.
- Inside Markdown tables escape the alias pipe: `[[path\|alias]]` (a bare `|` splits the cell).
- Never use relative `../` markdown links.

## Callouts

```
> [!info] Definition — Dot product
> For $\vb a, \vb b \in \R^n$: $\vb a \cdot \vb b = \sum_{i=1}^n a_i b_i$.
```

Each type has ONE meaning, so the colour tells the learner what they are reading:

| Callout | Only for |
|---|---|
| `[!info]` | the formal, official statement of a definition, theorem, property, law, identity or algorithm (hypotheses, quantifiers, LaTeX, citation) — nothing else inside |
| `[!note]-` | proof or derivation (folded) |
| `[!warning]` | a trap, right after its concept |
| `[!question]-` | check question in the title, answer inside (folded) |
| `[!abstract]` | the one-sentence summary at the top of a lesson |
| `[!failure]` | what went wrong (reinforcement notes) |
| `[!example]` | an example only when it must stand apart from the text (e.g. in a long section) |

Do not use `tip`, `success` or `check` in lessons. Add `-` to fold, `+` for
open-but-foldable. Every line inside a callout starts with `> `, including blank lines
(`>`) and `$$` lines.

## LaTeX (MathJax)

- Inline `$…$` with no space right after the opening or before the closing `$`
  (`$x^2$`, not `$ x^2 $`). Display math: `$$` on its own line, content, `$$` on its own line.
- Never `\(...\)` or `\[...\]`.
- Multi-line: `$$\begin{aligned} a &= b \\ &= c \end{aligned}$$`. Use `aligned`, `cases`,
  `pmatrix`, `bmatrix`. Number with `\tag{1}` only when referenced.
- Inside tables, `|` breaks the cell: use `\vert`, `\lvert…\rvert` or `\mid`, and `\Vert` instead of `\|`.
- A literal dollar sign in text: `\$`.
- Macros from `preamble.sty` (vault root, Extended MathJax plugin): `\R \C \N \Z \Q \dd
  \abs{} \norm{} \inner{}{} \pdv{}{} \dv{}{} \vb{} \uv{}`. Use only these or standard
  MathJax. To add a macro, append it to `preamble.sty` and tell the learner to reload.
- Units: `\,\mathrm{m/s}`; vectors bold `\vb v` (consistent per topic).

## Flashcards (Spaced Repetition plugin; only when enabled)

In the topic's `Flashcards.md` (path from `learning_state` paths; created with the deck
tag line), never in lessons. One `##` section per lesson numbered with the LESSON number,
one `###` heading per card numbered inside it, every card in the multi-line format:

```
## 2. Dot product

Lesson: [[Math/Linear Algebra/Lessons/02 - Dot product/02 - Dot product|02 - Dot product]]

### 2.1 Perpendicular vectors

Why is $\vb a\cdot\vb b = 0$ when $\vb a \perp \vb b$?
?
Because the projection of one on the other has length $0$: $\cos 90^\circ = 0$.

### 2.2 Sign of the dot product

What does the sign of $\vb a\cdot\vb b$ tell you about the angle?
?
Acute if positive, right if zero, obtuse if negative: the sign is the sign of $\cos\theta$.
```

How the plugin reads it (do not break these):
- A card = question lines, a line with only `?`, answer lines; it ends at the first blank
  line. So no blank lines inside a card; keep answers to 1–3 lines (a `$$` block is fine if
  it has no blank line).
- Never use `::` (one-line cards are unreadable in the note) and never `==highlights==`:
  the plugin turns highlights into cloze cards.
- The card heading is shown as context during review: name the topic, never the answer
  ("Sign of the dot product", not "Positive means acute").
- Never delete or move the `<!--SR:…-->` lines (or `> [!sr|card-metadata]` callouts) the
  plugin writes under a card: they hold its review history. When rewriting a card, keep
  its line right under the answer.

Prefer cards that ask WHY or WHEN, not definitions to recite, and cards that train a
memory aid ("How do you rebuild …?", "How do you check …?"). The note check flags `::`,
highlights, cards without their own heading, and numbering gaps.

## Automatic check

After every `write`/`edit` of a note the plugin checks it and appends a **Note check**
report to the tool result (broken YAML, math delimiters, callout `>` prefixes, table pipes,
missing links/embeds, placeholders, footnotes, code fences, generated markers).
- Fix every **error** immediately with `edit`, then continue.
- **Warnings**: fix them when they are real mistakes. A link to a lesson that is planned but
  not written yet is fine.
- After large changes (a reformulation, a batch of notes), run `note_check` on the topic
  folder.

## Other blocks

- Code: fenced blocks with the language tag (```python, ```cpp, ```sql…); program output
  in a ```text block right after it. Obsidian does not render code files, so the note always
  shows the code inline; runnable copies (programs, exercises with tests) go in the
  lesson's `code/` folder (path from `learning_state` paths), mentioned in the note with
  their path in inline code (e.g. `code/csv_average.py`).
- Mermaid (built in), `desmos-graph`, `tikz`, `dataview`: see skill `visuals`.
- Highlights `==text==`, comments `%% hidden %%`.
- Citations: footnotes `[^1]` right after the claim, defined in the `## Sources` section;
  PDF sources link to the page: `[[Sources/Book.pdf#page=42|Book, p. 42]]`. Keep the
  `sources:` property in sync (skill `fact-checking`).
- Headings: one `#` title equal to the note name; sections `##`; never skip levels;
  one blank line after every heading. Lessons and reinforcement notes number their
  sections in dotted notation (`## 1. Title`, `### 1.1 Title`), back matter (Sources)
  unnumbered — the note check reports gaps or repeats in the numbering.
