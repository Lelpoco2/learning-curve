---
name: reinforcement
description: Turn every gap (wrong or poorly reasoned answer) into a targeted reinforcement note and a retest until the gap is closed. Use after a quiz/test/review opens gaps, or when open gaps exist on the active topic.
---

# Reinforcement

A wrong answer means a piece of reasoning is not consolidated. The goal is to find that
piece and rebuild it — not to repeat the lesson.

## For each open gap

1. Diagnose: re-read the learner's answer and reasoning. Name the exact misconception
   (e.g. "treats the dot product as a vector", "adds velocities in the rotating frame").
   If unclear, ask one short question.
2. Write the reinforcement note at the path given by `quiz_record` (or
   `learning_state` paths with `lesson` and `concept`), from `reinforcement.md`:
   - What happened: quote the answer, point to the exact step.
   - Why that reasoning is tempting: what is right about it, where it stops working.
   - Rebuild the idea from a DIFFERENT angle than the lesson (Learning Style summary).
   - One memory aid aimed at this exact mistake (skill `memory-aids`): a sign error → a
     special-value check; two swapped formulas → a contrast pair; a forgotten hypothesis →
     the counterexample that shows why it is needed.
   - Side by side: wrong vs right reasoning.
   - 2 practice questions with folded answers.
   Short: 1 screen. Verify math with `math_check` and facts with `source_lookup`
   (if the learner's answer follows their textbook's convention, it may not be wrong). Link it from the lesson note
   (a `> [!warning]` callout near the relevant section: "Common gap: … → [[link]]").
3. Walk through it in chat briefly (4–8 lines), then ask if it is clear.
4. Retest: 1–3 NEW questions on the concept (`quiz_ask`, independent, askWhy).
   Grade, then `quiz_record` with kind `retest` and the same concept names.
   - Correct with sound reasoning → the gap closes (tool reports it). Set the
     reinforcement note `status: resolved`.
   - Still wrong → try another angle (consider a missing prerequisite), update the note,
     retest again later in the session or next session.
5. Record which angle worked with `learner_profile` observe.

## Order

Close gaps of the current block before moving to the next block when possible; never
let more than ~5 gaps accumulate. Gaps from a subject final exam belong to the topic of
the question: write the note in that topic's lesson folder and retest with
`quiz_record` kind `retest`, `subject` and `topic` set (closing the last one completes
the exam). Gaps found in reviews follow the same procedure but
the note can be shorter.
