---
name: lesson-writing
description: Write and guide one lesson - numbered sections grouped by kind of content, each concept intuition first then its formal official statement in a box, worked example, verified math, visuals, guided check questions - saved as a lesson note. Use when starting or resuming a lesson of the study plan, or on /lesson.
---

# Lesson

## Prepare

1. `learning_state` overview → pick the lesson (argument, the in-progress one, or the
   next planned). Get its paths with action `paths` and `lesson`; it also returns the
   template values (tags, flashcard deck, date) to put in the frontmatter verbatim.
2. Set it `in-progress` (`set_lesson_status`).
3. Re-read the Learning Style summary in `<learning_context>` and the lesson's
   prerequisites; skim the previous lesson note to connect to it.
4. Plan the logical thread: the question → the concepts in order → for each concept the
   intuition and its formal statement. Group the concepts by kind (motivation, methods,
   properties, applications…): each group becomes a numbered section.

## Write the note

Use the template of the lesson KIND (path in `learning_state` paths and in
`<learning_context>`: math, physics, cs, programming, generic or a custom kind of the vault)
and the note-app skill (`notes-obsidian` or `notes-adapter`). The template's comment block
lists the kind's sections, what its formal boxes hold, how to check the content (math_check,
code_run, units…) and the quiz and flashcard style: follow it, then delete the comments.
The rules below hold for every kind. Write in the notes language; translate headings; for
programming and cs, code is in the subject's language (`language` property).

### Layout rules

- **Organise by concept, not by kind of text.** Each concept is explained once, in one
  place: intuition → formal box → folded proof → short example → its trap. Never split a
  concept into separate "why / what / key ideas" places across the note.
- **Numbered headings, dotted notation:** `## 1. Title`, `### 1.1 Title`,
  `#### 1.1.1 Title`, numbered in order without gaps. Back matter (Sources) is not
  numbered. Refer to sections as "§2.3". When a section is added or removed, renumber.
- **Group headings that say what you are reading.** Each H2 names the kind of content in
  plain words, so the learner knows at a glance what follows: "Why factor", "Factoring
  methods", "Properties of the limit", "Worked example", "Recap". Never bare category
  words like "What" or "When". H3 = one concept, named by its content ("The factor
  theorem", not "Tool 3").
- **One blank line after every heading.**
- **Boxes have fixed meanings** (see the template): `[!info]` holds ONLY the formal,
  official statement of a definition, theorem, property, law, identity or algorithm — as
  a textbook would state it, with hypotheses and quantifiers, in LaTeX, cited (skill
  `fact-checking`, the learner's textbook first). EVERY concept the lesson teaches gets
  one, including "small" ones (a law like the zero-product property, an identity, the
  steps of an algorithm). Readings of symbols, intuition, comments and examples go
  OUTSIDE the box. `[!note]-` proofs, `[!warning]` traps right after their concept,
  `[!question]-` check questions with the answer inside, one `[!abstract]` at the top.
- **At most one bold phrase per paragraph** (the key term where it is introduced).

### Sections (math kind; other kinds: see their template)

1. **In one sentence** (`[!abstract]`) — the core idea in plain words, plus the question
   of the lesson.
2. **1. Why <concept>** — a concrete problem where the idea is needed (from the learner's
   background or goals), when it is needed and the signals that call for it, and the key
   mechanism with its formal box.
3. **2., 3., … Content groups** — one H2 per group of concepts, one H3 per concept, in
   the order they are used or from simplest to most powerful. Derive each step from the
   previous one; no "it can be shown". Use the approach that works for this learner (style
   summary); one visual where it helps (skill `visuals`). If a group is a procedure, open it
   with a short ordered list pointing to its subsections.
4. **Worked example** — fully reasoned, step labels in bold ("**Step 1 — …**"), ending
   with a check. Verify every number and step with `math_check` first (skill
   `math-verification`). Check the facts too (skill `fact-checking`): exact statements and
   hypotheses, definitions/conventions (the learner's textbook first), constants, names and
   dates. Cite them with footnotes; mark anything unverifiable.
5. **Check your reasoning** — 2–3 why/what-if questions, answers folded.
6. **Recap** — `5.1 Key ideas` (3–5 bullets to reconstruct, not memorise) and
   `5.2 How to remember it` (2–4 verified memory aids as plain bullets, skill
   `memory-aids`: 30-second rebuild, sanity check, pattern or visual anchor, link to a known
   result; mnemonics only for pure conventions).
7. **Connections** — links to prerequisite lessons and the next lesson.
8. **Sources** (not numbered) — the footnotes, also listed in the `sources:` property.

### Flashcards (only if enabled in `<learning_context>`)

Not in the lesson. Append a section `## N. Lesson title` (N = lesson number) to the
topic's Flashcards note (path from `learning_state` paths): a link back to the lesson, then
3–6 cards, each under its own `### N.k Short topic` heading, in the multi-line format
(question / `?` / answer) described in `notes-obsidian`. Cards require reasoning; 1–2 of
them train a memory aid ("How do you rebuild…?", "How do you check…?"). In the lesson's
Connections, link the section (`[[…/Flashcards#N. Lesson title|Flashcards]]`). Update the
section when the lesson is reformulated, keeping the plugin's `<!--SR:…-->` lines.

Concise: a lesson note should be readable in 10–15 minutes. Prefer splitting over bloating.

## Guide (chat)

1. Present the lesson in chat as a short guided walk: the why, the key step, the
   definition — 6–12 lines, then the note path. Do not paste the whole note.
2. Ask 1–2 guided check questions (`quiz_ask`, mode `guided`, with 2–3 progressive
   hints and askWhy). Evaluate the reasoning, not just the result; give feedback that
   points to the exact step, in a turn of its own: end it with the next steps as a short
   numbered list in plain text, never with a dialog (persona principle 13). To chain the
   next question right away, put a one-line verdict in its `preface` instead. Guided
   answers are NOT recorded as attempts, but if they
   reveal a misunderstanding, address it now (short re-explanation) and note it with
   `learner_profile` observe.
3. Invite questions. Answer them concisely; if an answer adds real value, add it to the
   note where it belongs (inside the concept's section, renumbering if you add one).
4. If the learner says a part of the note is unclear → skill `reformulation`.

## Close

1. When the learner is satisfied: `set_lesson_status` → `done`. The tool says whether it
   closes a block (then suggest a checkpoint quiz/exercises).
2. Record style evidence with `learner_profile` observe (what clicked, what did not).
3. Offer: next lesson, checkpoint, or stop (with a 2-line recap).
