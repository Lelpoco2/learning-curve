# Changelog

## [0.14.1] - 2026-11-17

### Fixed
- Claude Code installed pi and its whole dependency tree into the plugin folder: it runs
  `npm ci` when a plugin ships a lockfile. The lockfile is no longer published (Learning Curve has
  no runtime dependencies) and pi's packages are optional peers.

## [0.14.0] - 2026-11-17

### Added
- **Claude Code plugin** in the same repository: MCP tool server (all Learning Curve tools plus
  `tutor_context`, `workspace_setup`, `obsidian_plugins`), hooks (persona and learning context at
  session start, note check after every Write/Edit), 16 commands (`/learning-curve:learn`…), the
  same 19 skills, optional status line, marketplace manifest and icon. Quizzes use MCP
  elicitation forms (answer, "why?", options, review). Chat math adapts to the client (terminal:
  Unicode; VS Code: KaTeX; desktop: `$$`); forms show LaTeX as readable text. The same vault works
  with pi and Claude Code. Tested live with Claude Code 2.1.326 (setup, tools, hook, forms).

### Changed
- Platform-neutral core: tools defined once (`ToolDef`) and registered by a pi adapter or the MCP
  server; dialogs through a `UiPort`; own JSON Schema builder (no TypeBox); workspace setup and
  Obsidian plugin management extracted from the pi wizards. pi behaviour unchanged.
- Multiple-choice options that arrive already lettered ("A) …") are no longer lettered twice.
- Node ≥ 22.18 required (TypeScript type stripping for the Claude Code side).

## [0.13.0] - 2026-11-09

### Added
- Lesson kinds: each subject (or topic) uses a lesson template suited to how it is learned —
  `math`, `physics` (phenomenon → model → laws with validity conditions → problems with units →
  limits), `cs` (specification → pseudocode and trace → correctness → cost → tested
  implementation), `programming` (runnable examples with real output, official syntax/API,
  debugging, exercises with tests, cheat sheet) and `generic`. Each template carries its own
  rules (formal boxes, checks, quiz and flashcard style). `learning_state` `set_kind`
  (subject, or topic override), `lessonKind`/`language` on `set_syllabus`; the kind and
  template path are in `paths` and in the tutor's context. Custom kinds and per-vault overrides
  in `.learning-curve/templates/lesson-<kind>.md`. Skill `lesson-kinds`.
- `code_run`: runs code in the language the learner chose (Python, JS, TS, SQL on SQLite, Bash,
  PowerShell, C, C++, Java, Go, Rust, C#, Ruby, PHP, R, Julia, Lua, Perl, Haskell, Kotlin; any
  other via a custom command), with stdin, arguments, compile errors reported apart, language
  inferred from the file or the subject. `check` lists installed toolchains and verified install
  commands (winget/brew/apt); installing needs the learner's consent; PATH changes are picked up
  without restarting.
- Note check: code blocks without a language in cs/programming lessons.

### Changed
- `templates/lesson.md` → `templates/lessons/math.md`; lessons get a `kind` property (and
  `language` for cs/programming) and a `code/` folder for runnable files.

## [0.12.0] - 2026-11-09

### Fixed
- Feedback hidden by option menus: a dialog (`question`, `quiz_ask`) takes the bottom of the
  terminal and pushed the text written before it in the same turn off-screen (reproduced in a
  real pseudo-console: nothing is deleted, but on a 32-row terminal the menu, its echo and the
  footer took ~18 rows, so the start of the feedback — the verdict — was above the screen).
  New persona principle 13 and skill rules: feedback goes in a turn of its own ending with the
  next steps as a plain numbered list; a dialog in the same turn only after at most 4 lines,
  with the verdict inside the dialog.
