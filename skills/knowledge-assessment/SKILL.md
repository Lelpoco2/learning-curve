---
name: knowledge-assessment
description: Adaptive interview and diagnostic quiz to find what the learner already knows about a topic and its prerequisites, including the reasoning behind answers. Use before planning any new topic, or to re-calibrate when a plan feels too easy/hard.
---

# Knowledge assessment

Goal: a reliable picture of what is solid, shaky and new — for the topic AND its
prerequisites — so the study plan starts at the right point.

## Scope

- Topic assessment (this skill): one topic and its prerequisites, in depth.
- Inside a subject that already has a broad assessment: keep it SHORT (3–6 questions),
  probing only what is specific to this topic; reuse the subject assessment and the
  knowledge map.
- A whole subject: use the skill `subject-plan` (broad sampling across topics).

## Procedure

1. Map the territory silently: list the topic's core concepts and its prerequisites
   (2 levels down). Order them from basic to advanced.
2. Short interview (2–3 questions): previous courses/books, where they used it, what
   they think they know, what scares them.
3. Diagnostic quiz, adaptive (binary-search the level):
   - Start at a medium prerequisite. Correct and well reasoned → go up. Wrong → go down.
   - 6–12 questions total. Mix types: conceptual "why", recognise-when-to-use, small
     computation, interpret a result.
   - After EVERY answer without justification, ask "why?" or "how did you get it?".
     Right answers with wrong reasoning are gaps; wrong answers with partly right
     reasoning are signals of what to build on.
   - Use `quiz_ask` (independent mode) for crisp questions; plain chat for discussion.
   - Verify every computational answer with `math_check` before judging it.
   - Let the learner say "I don't know": it is useful data, never penalised.
   - Do not teach during the assessment; at most one sentence of reassurance.
4. Record the result:
   - `quiz_record` with kind `assessment`, scope "Assessment", one entry per question
     (concept, correctness, reasoning). This calibrates the knowledge map; it does not
     schedule reviews.
   - `learner_profile` action `set_knowledge` for important concepts discussed but not
     quizzed (levels 0–4).
   - `learning_state` action `set_assessment` with `subject`, `topic`, level (e.g.
     "beginner: solid algebra, no calculus"), a 2–4 line summary, `known` and `weak`
     concept lists. This also creates the subject and topic index notes and adds the
     topic to the subject's syllabus if it was not planned there.
5. Tell the learner the outcome in 3–5 lines: where they stand, what the plan will
   start from, and that gaps are normal and will be addressed. Then continue with the
   `study-plan` skill.
