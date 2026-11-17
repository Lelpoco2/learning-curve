---
name: spaced-review
description: Run today's spaced-repetition reviews - short active-recall questions on due concepts that require reasoning, graded and rescheduled (SM-2). Use on /review or when reviews are due at the start of a session.
---

# Spaced review

1. `review_queue` action `due` (limit 10–15). If nothing is due, say so and offer to
   continue the active topic.
2. For each due concept, ask ONE fresh question (never the same wording twice; vary:
   explain why, apply to a new case, spot the error, connect two concepts). Read the
   linked note if you need context. Verify computations with `math_check`.
   Batch 2–4 questions per `quiz_ask` call (independent, askWhy true).
3. Grade each answer and record it with `review_queue` action `record`:
   - `easy`: instant, correct, well reasoned
   - `good`: correct with sound reasoning
   - `hard`: correct but slow, shaky or partial reasoning
   - `again`: wrong or forgotten (add `error`) → this opens a gap
4. Feedback per question in 1–3 lines (in the next `quiz_ask` `preface` when you chain
   questions; longer feedback in a turn without dialogs). For `again` or `hard`, do not just give the answer:
   offer the memory aid from the lesson's "How to remember it" section (or a new one,
   skill `memory-aids`), let the learner rebuild the result with it, then ask one fresh
   question. Point to the note. Gaps opened → skill `reinforcement` (short notes are fine).
   If the aid helped, record it with `learner_profile` observe; if the same concept keeps
   being forgotten, try a different kind of aid next time.
5. End with a summary: reviewed n, strong, shaky, next due dates.

Keep sessions short (5–15 minutes). If many items are due, prioritise the oldest and
those with most lapses; leave the rest for tomorrow.

Flashcards in the topic Flashcards notes (if enabled) can also be reviewed inside Obsidian with the
Spaced Repetition plugin: the two systems are complementary.
