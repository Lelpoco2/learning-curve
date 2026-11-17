---
name: quiz-and-exercises
description: Create, run and grade quizzes, block/topic tests, exercise sets and subject final exams - first questions guided with hints, then independent; answers in chat or written in the note; reasoning required; math verified; results recorded with gaps. Use on /quiz, /test, /exercises, /exam, /grade or at a checkpoint.
---

# Quizzes, tests and exercises

## Kinds

| Kind | When | Size | Folder |
|---|---|---|---|
| quiz | after a lesson or block | 4–8 questions | Quizzes |
| test | end of block (optional) or end of topic (required) | 8–15 questions | Tests |
| exercises | practice, computational blocks | 4–10 exercises | Exercises |
| retest | after reinforcement, only on gap concepts | 1–3 per gap | Quizzes |
| exam | end of a subject, when every topic is done | 12–20 questions across all topics | `<Subject>/Exams` |

## Design

1. Scope: the lesson/block/topic concepts (`learning_state` overview). Cover every
   concept at least once; weight weak ones (knowledge map, open gaps).
2. Mix question types by topic: conceptual why, recognise-when-to-use, computation,
   interpretation of a result, error spotting ("this solution is wrong, where?"),
   short proof or derivation, estimation / order of magnitude (physics). Follow the quiz
   style of the lesson kind (its template's comment block):
   - physics: estimates, problems with units, "what changes if…";
   - cs: "trace this on…", complexity with the reason, find the invariant, worst-case input;
   - programming: "predict the output", "find the bug", "which error and why", and
     coding tasks ("write a function that passes these tests") in the subject's language.
3. Increasing difficulty. The FIRST 1–2 questions are GUIDED (hints available,
   excluded from the score); all others are independent.
4. Every question requires reasoning: ask "why" explicitly or include it in the task.
5. Solve every question yourself first and verify with `math_check` (`code_run` for code:
   run your solution and the expected outputs); check any factual
   content of questions and solutions with `source_lookup` (skill `fact-checking`).
   Keep the solutions for grading; never show them before the learner answers.
6. When a learner's answer follows a different but legitimate convention or definition
   (e.g. from their textbook), check it in their sources before marking it wrong.

## Write the note

1. Get the path: `learning_state` paths with `kind` and `scope` (attempt number is
   computed). Use `quiz.md` or `exercises.md` from the templates directory.
2. Quizzes/tests: write questions WITHOUT solutions (solutions are added after grading).
   Mark guided questions. Exercises: hints and solutions folded (`[!tip]-`, `[!success]-`).

## Run (chat, default)

1. Ask the learner how they prefer to answer: here in pi, or writing in the note and
   then `/grade`.
2. In pi: `quiz_ask` — guided questions in mode `guided` with 2–3 progressive hints;
   then ALL independent questions in ONE `quiz_ask` call (mode `independent`), so the
   learner gets the review screen before submitting: they can reopen any question and
   change the answer or the "why". askWhy true unless the question already demands the
   reasoning. (Exams: split into a few calls of ~8 only if very long.)
3. Feedback at the end of the call by default; if the learner prefers feedback after each
   question, ask one question per call (no review then). Point to the exact step that was
   right/wrong. Do not lecture. Give the feedback in a turn without dialogs and end it
   with the next steps in plain text (persona principle 13); when you chain questions,
   put a one-line verdict in the next call's `preface`.
4. Answers changed during the review are reported with the first answer. Grade the final
   answer, but use the change in the feedback: a correct change shows self-correction
   (say so); a change from right to wrong, or back and forth, shows uncertainty on that
   concept — note it in `error` and address it, even if the final answer is right.

## Grade

For each question decide: `correct` yes/partial/no, `reasoning`
sound/partial/flawed/missing/n-a, and a short `error` description when wrong. A right
result with flawed reasoning is a gap. Verify numeric answers with `math_check`
(equivalent forms, rounding, units). Code answers: RUN the learner's code with `code_run`
against the tests (plus edge cases they did not see) before grading; a program that passes
with a wrong idea, or fails for a trivial typo, is graded on the reasoning (`partial`), and
the real output or error message goes in the feedback.

Then:
1. `quiz_record` (kind, scope, lesson, note path, one entry per question; guided flag on
   guided questions). It returns score, pass/fail and new gaps with reinforcement paths.
2. Write the Results section in the note: score, per-question feedback, folded
   solutions, gaps opened. (The tool already set `score`/`passed` properties.)
3. Tell the learner: score vs threshold, what was strong, which gaps opened.
4. EVERY gap → skill `reinforcement` (even if the quiz is passed). Passing alone is not
   enough: mastery = passed AND no open gaps.
5. Not passed (< threshold): after reinforcement, offer a new attempt of the same scope
   with NEW questions (never repeat the same ones).

## Final exam (subject)

- Due when every topic of the subject is done (`learning_state` overview says
  "FINAL EXAM DUE"). Ask before starting: it is long; it can be split across sessions
  (answers are saved in the note).
- Cover every topic of the syllabus, weighted by difficulty and by past gaps; include
  questions that CONNECT topics (the point of a subject exam) and, for linked topics,
  the angle this subject needs. No guided questions.
- Path: `learning_state` paths with `subject`, `kind: exam`, `scope: Final`. Use the
  `quiz.md` template with `kind: exam` (topic left empty).
- Grade, then `quiz_record` kind `exam`, `subject`, and `topic` on EVERY question (so
  gaps and reviews land on the right topic). The exam is passed only with score ≥
  threshold AND no open gaps in the subject: when gaps open, reinforce and retest them;
  the last retest that closes them completes the exam (the tool reports it).

## /grade (answers written in the note)

Read the note, grade each answer as above, append feedback under each answer and the
Results section, then `quiz_record`.
