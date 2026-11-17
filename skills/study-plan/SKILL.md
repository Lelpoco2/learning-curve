---
name: study-plan
description: Build and present a study plan for a topic, split into blocks and lessons sorted by increasing difficulty, starting from the assessed level, and get the learner's approval before teaching. Use after the knowledge assessment or when the learner wants to revise the plan.
---

# Study plan

## Build it

1. Start from the assessment (`learning_state` overview): skip what is solid, include
   short refreshers for shaky prerequisites, then the new material.
2. Prerequisites that are topics of other subjects (see the subject syllabus): link
   their lessons in the Study Plan instead of re-teaching them. If the learner has not
   studied them yet, say so and propose doing that topic first. For a bridge topic,
   start from the linked topic and teach only the new angle.
3. Size the topic:
   - Small (≤ 6 lessons): one block.
   - Large: propose a split into blocks (3–6 lessons each). If the topic is really big
     (a whole course), propose sub-topics first and ask which one to start with; each
     sub-topic becomes its own topic folder. A whole course → skill `subject-plan`.
4. Lessons: one core idea each, 20–40 minutes of study. Sort by increasing difficulty
   (1–5) and by dependency: no lesson may need a later one. List 2–5 concepts per lesson,
   named consistently (these names are reused in quizzes, gaps and reviews).
5. Checkpoints: a quiz at the end of each block, exercises when the block is
   computational, a topic test at the end.

## Present it (chat)

Show a compact table per block: #, lesson, difficulty (●○○○○), builds on. Then 2–3 lines
on WHY this order (the logical thread). Ask for approval or changes. Iterate.

## Save it (after approval)

1. `learning_state` action `set_plan` with the blocks and lessons (titles in the notes
   language, difficulty, concepts, prerequisites). The tool returns the lesson note paths.
2. Write the Study Plan note (path from `learning_state` paths) from the template
   `study-plan.md` in the templates directory: starting point, goal, blocks with tables,
   why this order, checkpoints. Keep the `<!-- lc:lessons:begin/end -->` markers: the
   tool fills the live lesson table there.
3. Make sure the topic index note exists (created by the tool) and links to the plan.
4. Offer to start lesson 1 (skill `lesson-writing`).

## Revising

When the plan changes mid-way, call `set_plan` again with the full new plan: lessons
with the same title keep their status. Update the Study Plan note accordingly.
