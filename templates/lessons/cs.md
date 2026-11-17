---
type: lesson
kind: cs
subject: "{{subject}}"
topic: "{{topic}}"
subjects: [{{subjectsList}}]
lesson: {{n}}
block: "{{block}}"
difficulty: {{difficulty}}
status: in-progress
revision: 1
language: "{{language}}"
concepts: [{{concepts}}]
prerequisites: [{{prerequisites}}]
sources: []
created: {{date}}
updated: {{date}}
tags: [learning/lesson, {{subjectTags}}, {{topicTag}}]
---

# {{title}}

> [!abstract] In one sentence
> The idea of the algorithm or structure, in plain words.
>
> *Question of the lesson:* the problem it solves, and how well.

<!--
KIND: COMPUTER SCIENCE (theory). Shared layout rules: skill lesson-writing. Remove these comments.
- Order: problem → definitions → algorithm/structure (idea, pseudocode, trace) → correctness →
  cost → implementation.
- [!info] holds ONLY formal definitions (problem specification input/output, data type,
  model of computation), the official pseudocode, correctness theorems and complexity
  results, cited (textbook first: CLRS, Sedgewick, Sipser… or the learner's course).
- Pseudocode in a [!info] box as a fenced block ```text; real code in fenced blocks with
  the language tag. The reference implementation is in the language chosen for the subject
  (Python if none), saved in the lesson's code/ folder with its tests and RUN with code_run.
- Traces: a table of the state after each step on a small input, produced by running the code.
- Cost: derive it (recurrence → solution checked with math_check); when useful, confirm the
  growth by timing on increasing inputs with code_run.
- Quizzes: "trace this on…", "what is the complexity and why", "find the invariant",
  "which input is the worst case", "modify the algorithm so that…".
- Flashcards: invariants, complexity with its reason, when to prefer which structure.
-->

## 1. The problem

### 1.1 A concrete task

<!-- e.g. find a name among 1 million sorted names; the learner should feel the size. -->

### 1.2 Why the obvious way fails

<!-- The naive approach and its cost, with real numbers. -->

### 1.3 The key idea

## 2. Definitions

> [!info] Definition — problem / data type
> Formal specification: input, output, properties.[^1]

## 3. The algorithm

### 3.1 The idea

<!-- In words and with a picture (diagram, Mermaid or plot). -->

### 3.2 Pseudocode

> [!info] Algorithm — name
> ```text
> pseudocode as in the reference textbook
> ```

### 3.3 Trace on a small input

| Step | State | Note |
|---|---|---|
| | | |

## 4. Correctness

> [!info] Theorem — correctness
> Statement (loop invariant, or what the algorithm guarantees).

> [!note]- Proof
> Invariant: initialization, maintenance, termination (or induction).

> [!warning] Trap — name
> Off-by-one, empty input, duplicates, overflow… and how to catch it.

## 5. Cost

### 5.1 Time and space

<!-- Derivation (counting or recurrence), best/worst/average case. -->

### 5.2 Comparison

| Approach | Time | Space | When to prefer it |
|---|---|---|---|
| | | | |

## 6. Implementation

<!-- Reference code (fenced, language tag), run with code_run together with its tests;
     paste the real output. Files in the lesson's code/ folder. -->

## 7. Worked example

## 8. Check your reasoning

> [!question]- Question 1 — trace / complexity / invariant question?
> Answer with the reason.

## 9. Recap

### 9.1 Key ideas

### 9.2 How to remember it

## 10. Connections

- Builds on:
- Leads to:
- Flashcards: <!-- only when enabled -->

## Sources

<!-- Footnotes for checked facts (skill fact-checking): learner's books first. -->

[^1]: Author or site, *Title*, page or section, URL (accessed YYYY-MM-DD)
