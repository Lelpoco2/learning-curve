---
type: lesson
kind: physics
subject: "{{subject}}"
topic: "{{topic}}"
subjects: [{{subjectsList}}]
lesson: {{n}}
block: "{{block}}"
difficulty: {{difficulty}}
status: in-progress
revision: 1
concepts: [{{concepts}}]
prerequisites: [{{prerequisites}}]
sources: []
created: {{date}}
updated: {{date}}
tags: [learning/lesson, {{subjectTags}}, {{topicTag}}]
---

# {{title}}

> [!abstract] In one sentence
> The physical idea of this lesson, in plain words.
>
> *Question of the lesson:* what we want to predict or explain.

<!--
KIND: PHYSICS. Shared layout rules: skill lesson-writing. Remove these comments.
- Order: phenomenon → model (assumptions, quantities) → laws → solving problems → limits.
- [!info] holds ONLY laws, principles and definitions in the official form, WITH the conditions
  under which they hold (frame, regime, approximations) and the SI units, cited.
- Every formula: dimensional check. Every number: units at every step, symbolic solution
  first and numbers last, a sanity check (limit case, order of magnitude). Verify with
  math_check (sympy.physics.units for dimensions); constants from CODATA via source_lookup.
- Visuals: free-body/field diagrams (TikZ or plot_render), Manim for motion and time evolution.
- Quizzes: estimates (orders of magnitude), problems with units, "what changes if…",
  conceptual traps (mass vs weight, velocity vs acceleration).
- Flashcards: "which assumption…", "what happens if…", "order of magnitude of…".
-->

## 1. The phenomenon

### 1.1 What we observe

<!-- A real situation or a simple experiment the learner can picture or try. -->

### 1.2 The question

<!-- What we want to predict, and where it matters (technology, nature, other subjects). -->

## 2. The model

### 2.1 Assumptions

<!-- The idealizations (point mass, rigid body, no friction, small angles…) and why they are
     allowed here: what would change without them. -->

### 2.2 Quantities and units

| Symbol | Meaning | SI unit | Typical value |
|---|---|---|---|
| | | | |

## 3. The laws

### 3.1 <Law or principle>

<!-- Intuition first (experiment, picture, limiting case). -->

> [!info] Law — name
> Official statement and formula, with the conditions under which it holds.[^1]

> [!note]- Where it comes from (derivation)
> Derivation or experimental basis, each step justified.

<!-- Dimensional check of the formula, in one line. -->

> [!warning] Trap — name
> The typical misconception and how to catch it.

## 4. Solving problems

### 4.1 Method

<!-- The steps for this kind of problem: diagram → axes/reference frame → equations →
     symbolic solution → numbers last → check. -->

### 4.2 Worked problem

<!-- "**Step 1 — …**" with units in every line, verified with math_check; ends with the
     sanity checks (dimensions, a limit case, order of magnitude). -->

## 5. Limits of the model

<!-- When the model stops working (speeds, sizes, energies, friction…) and what replaces it. -->

## 6. Check your reasoning

> [!question]- Question 1 — what-if or estimate question?
> Answer with the reason (and the estimate's steps).

## 7. Recap

### 7.1 Key ideas

### 7.2 How to remember it

<!-- Plain bullets (skill memory-aids): rebuild from a principle, dimensional check, limit case. -->

## 8. Connections

- Builds on:
- Leads to:
- Flashcards: <!-- only when enabled -->

## Sources

<!-- Footnotes for checked facts (skill fact-checking): learner's books first. -->

[^1]: Author or site, *Title*, page or section, URL (accessed YYYY-MM-DD)
