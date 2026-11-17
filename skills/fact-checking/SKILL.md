---
name: fact-checking
description: Verify factual claims (theorem statements and hypotheses, definitions and conventions, physical constants, data, names, dates, history) against the learner's own textbooks and official/reference sources with source_lookup, then cite them in the notes or mark them unverified. Use before writing lessons, solutions, reinforcement notes, or when the learner asks "is this true / where does it come from".
---

# Fact checking

Calculations are verified with `math_check` (skill `math-verification`). Everything else
that could be wrong goes through `source_lookup`. Goal: every statement in a note is either
derived in the note, verified by computation, or backed by a cited source — or clearly
marked as unverified.

## What to check

| Check always | Usually no need |
|---|---|
| Exact statement and **hypotheses** of a theorem (continuity vs differentiability, open vs closed interval, finite vs infinite dimension…) | Steps you derive in the note itself |
| Definitions and **conventions** that vary between books (sign conventions, $\mathbb N$ with or without 0, normalisations, units) | Pure algebra/calculus results (use `math_check`) |
| Physical constants, measured data, numeric facts | Your own analogies and intuitive explanations (they are not claims) |
| Names, dates, who proved what, history anecdotes | |
| Formulas you do not derive (special functions, tables, identities) | |
| Anything you are not sure about, or the learner questions | |
| Programming: syntax, API signatures, default values, error types, behaviour that changed between versions — check the official documentation for the learner's version (`url`), and run it (`code_run`) | |

## Source order (first that answers wins)

1. **Learner's sources** (`source: local`): their textbooks, lecture notes, syllabus in
   the vault Sources folder. Their course's convention is the one to follow.
2. **Official / standard references**:
   - Physical constants → `codata` (NIST CODATA, official values with uncertainty).
   - Special functions, identities, integrals → `dlmf` (NIST DLMF).
   - Integer sequences → `oeis`.
3. **Reference encyclopedias**: `eom` (Encyclopedia of Mathematics, EMS/Springer),
   `wikipedia` (prefer `lang: en`, usually more complete; use the notes language for
   terminology), `nlab` (advanced/abstract math, category theory).
4. **Literature**: `arxiv` (papers, original results), `crossref` (exact bibliographic
   data, DOIs). `url` for a specific official page (university course page, standards body,
   the official documentation of a programming language or library: docs.python.org,
   cppreference.com, docs.oracle.com, developer.mozilla.org, doc.rust-lang.org…).

`source: auto` = learner's sources + Wikipedia. Use specific sources for constants,
special functions and sequences.

## How to check

1. Formulate a precise query (key terms, not the whole sentence).
2. Read the excerpt. The claim is verified only if the excerpt states it **with the same
   hypotheses and conventions**. If it only states something similar, it is not verified.
3. Two independent sources for important or surprising claims (e.g. a theorem's exact
   hypotheses, a historical attribution).
4. **Conflicts**: if sources disagree (often conventions), follow the learner's source,
   mention the alternative in a `[!note]` callout ("Some books define … instead"), and
   never silently mix conventions.
5. Not found / sources unreachable: do not invent a citation. Keep the statement only if
   you are confident, and mark it unverified (below), or rephrase it more carefully.

## Write it in the note

- Footnote right after the statement: `… is continuous on $[a,b]$.[^1]`
- `## Sources` section at the end of the note (heading translated into the notes language)
  with the footnotes, using the citation from `source_lookup`:
  - `[^1]: [[Sources/Analisi 1/Bramanti.pdf#page=212|Bramanti, p. 212]]`
  - `[^2]: "Mean value theorem", Wikipedia (en), https://en.wikipedia.org/wiki/Mean_value_theorem (accessed 2026-11-09)`
- Add the source to the note's `sources:` property (short form: file link or URL).
- Unverified statement:
  ```
  > [!warning] Not verified
  > The attribution of this result to … could not be checked against a reliable source.
  ```
- Never cite a source you did not actually open with `source_lookup` in this workspace.

## In chat

When the learner asks "is this true?" or "where does it come from?", answer with the
evidence: short quote/paraphrase, source, link. If the learner's book says something
different from what you said, the book wins: correct the note (and say so).