- Exponents were hard to read: pi renders `2^3` as the half-height Unicode `2³`. Exponents
  are now shown full size in caret form (`2^3 · 2^4`, `x^(n+1)`) in chat (assistant and
  learner messages) and in quiz dialogs; 2D display layouts (fractions) stay aligned. Config
  `mathExponents: "superscript"` restores the old look. Also fixes inline math with `|x|`
  inside Markdown tables, which pi showed as `.

### Added
- `quiz_ask` `preface`: short text shown at the top of the first question (e.g. the verdict on
  the previous answer).

## [0.11.0] - 2026-11-09

### Changed
- Flashcards format: in the topic Flashcards note, one `## N. Lesson` section per lesson
  (N = lesson number) with a link back, and one `### N.k Topic` heading per card; every card
  in the multi-line format (question / `?` / answer), no `::` one-liners. Card headings name
  the topic, never the answer (the plugin shows them as context during review). The plugin's
  `<!--SR:…-->` review lines are preserved when cards are edited. Verified against the
  Spaced Repetition plugin's own parser (v1.15.4).

### Added
- Note check for flashcards notes: `::` one-line cards, highlights (the plugin turns them
  into cloze cards), cards without their own heading, card numbering not matching the lesson
  section.

## [0.10.0] - 2026-11-09

### Changed
- New lesson layout, organised by concept instead of by kind of text: numbered sections in
  dotted notation (`## 1.`, `### 1.1`) whose group titles say what you are reading
  ("Factoring methods", "Worked example", "Recap"); each concept goes intuition → formal box
  → folded proof → example → its trap. Every concept gets its formal, official statement in
  an `[!info]` box (hypotheses, LaTeX, source), and boxes only hold that. One meaning per
  callout type; check questions with the answer folded inside; Recap = key ideas + how to
  remember it (plain bullets).
- Flashcards move out of lessons into one `Flashcards.md` per topic (a section per lesson),
  created on demand for existing topics and linked from the topic index.
- All templates: one blank line after every heading; reinforcement notes numbered too.

### Added
- Note check rules: a heading must be followed by a blank line (all notes); lessons and
  reinforcement notes must use dotted numbering in order, sub-numbers matching their parent,
  back matter (Sources) last.

## [0.9.0] - 2026-11-09

### Fixed
- Topic folders are numbered in syllabus order (`01 - Topic`), like lessons, so Obsidian no
  longer sorts them alphabetically. Reordering a syllabus renumbers the folders; index notes
  are renamed with their folder and every reference is updated (wikilinks and embeds,
  escaped table links, Dataview `FROM` paths, paths stored in the state). Renames onto an
  existing folder are skipped and reported.
- Existing vaults are asked once at startup (deferred until pi is ready to receive the
  answer); `numberTopicFolders: false` opts out.

## [0.8.0] - 2026-11-09

### Added
- Memory aids: `memory-aids` skill and a "How to remember it" section in every lesson with
  2–4 verified tips (30-second rebuilds, sanity checks with units/limit cases/symmetry/
  special values, patterns, visual anchors, links to known results; mnemonics only for
  conventions), adapted to the learner's style.
- `/remember [concept]` command: tips on request, the chosen ones are added to the lesson.

### Changed
- Reviews offer the memory aid before re-asking a forgotten concept; reinforcement notes
  include a tip aimed at the exact mistake; flashcards include cards that train the tips;
  reformulations refresh tips; the learning-style interview asks how the learner recalls
  formulas; tutor principle 11.

## [0.7.0] - 2026-11-09

### Added
- Review before submitting: with two or more questions, `quiz_ask` ends with a review list
  (question → answer, math rendered). Any question can be reopened to change the answer or
  the justification (pre-filled; Esc keeps the current answer); Esc on the list asks to
  confirm submission. The tutor receives which answers changed and the first answer.

### Changed
- Quiz skill: all independent questions in one `quiz_ask` call so the review covers the
  whole quiz; changed answers feed the feedback (self-correction vs uncertainty).

## [0.6.0] - 2026-11-09

### Added
- Terminal math display: vault preamble macros (`\vb`, `\R`, `\pdv`, … and any
  `\newcommand` added by the learner) are expanded just before display so pi's Unicode
  renderer can draw those formulas (display-only).
