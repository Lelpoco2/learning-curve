---
name: learning-style-interview
description: Interview the learner to discover HOW they understand (intuition vs formalism, visuals, analogies, examples-first, pace, language) and write the Learning Style note the tutor reads before every explanation. Use on first setup, when /style is run, or when explanations repeatedly miss.
---

# Learning-style interview

Goal: learn how to write for THIS learner. Not a personality test: collect concrete,
usable preferences and evidence.

## Rules

- One question at a time. Short. Prefer `quiz_ask` with type `mcq` (2–5 options, plus
  the free-text option it adds automatically) when options make answering easy; use
  plain chat for open questions.
- 8–12 questions, adaptive: skip what earlier answers already settled.
- Show, don't only ask: for 2–3 questions, present the SAME micro-concept explained in
  two different ways and ask which one "clicks" and why. This is the most reliable signal.

## Question bank (pick and adapt)

1. Background: what do you study/do; which math/physics do you use already?
2. Goal: why are you learning now (exam, curiosity, work, research)? Time per week?
3. When you met a concept that finally "clicked", what made it click?
4. Order: idea and picture first, then formula — or formula first, then meaning?
5. Show-don't-ask A: explain e.g. the derivative (a) as the slope of the zoomed-in graph
   vs (b) as the limit of the difference quotient. Which is clearer first? Why?
6. Show-don't-ask B: a physical analogy vs a worked numeric example for the same idea.
7. Proofs: do you want to see why things are true (always / key results only / rarely)?
8. Visuals: static figures, animations (Manim), interactive graphs, or little need?
9. Density: short notes with many steps, or fuller paragraphs?
10. When stuck: a hint question, an analogy, a smaller example, or the next step shown?
11. Notation: comfortable with formal notation, or prefer words first?
12. Language and tone in conversation (formal/informal, humour yes/no).
13. Remembering: how do you usually recall a formula you forgot — re-derive it, picture
    it, check it with an example, or a rhyme/mnemonic? (Shapes the "How to remember it"
    tips; show-don't-ask works here too: offer two tips for the same formula.)

## Write the result

1. Read the Learning Style note (path in `<learning_context>`). Keep its structure.
2. The FIRST H2 section (Summary; translate the heading into the notes language) must
   contain 5–10 actionable bullets, written as instructions to the tutor, e.g.:
   - "Start from a physical picture, then the formula."
   - "Show a numeric example before the general case."
   - "Proofs only for key theorems, folded."
   - "Prefer one animation per lesson for geometric ideas."
3. Fill the Interview section with the questions and answers (concise).
4. Fill What works / What does not work.
5. Record the strongest signals with `learner_profile` action `observe` (effect `works` or
   `does-not-work`, with evidence).
6. Also update Profile note Background and Goals sections.
7. Tell the learner what you learned in 3–4 lines and that it will keep improving from
   observations during lessons.
