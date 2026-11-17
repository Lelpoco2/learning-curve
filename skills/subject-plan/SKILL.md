---
name: subject-plan
description: Start a whole subject or course (e.g. Calculus 1, Physics 1, Linear Algebra, Python) - goal interview, optional official syllabus, broad assessment, lesson kind (and programming language), then an ordered syllabus of topics sorted by dependency and difficulty, reusing topics that already exist in other subjects. Use on /new-subject or when the learner wants to study a complete subject.
---

# New subject

A subject is a course: an ordered syllabus of topics. Each topic still gets its own short
assessment and study plan when its turn comes (skill `learn-topic`).

## 1. Orient

1. `learning_state` overview. If the subject already exists, show its syllabus
   (`subject_overview`) and ask whether to resume or revise it.
2. Agree on the subject name with the learner: short, stable, in the notes language
   (e.g. `Analisi 1`, `Fisica 1`). It becomes the folder name.

## 2. Interview (one question at a time, 4–6 questions)

- Goal: university exam (which course/university?), school, self-study, work, research.
- Official material: a syllabus, exam program or textbook table of contents. Ask the
  learner to put it (and the course textbooks/lecture notes) in the vault `Sources/`
  folder, e.g. `Sources/<Subject>/`, or paste it. READ it (`source_lookup` source local).
  It defines scope and order; you still sort and split it pedagogically. These files are
  also the first reference for fact checking during the whole subject.
- Deadline and time per week (affects lesson size and checkpoints).
- What they already studied related to this subject; what worries them.
- Final exam at the end of the subject: yes (default) or no.

## 3. Broad assessment (8–14 questions)

Sample the whole subject plus its prerequisites, not one topic in depth. Same rules as the
skill `knowledge-assessment` (adaptive, ask "why?", verify with `math_check`, "I don't know"
is welcome, no teaching). Start from the knowledge map: skip what is already known.

Record:
- `quiz_record` kind `assessment`, `subject` set, no `topic`, and for every question
  the `topic` it belongs to (a planned topic name). It calibrates the knowledge map.
- `learning_state` `set_subject_assessment` with goal, level, summary, known, weak.
  It creates the subject index note.

## 4. Syllabus

1. List the topics of the subject. A topic = one coherent area, usually 3–8 lessons
   (e.g. Limits, Derivatives, Integrals). Very big areas → several topics.
2. **Check existing topics before creating any.** For each candidate call
   `learning_state` `find_topic`. If a topic with that content exists in another
   subject:
   - same content → **link it**: syllabus item with `home` = its subject. If it is
     already done, it counts as done here too (the tutor may run a short review);
     if it is in progress, it continues where it is.
   - this subject needs a different angle (e.g. vectors as forces in Physics vs
     vectors as abstract objects in Linear Algebra) → link the original as a
     prerequisite AND add a short **bridge topic** homed here with a distinct name
     (e.g. `Vettori in fisica`, 1–3 lessons, `note: "bridge: …"`).
   Never create a second topic with the same name.
3. Order: prerequisites first, then increasing difficulty. Add `prerequisites` (topic
   names, also from other subjects) and an estimated number of lessons.
4. Present in chat: table (#, topic, home if linked, difficulty ●○○○○, ~lessons,
   builds on) + 3 lines on WHY this order + the final exam choice. Iterate until
   approved.
5. Lesson kind: propose the kind of lesson for this subject (math, physics, cs,
   programming, generic or a custom one; skill `lesson-kinds`) and, for programming/cs,
   let the learner choose the language and check its toolchain (`code_run` check).
6. `learning_state` `set_syllabus` with `items`, `goal`, `finalExam`, `lessonKind` (and
   `language`). It creates the
   topic folders/index notes, links shared topics, and fills the subject index
   (syllabus table, Mermaid topic map, exam status).
7. Write the hand-written parts of the subject index note (path from `learning_state`
   paths): Goal callout, Starting point, Why this order. Do not touch the generated
   `<!-- lc:… -->` sections.

## 5. Start

Offer to begin the first topic: run the `learn-topic` skill for it (its assessment can be
short: reuse the subject assessment and only probe what is specific to the topic).

## Revising later

Call `set_syllabus` again with the full list: removed planned topics are deleted (if
untouched) or unlinked, existing topics keep all progress.
