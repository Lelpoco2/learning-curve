---
type: lesson
kind: programming
subject: "{{subject}}"
topic: "{{topic}}"
subjects: [{{subjectsList}}]
lesson: {{n}}
block: "{{block}}"
difficulty: {{difficulty}}
status: in-progress
revision: 1
language: "{{language}}"
concepts: [{{concepts}}]
prerequisites: [{{prerequisites}}]
sources: []
created: {{date}}
updated: {{date}}
tags: [learning/lesson, {{subjectTags}}, {{topicTag}}]
---

# {{title}}

> [!abstract] In one sentence
> What the learner will be able to do after this lesson.
>
> *Question of the lesson:* the task we want to get done.

<!--
KIND: PRACTICAL PROGRAMMING. Shared layout rules: skill lesson-writing. Remove these comments.
- The language/tool and its version are the learner's choice (`language:` property, from
  learning_state). Write every example in it; never switch language silently.
- Order: the task → core concepts → build it step by step → debugging → exercises → practices.
- EVERY snippet is run with code_run before it goes in the note; the output and the error
  messages shown are the real ones (paste them under the code as a ```text block).
- Code in fenced blocks with the language tag. Files that belong together (a small program,
  exercises with their tests) go in the lesson's code/ folder and are linked from the note.
- [!info] holds ONLY the official syntax / API: signature, parameters, return value, errors
  raised, version notes, with a link to the official documentation (source_lookup url).
- [!warning] holds a common mistake WITH the real error message and the fix.
- Exercises: starter code + tests to pass (run them with code_run when grading); solution folded.
- Quizzes: "predict the output", "find the bug", "write a function that passes these tests",
  "which error and why".
- Flashcards: "what happens if…", "which error and why", "when do you use X instead of Y" —
  never syntax trivia.
-->

## 1. What we build

### 1.1 The task

<!-- A concrete goal the learner wants, e.g. "read a CSV and compute averages per class". -->

### 1.2 When you need this

<!-- Where this tool/feature is the right choice, and the signals in a problem. -->

## 2. Core concepts

### 2.1 <Concept>

<!-- What it is for, in one or two sentences. -->

```<language>
minimal runnable example
```

```text
its real output (from code_run)
```

> [!info] Syntax — name
> Signature / form, parameters, return value, errors raised, version notes.
> Docs: <official documentation URL>[^1]

> [!warning] Common mistake — name
> The mistake, the real error message, and the fix.

## 3. Build it step by step

<!-- Incremental code: each step runs (code_run) and shows its output; explain why each step
     is needed. The final program goes in the lesson's code/ folder. -->

## 4. Debugging

<!-- Typical errors for this topic: the message as the learner will see it, how to read it
     (which line, which value), how to fix it. -->

## 5. Exercises

### 5.1 <Exercise>

<!-- Task, starter code, tests to pass (e.g. asserts or the language's test framework). -->

> [!note]- Solution
> Solution code and why it works.

## 6. Good practices

<!-- Idioms, naming, style of the language community; short. -->

## 7. Recap

### 7.1 Key ideas

### 7.2 Cheat sheet

| Syntax / command | What it does |
|---|---|
| | |

## 8. Connections

- Builds on:
- Leads to:
- Flashcards: <!-- only when enabled -->

## Sources

<!-- Footnotes for checked facts (skill fact-checking): learner's books first. -->

[^1]: Author or site, *Title*, page or section, URL (accessed YYYY-MM-DD)