- Quiz dialogs render math in questions, options and hints; the tutor receives the original
  LaTeX of the chosen option.

## [0.5.0] - 2026-11-09

### Added
- Obsidian note checker: runs automatically after every write/edit of a note and reports
  problems to the tutor, which fixes them immediately. Checks YAML properties (syntax,
  quoting, duplicates, required properties per note type), unfilled placeholders, math
  delimiters, callout `>` prefixes, table wikilink pipes, missing links/embeds, relative
  links, footnotes, code fences, headings and generated sections.
- `note_check` tool and `/check-notes [path]` command (a note, a folder or the whole vault;
  optionally ask the tutor to fix the errors).

## [0.4.0] - 2026-11-09

### Added
- Fact checking: `source_lookup` tool and `fact-checking` skill. Sources, in priority order:
  the learner's own textbooks/notes in the vault `Sources/` folder (PDF via pypdf, cited
  to the page), NIST CODATA, NIST DLMF, OEIS, Encyclopedia of Mathematics, Wikipedia (any
  language), nLab, arXiv, Crossref, any URL. Formulas are returned as LaTeX; lookups are
  cached.
- Lessons get a `Sources` section with footnote citations and a `sources:` property;
  unverifiable statements are marked `[!warning] Not verified`.
- `Sources/README.md` created in every workspace; `pypdf` added to the Python tools
  (installed automatically on first use in existing workspaces).

### Changed
- Tutor principle 5 now covers facts as well as calculations; quizzes check the learner's
  textbook conventions before marking an answer wrong.

## [0.3.0] - 2026-11-09

### Added
- `/learn-plugins`: manage Obsidian plugins after setup — install from the recommended
  list or search the whole community catalog (cached for 24 h, ranked by downloads),
  update, disable (keeps settings), remove.
- Enabled plugins are synced into the workspace config at every session start (also
  plugins installed from Obsidian) and shown to the tutor, which uses plugin blocks only
  for enabled plugins.

## [0.2.0] - 2026-11-09

### Added
- Subjects: `/new-subject <name>` starts a whole course with a goal interview (optionally
  the official syllabus), a broad assessment and an ordered syllabus of topics.
- Shared topics: a topic lives in one home subject and is linked (never duplicated) by
  other subjects; bridge topics cover a different angle. Duplicate topic names are
  rejected with a hint.
- Final exam per subject: `/exam`, exam notes in `<Subject>/Exams`, completion when
  passed with no open gaps.
- Subject index note with generated syllabus table, Mermaid topic map and exam status;
  `subjects` property and per-subject tags on topic and lesson notes; dashboard grouped by
  subject; status line shows subject › topic.
- `learning_state` actions: `subject_overview`, `find_topic`, `set_subject_assessment`,
  `set_syllabus`; `quiz_record` kind `exam` with per-question topics.
- Skill `subject-plan`.

### Changed
- `/learn` without arguments continues the active subject with its next topic.

## [0.1.0] - 2026-11-09

### Added
- Learning workspace activation: tutor persona, learning tools and skills only inside a
  vault with `.learning-curve/`.
- `/learn-setup` wizard: note app, vault, notes language, flashcards, Obsidian plugin
  installer (curated list), Python environment (uv, SymPy, matplotlib, Manim), optional
  MiKTeX.
- Tools: `learning_state`, `quiz_ask`, `quiz_record`, `learner_profile`, `review_queue`,
  `math_check`, `plot_render`, `manim_render`.
- Skills: learn-topic, learning-style-interview, knowledge-assessment, study-plan,
  lesson-writing, reformulation, quiz-and-exercises, reinforcement, spaced-review,
  math-verification, visuals, notes-obsidian, notes-adapter.
- Commands: `/learn`, `/lesson`, `/quiz`, `/exercises`, `/test`, `/grade`, `/reformulate`,
  `/review`, `/style`, `/progress`.
- Note templates and generated sections (Dashboard, knowledge map, lesson tables,
  style observations).
- SM-2 spaced repetition; gap tracking (every wrong answer is a gap until a correct retest).
