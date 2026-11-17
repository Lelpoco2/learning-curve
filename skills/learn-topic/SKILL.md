---
name: learn-topic
description: Start or resume learning a topic, or continue the active subject with its next topic. Routes through knowledge assessment, study plan approval, lessons, checkpoints, the topic test and, at the end of a subject, the final exam. Use when the learner says they want to learn/study something or runs /learn.
---

# Learn a topic

You orchestrate the learner's path. Detailed procedures live in other skills; load each
one when you reach its step.

## 0. Orient (always)

1. `learning_state` overview (with `topic` if the learner named one).
2. If the learning-style summary in `<learning_context>` is unknown, propose the
   learning-style interview first (skill `learning-style-interview`, 5–10 minutes). The
   learner may postpone it.
3. Decide WHAT to study:
   - No topic given, active subject → the subject's next topic (overview shows it).
   - No topic given, no active subject → ask what they want to learn and why. If it
     is a whole course (e.g. "Calculus 1", "Physics"), switch to skill `subject-plan`.
   - A topic given → `learning_state` `find_topic` first. If it exists (in any
     subject), use it: pass `topic` as `Subject/Topic`. Never create a duplicate.
4. Decide the SUBJECT for a new topic: the active subject when it belongs there,
   otherwise ask (reuse an existing subject or create one; names short and stable,
   in the notes language). A topic outside any planned syllabus is appended to its
   subject automatically.
5. Check the lesson kind in `<learning_context>`. If it was never chosen, or this topic
   needs a different one than its subject (e.g. a programming topic in a math course),
   agree it with the learner first (skill `lesson-kinds`).

## 1. Route by state

| State | Next step | Skill |
|---|---|---|
| topic new / `planned` / `assessing` | Knowledge assessment (short if the subject assessment covers it) | `knowledge-assessment` |
| `planning` (assessed, no plan) | Study plan, get approval | `study-plan` |
| open gaps on this topic | Close gaps first | `reinforcement` |
| reviews due | Offer `/review` first (short), then continue | `spaced-review` |
| lesson `in-progress` | Resume that lesson | `lesson-writing` |
| block just finished, no checkpoint yet | Suggest a checkpoint quiz/exercises | `quiz-and-exercises` |
| next lesson `planned` | Next lesson | `lesson-writing` |
| all lessons done, no passed topic test | Topic test | `quiz-and-exercises` |
| topic `done` | Recap; continue the subject's next topic | — |
| every topic of the subject done, final exam pending | Final exam | `quiz-and-exercises` (exam) |
| subject `done` | Celebrate briefly, summarise, propose next subjects | — |

A topic linked from another subject that is already `done` counts as done for this
subject too: offer a short review of it (3–5 questions) instead of re-teaching.

## 2. Rhythm of a session

- One lesson at a time. After each lesson: 1–2 guided check questions, then ask
  whether to continue, take a checkpoint, or stop.
- Suggest checkpoints at the end of each block; the learner decides.
- "I don't understand this note" → `reformulation`, then come back.
- Before stopping: 2–3 line recap and what comes next; `learning_state` must reflect
  lesson statuses.

## 3. Never

- Never teach before the assessment of a new topic.
- Never start lessons before the study plan is approved.
- Never mark a block, topic or subject as mastered while it has open gaps.
- Never duplicate a topic that exists in another subject: link it or build a bridge.
