---
name: lesson-kinds
description: Choose, change or create the lesson kind (template) of a subject or topic - math, physics, cs (computer science theory), programming (practical, in the language the learner chooses), generic, or a custom kind of the vault - and set up the programming language and its toolchain. Use when starting a subject, when a topic needs a different kind of lesson, when the learner asks for a different note structure, or on /new-subject.
---

# Lesson kinds

Every subject has a lesson kind: the template its lessons follow (sections, what goes in the
formal boxes, how things are checked, quiz and flashcard style). A topic can override it (e.g.
a programming topic inside a math course). Each template's comment block holds its own rules:
read it before writing a lesson of that kind.

| Kind | For | Checked with |
|---|---|---|
| `math` | definitions, theorems, proofs, computations | `math_check` |
| `physics` | phenomenon → model → laws → problems with units → limits of the model | `math_check` (units), CODATA |
| `cs` | algorithms, data structures, complexity, computability | `code_run` (trace, tests, timing), `math_check` (recurrences) |
| `programming` | a language or tool, hands-on | `code_run` for every snippet, exercises with tests |
| `generic` | anything else | `source_lookup` |

`learning_state` `set_kind` without arguments lists the kinds of this vault (built-in,
overridden, custom).

## 1. Choose (new subject or topic)

1. Propose the kind that fits the subject and say in one line why ("Fisica 1 → physics:
   each lesson goes phenomenon, model, laws, problems with units"). Mixed subjects: pick the
   kind of most topics and override the others per topic.
2. Confirm with the learner, then `learning_state` `set_kind` (subject) or pass
   `lessonKind` to `set_syllabus`. For one topic: `set_kind` with `topic`
   (`lessonKind: "inherit"` removes the override).

## 2. Programming language (kinds `programming` and `cs`)

The learner decides the language; you adapt to it.

1. Ask which language (and version, if it matters: Python 3.12, C++20, Java 21…) and why
   (course requirement, job, curiosity). If they have no preference, recommend one for
   their goal in 2 lines and let them decide. For `cs` the default is Python if they do
   not care (readable pseudocode-like code).
2. `code_run` `check` with that language:
   - installed → note the version;
   - missing → show what would be installed (the command from `check`) and ASK. Install
     only after a yes (e.g. the winget command with bash), then `check` again (the PATH is
     refreshed). If they prefer to install it themselves, wait.
   - a language that is not built in → agree a command line (compiler/interpreter) and use
     `code_run` `command` with `{file}`; check it with `--version`.
3. Save it: `set_kind` with `language` (subject, or topic override). Every lesson, example,
   exercise and quiz of that subject is then written in that language. Never switch
   language silently; if another language helps (e.g. comparing Python and C), say so.

## 3. Change the kind of an existing subject

`set_kind` changes the template for NEW lessons. Existing lessons keep their layout. If the
learner wants them converted, convert one first, show it, and continue only after approval
(rewrite in place, keep the content, `revision` + 1; keep flashcard `<!--SR:…-->` lines).

## 4. Create a custom kind

When no kind fits (history, languages, music theory, a lab course…) or the learner wants a
different structure:

1. Interview briefly: how do they study this subject, what must a lesson contain, how is
   knowledge checked (exam style), what goes in the formal boxes (a date and source? a rule?
   a reaction?).
2. Draft the section outline in chat (numbered, like the built-in ones) and iterate until
   approved.
3. Write it to `.learning-curve/templates/lesson-<id>.md` (`id`: lowercase, dashes; the
   path is shown by `set_kind` without arguments). Start from the closest built-in template
   (templates directory in `<learning_context>`, `lessons/<kind>.md`): same frontmatter
   (`type: lesson`, `kind: <id>`, placeholders), and a comment block with the kind's rules
   (sections, boxes, checks, quiz and flashcard style).
4. `set_kind` with `lessonKind: <id>`. Overriding a built-in kind for this vault only: save
   it as `lesson-math.md`, `lesson-physics.md`… in the same folder.
