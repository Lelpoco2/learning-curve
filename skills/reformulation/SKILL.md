---
name: reformulation
description: Rewrite, in place, a section of a note the learner did not understand, using a different explanatory approach chosen from their learning style, then check understanding again. Use when the learner says they do not get a note/section/concept, or on /reformulate.
---

# Reformulation

Trigger: ONLY when the learner says they do not understand something in a note (or runs
`/reformulate`). Do not reformulate on your own initiative.

## 1. Diagnose before rewriting

1. Identify the note and the exact section (ask if unclear; read the note).
2. Ask ONE short diagnostic question to find where understanding breaks: the
   motivation? a specific step? the notation? the definition itself? Often the block is
   a missing prerequisite or a jump between two steps.

## 2. Choose a different approach

Check the Learning Style summary and recent observations (`learner_profile` get). Pick
an approach different from the one that failed:

| Failed approach | Try |
|---|---|
| Formal derivation | Concrete numbers first, then generalise |
| Abstract picture | Physical analogy or everyday situation |
| Words only | A figure, plot or short animation (skill `visuals`) |
| Big step | Smaller steps, each with a one-line reason |
| Heavy notation | Words first, then introduce symbols one at a time |
| Single example | Contrast: example vs non-example |

If a prerequisite is missing, add a short folded "Refresher" callout before the section.

## 3. Rewrite in place

1. Replace ONLY the unclear section with `edit` (keep the rest of the note intact).
2. Keep the logical thread: the new text must connect with the text before and after.
3. Keep the lesson layout of its kind (skill `lesson-writing` and the kind's template): dotted heading numbers in order (renumber
   the following sections and "§" references if you add or remove one), one blank line
   after each heading, the formal `[!info]` statement of the concept unchanged unless it
   was wrong — reformulate the explanation around it, not the definition.
4. Verify any new math with `math_check`.
5. Increase the note's `revision` property by 1 and set `updated`. If flashcards are
   enabled and the lesson's cards relied on the old explanation, update its section in the
   topic's Flashcards note.

## 4. Check and learn

1. Ask one guided question on the rewritten part (`quiz_ask`, guided, with hints).
   If the "How to remember it" tips relied on the approach that failed, replace them with
   tips that fit the new one (skill `memory-aids`).
2. Record what happened with `learner_profile` observe: the failed approach
   (`does-not-work`) and, if it now clicks, the new one (`works`), with evidence.
3. If the same kind of approach keeps failing, update the Learning Style Summary bullets.
4. If it still does not click after two reformulations, step back: likely a missing
   prerequisite. Propose a short prerequisite mini-lesson (add it to the plan).
