---
name: memory-aids
description: Give tips and tricks to remember a concept or formula by reconstructing it rather than memorising it - 30-second rebuilds, sanity checks (units, limit cases, symmetry, special values), structural patterns, visual anchors, links to known results, and mnemonics only for pure conventions - verified and adapted to the learner. Use when writing the "How to remember it" section of a lesson, in reinforcement notes, when a review is forgotten, or when the learner asks for a trick (/remember).
---

# Memory aids

Goal: the learner can **rebuild** or **check** a result when they need it, instead of
reciting it. A good tip is short, reliable, and points back to the reasoning of the lesson.

## The toolbox (pick 2–4 per concept, the best ones for it)

| Kind | What it gives | Example |
|---|---|---|
| **Rebuild in 30 seconds** | The shortest derivation from something already solid | $\frac{d}{dx}\tan x$: write $\frac{\sin x}{\cos x}$, quotient rule, $\sin^2+\cos^2=1$ → $\frac{1}{\cos^2 x}$ |
| **Sanity checks** | Ways to catch a wrong formula | **Units** ($\tfrac12 mv^2$ is kg·m²/s² = J); **limit cases** (small angle: $\sin\theta\approx\theta$; $m\to\infty$); **symmetry** (swap $a,b$ → result must swap or stay); **special values** (try $n=1$, $x=0$, a right angle); **sign** (should it grow or shrink?) |
| **Structure / pattern** | One shape behind several formulas | Product rule, determinant, $(a-b)^2$: "the cross terms"; Taylor coefficients $\frac{f^{(n)}(0)}{n!}$ everywhere |
| **Visual anchor** | A picture the result can be read from | Unit circle (trig values and signs); area under a curve; parallelogram for $|\vb a\times\vb b|$; slope of the secant for Lagrange |
| **Link to something known** | "It is X in disguise" | Lagrange = Rolle tilted; work-energy = Newton's 2nd law integrated along the path |
| **Contrast pair** | Two things that are easy to swap, side by side | $\int \sin = -\cos$ vs $\frac{d}{dx}\sin = \cos$: "integrating moves one step *back* on the cycle $\sin\to\cos\to-\sin\to-\cos$" |
| **Mnemonic** | ONLY for pure conventions with no reason to rebuild | Right-hand rule; quadrant signs of trig functions; a book's notation |

Mnemonics are the last resort: if a result can be derived or checked, give the derivation
or the check instead. Never replace understanding with a rhyme.

## Rules

1. **Verify every tip.** Run the shortcut or the check with `math_check` (e.g. check that
   the limit case or special value really gives the stated result; check units with
   `sympy.physics.units`). A wrong trick is worse than none. Facts in a tip (names,
   conventions) go through `source_lookup` like any other fact.
2. **Adapt to the learner.** Read the Learning Style summary: visual learners get a visual
   anchor first, derivation-minded learners a rebuild, example-first learners a special
   value. Follow the conventions of the learner's textbook (Sources).
3. **Short.** One or two lines each, plus at most one formula. If it needs a paragraph, it
   is a lesson, not a tip.
4. **Connect, don't add.** Each tip should point back to a step of the lesson ("this is
   step 3 compressed"), not introduce new theory.
5. **Learn what works.** When the learner says a tip helped (or later recalls the result
   thanks to it, or forgets it anyway), record it with `learner_profile` observe, e.g.
   signal "memory aid: unit circle for trig signs", effect `works`/`does-not-work`.

## Where tips go

- **Lesson** — subsection "How to remember it" of the Recap (translated, numbered like
  the rest, e.g. `### 5.2 How to remember it`), after Key ideas. Plain bullets, no
  callouts, each labelled with what it is for:

  ```
  ### 5.2 How to remember it

  - *Rebuild the derivative of $\tan x$:* write $\tan x=\frac{\sin x}{\cos x}$ and use the
    quotient rule; the numerator becomes $\cos^2 x+\sin^2 x=1$, so $\frac{1}{\cos^2 x}$.
  - *Check with small angles:* near $0$, $\tan x\approx x$, so the derivative must be
    $\approx 1$; indeed $\frac{1}{\cos^2 0}=1$.
  ```

  For a convention mnemonic, say explicitly that it is only a convention.
- **Flashcards** (if enabled, in the topic's Flashcards note under the lesson's section) —
  add 1–2 cards that train the trick, not the result (multi-line format, own heading):

  ```
  ### 3.4 Derivative of the tangent

  How do you rebuild the derivative of $\tan x$ without memory?
  ?
  Write $\tan x = \frac{\sin x}{\cos x}$ and apply the quotient rule: $\frac{1}{\cos^2 x}$.
  ```
- **Reinforcement notes** — one tip aimed at the exact mistake (e.g. a sign error →
  "check with $x=0$"; swapped formulas → a contrast pair).
- **Reviews** — when a concept is forgotten (`again`) or shaky (`hard`): give the rebuild or
  the check first, let the learner reconstruct the result, then ask a fresh question.
- **On request** (`/remember` or "give me a trick"): give 2–3 tips in chat, ask which one
  clicks, then add the chosen ones to the "How to remember it" section of the lesson that
  teaches the concept (`learning_state` paths) and record the observation.
