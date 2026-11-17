<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" alt="Learning Curve logo" width="360">
  </picture>
</p>

# Learning Curve

A [pi](https://pi.dev) package and [Claude Code](https://code.claude.com) plugin that turns the agent into a structured **STEM tutor**.
It learns what you know and how you understand, presents a study plan sorted by
difficulty, teaches intuition first (why → when → what), verifies every calculation with
SymPy, checks understanding with quizzes that ask for your reasoning, turns every wrong
answer into a reinforcement note and a retest, and keeps everything alive with spaced
repetition. All notes are written to your note-taking app — Obsidian by default — with
LaTeX math.

The package is **dormant** in normal sessions. It becomes a tutor only when the agent runs
inside a *learning workspace* (a vault containing `.learning-curve/`). The same vault works with
both agents: notes, progress, gaps and flashcards are shared.

## Requirements

| What | Needed for |
|---|---|
| [pi](https://pi.dev) ≥ 1.5 **or** [Claude Code](https://code.claude.com) ≥ 2.1.275 | the agent that runs the tutor |
| [Node.js](https://nodejs.org) ≥ 22.18 | Claude Code runs the plugin's tool server and hooks with Node (pi already includes it) |
| [Obsidian](https://obsidian.md) (recommended) or any Markdown note app | reading your notes; the tutor writes them |
| [uv](https://docs.astral.sh/uv/) (optional) | creating the Python environment for SymPy, plots and Manim |
| winget (optional, Windows) | installing MiKTeX for formulas inside Manim videos, and programming toolchains when you ask |

## Install

**pi**

```bash
pi install git:github.com/Lelpoco2/learning-curve      # or: pi install ./path/to/learning-curve
```

**Claude Code**

```
/plugin install learning-curve --marketplace Lelpoco2/learning-curve
```

(or `/plugin marketplace add Lelpoco2/learning-curve`, then `/plugin install learning-curve@learning-curve`).

## Setup and first steps

### With pi

1. Open pi anywhere and run **`/learn-setup`**. It asks, one step at a time:
   - note app (Obsidian recommended; Logseq, Zettlr, Joplin, plain Markdown or any other —
     the tutor learns how to use it);
   - vault folder;
   - notes language;
   - flashcards (a Flashcards note per topic, Obsidian Spaced Repetition plugin);
   - Obsidian plugins (checklist, recommended ones preselected);
   - Python tools (SymPy, NumPy, SciPy, matplotlib, Manim, pypdf) and optionally MiKTeX.
2. Start pi **inside the vault** folder. The tutor proposes the learning-style interview
   (`/style`, 5–10 minutes): it decides how lessons explain things to you.
3. Choose what to study:
   - a whole course: `/new-subject Calculus 1` → goal interview → broad assessment → syllabus
     of topics and lesson kind (math, physics, cs, programming…) → you approve it;
   - a single topic: `/learn Derivatives` → knowledge assessment → study plan → you approve it.
4. Then `/lesson` for each lesson. Put your textbooks and lecture notes in `Sources/`: the
   tutor checks facts there first.

### With Claude Code

1. Open Claude Code in the folder that will be (or already is) your vault and run
   **`/learning-curve:learn-setup`**. Claude asks the same questions and creates the workspace
   (`workspace_setup` tool).
2. From then on, start Claude Code in that folder: the tutor persona and your progress are loaded
   automatically at session start.
3. Same flow as pi, with the plugin prefix: `/learning-curve:style`, `/learning-curve:new-subject
   Calculus 1`, `/learning-curve:learn Derivatives`, `/learning-curve:lesson`…

An existing vault created with pi works in Claude Code as it is, and vice versa.

In Obsidian: Settings → Community plugins → turn off *Restricted mode*, then reload the vault so
the installed plugins load.

### A typical study session

```
/learn                 → resume the active topic (or the next one of the subject)
/review                → (if due) 5–10 minutes of spaced-repetition questions
/lesson                → the next lesson: a short guided walk in chat, the full note in Obsidian,
                         1–2 guided check questions
"I don't get §2.3"     → the tutor rewrites that section of the note in place
/quiz                  → checkpoint at the end of a block; every wrong answer → reinforcement note → retest
/progress              → where you are: lessons done, gaps, reviews due
```

## Claude Code

Everything works the same way, with these differences:

| | pi | Claude Code |
|---|---|---|
| Setup | `/learn-setup` wizard | `/learning-curve:learn-setup`: Claude asks the same questions, then runs `workspace_setup` |
| Commands | `/learn`, `/quiz`… | `/learning-curve:learn`, `/learning-curve:quiz`… (also without the prefix when no other plugin uses the name) |
| Quiz dialogs | pi dialogs with review screen | Forms at the bottom of the screen (MCP elicitation): answer field, "why?" field, option lists, review screen. A form shows only the first lines of a question, so the tutor writes the questions in chat first |
| Math in chat | rendered in the terminal (Unicode, full-size exponents) | terminal: the tutor writes Unicode (x², √x); VS Code extension: LaTeX rendered by KaTeX; desktop app: LaTeX between `$$` |
| Note check after writing | automatic | automatic (PostToolUse hook) |
| Status line | built in | optional, see below |

Optional status line (`~/.claude/settings.json`, adjust the path to where Claude Code installed the plugin, or
point it to your clone):

```json
{ "statusLine": { "type": "command", "command": "node /path/to/learning-curve/claude/run.mjs statusline" } }
```

Outside a learning workspace the plugin adds nothing to the conversation (no persona, no context);
its commands and skills stay available.

## Commands

In Claude Code every command has the `learning-curve:` prefix (`/learning-curve:learn`).

| Command | What it does | Example |
|---|---|---|
| `/learn-setup` | Create or reconfigure a learning workspace | `/learn-setup` |
| `/learn-plugins` | Manage Obsidian plugins anytime: install from the recommended list or search all community plugins, update, disable, remove | `/learn-plugins` |
| `/new-subject <name>` | Start a whole subject/course: goal interview (optionally your official syllabus), broad assessment, lesson kind, ordered syllabus of topics reusing topics you already have, optional final exam | `/new-subject Fisica 1` |
| `/learn [topic]` | Start or resume a topic — without arguments, continue the active subject with its next topic: assessment → plan → lessons → checkpoints → test | `/learn Integrali` |
| `/lesson [n]` | Next lesson (or lesson n) | `/lesson`, `/lesson 3` |
| `/quiz [scope]` | Quiz on the current lesson/block (first 1–2 questions guided) | `/quiz block 1` |
| `/exercises [scope]` | Practice set with folded hints and solutions | `/exercises limits` |
| `/test [block\|topic]` | Block or topic test | `/test topic` |
| `/exam [subject]` | Final exam of a subject (all topics, questions that connect them) | `/exam Analisi 1` |
| `/grade <note>` | Grade answers you wrote directly in a quiz/exercise note | `/grade Quizzes/Quiz - L03 - 1` |
| `/reformulate <note or concept>` | Rewrite in place a section you did not understand | `/reformulate the factor theorem` |
| `/remember [concept or formula]` | Tips to remember it by reasoning (rebuild it, check it); the ones you like are added to the lesson | `/remember derivative of tan x` |
| `/review` | Today's spaced-repetition reviews | `/review` |
| `/style` | Learning-style interview | `/style` |
| `/progress` | Progress, open gaps, due reviews; refreshes the Dashboard | `/progress` |
| `/check-notes [path]` | Check notes (one, a folder, or the whole vault) for Obsidian formatting problems and optionally let the tutor fix them | `/check-notes Analisi 1` |

You can also just talk: "I don't get the second step of the dot product note" triggers a
reformulation; "let's practise" proposes exercises; "give me a trick for the chain rule" gives
memory aids.

## How it teaches

- **Assessment first** — an adaptive interview and diagnostic quiz (with "why?"
  follow-ups) for the topic and its prerequisites.
- **Study plan** — blocks and lessons sorted by increasing difficulty; big topics are
  split; you approve before the first lesson.
- **Lessons** — organised by concept, in numbered sections (`1.`, `1.1`, …) whose titles
  say what you are reading ("Why factor", "Factoring methods", "Worked example", "Recap").
  The lesson opens with a real problem and when you need the idea; then each concept goes
  intuition → its formal, official statement in a blue box (definition, theorem, property,
  identity or algorithm, with hypotheses and a source) → folded proof → example → the trap
  right next to it. Then a worked example, check questions with folded answers, and a recap
  (key ideas + how to remember them). Boxes have one meaning each, headings are followed by a
  blank line, and the note checker reports numbering gaps.
- **Remembering by reasoning** — every lesson recap has a *How to remember it* part with 2–4
  verified tips: rebuild the result in 30 seconds, sanity checks (units, limit cases,
  symmetry, special values), patterns, visual anchors, links to known results; mnemonics
  only for pure conventions. Reviews offer the trick when you forget, reinforcement notes
  aim a tip at the exact mistake, flashcards train the tricks, and the tips that work for
  you are learned over time.
- **Your style** — the learning-style interview plus observations during lessons decide
  between pictures, analogies, numbers-first or derivation-first explanations.
- **Verification** — every computed result is checked with `math_check` (SymPy), and
  factual claims are checked with `source_lookup` (see *Fact checking*).
- **Quizzes** — guided questions first, then independent; the reasoning is graded, not
  only the result. Before submitting, a **review screen** lists every answer: reopen any
  question to change the answer or the "why" (pre-filled; Esc keeps it). The tutor sees
  which answers changed and the first answer, and uses it in the feedback. Pass = score ≥ 80 % **and** no open gaps: every wrong or badly reasoned
  answer opens a gap → reinforcement note → targeted retest.
- **Spaced repetition** — SM-2 scheduling of every quizzed concept; `/review` asks fresh
  reasoning questions. Flashcards (one `Flashcards.md` per topic: a numbered section per lesson, one heading per card, question / `?` / answer) can also be reviewed inside Obsidian with the Spaced Repetition plugin.
- **Visuals** — Manim animations, matplotlib plots, Desmos graphs, TikZ diagrams, Mermaid.

## Lesson kinds

Each subject has a **lesson kind**: the template its lessons follow. The tutor proposes one when
a subject starts (`/new-subject`) and you confirm; a single topic can use a different one (e.g. a
programming topic inside a math course).

| Kind | Sections | Checked with |
|---|---|---|
| `math` | why → concept groups (intuition → definition/theorem → proof → example → trap) → worked example → check → recap | SymPy |
| `physics` | phenomenon → model (assumptions, quantities and units) → laws (with validity conditions) → solving problems → limits of the model | SymPy units, CODATA, orders of magnitude |
| `cs` | problem → definitions → algorithm (idea, pseudocode, trace) → correctness (invariant) → cost → tested implementation | `code_run`, recurrences in SymPy |
| `programming` | the task → core concepts (runnable example, real output, official syntax/API, common error) → build it step by step → debugging → exercises with tests → good practices → cheat sheet | `code_run` on every snippet |
| `generic` | any other subject | sources |

**Programming languages**: you choose the language (and version); the tutor writes every example,
exercise and quiz in it. `code_run` runs Python, JavaScript, TypeScript, SQL (SQLite), Bash,
PowerShell, C, C++, Java, Go, Rust, C#, Ruby, PHP, R, Julia, Lua, Perl, Haskell and Kotlin, and any
other language through a custom command. When a toolchain is missing the tutor shows how to
install it (winget / brew / apt) and installs it only if you agree.

**Custom kinds**: for subjects that fit none (history, languages, a lab course…) the tutor drafts a
template with you and saves it in `.learning-curve/templates/lesson-<kind>.md`; a file named like a
built-in kind (`lesson-physics.md`) overrides it for this vault.

## Tools of the tutor

The agent uses these tools (in Claude Code they come from the plugin's MCP server):

| Tool | Function |
|---|---|
| `learning_state` | Subjects, syllabus, topics, assessments, study plans, lesson status, lesson kinds, canonical note paths, progress |
| `quiz_ask` | Interactive questions (multiple choice, numeric, short, open, proof), guided hints, "why?", review before submitting |
| `quiz_record` | Grades an attempt: score, pass/fail, opens a gap for every wrong or badly reasoned answer, schedules reviews |
| `learner_profile` | Knowledge level per concept and observations of what explanations work for you |
| `review_queue` | Spaced-repetition queue (SM-2): due items, outcomes, rescheduling |
| `math_check` | Runs SymPy/NumPy/SciPy scripts to verify every computation before it is written or graded |
| `code_run` | Runs code in the language you chose (20 built-in languages + custom commands); checks and suggests toolchains |
| `source_lookup` | Fact checking in your `Sources/` and in reference sources (see *Fact checking*) |
| `plot_render` / `manim_render` | Matplotlib figures and Manim animations saved in the lesson's `media/` folder |
| `note_check` | Obsidian formatting check of a note, a folder or the vault (also automatic after every write) |
| `tutor_context`, `workspace_setup`, `obsidian_plugins` | Claude Code only: what pi does with its wizards |

## Technologies

| Technology | Function in Learning Curve |
|---|---|
| **pi** (extension API, TUI) | Host agent: tools, commands, dialogs, system prompt, terminal math rendering |
| **Claude Code** (plugins, MCP, hooks, elicitation) | Second host: tool server over MCP (stdio), SessionStart/PostToolUse hooks, quiz forms |
| **TypeScript on Node.js** (type stripping, no build step, no runtime dependencies) | All the plugin code; one platform-neutral core shared by both hosts |
| **Obsidian** + Markdown, YAML properties, callouts, wikilinks | Where the notes live; Dataview queries, folder notes, flashcards |
| **LaTeX** (MathJax in Obsidian, KaTeX in Claude Code's VS Code extension, Unicode in terminals) | All math in notes and chat; vault macros in `preamble.sty` |
| **Python** in a workspace venv created with **uv** | Runs the verification and drawing tools |
| **SymPy, NumPy, SciPy** | `math_check`: exact and numeric verification of results, derivations, units |
| **matplotlib**, **Manim** (+ MiKTeX for formulas in videos) | Plots and animations embedded in lessons |
| **pypdf** | Reads your PDF textbooks for fact checking, with page citations |
| **NIST CODATA, NIST DLMF, OEIS, Encyclopedia of Mathematics, Wikipedia, nLab, arXiv, Crossref** | Reference sources for facts, constants, formulas, papers |
| **SM-2** (spaced-repetition algorithm) | Schedules reviews of every quizzed concept |
| **Obsidian plugins** (Spaced Repetition, Dataview, Latex Suite, Extended MathJax, TikZJax, Desmos, Excalidraw…) | Flashcard review, dashboards, faster LaTeX, diagrams and graphs inside Obsidian |
| **Mermaid** | Topic maps of a subject (built into Obsidian) |
| Language toolchains (Python, Node.js, GCC, JDK, Go, Rust, .NET…) | `code_run` for programming and computer-science lessons |

## Math in the terminal (pi)

pi renders `$…$` and `$$…$$` in chat as Unicode: stacked fractions, limits under `lim`/`∑`,
integral bounds, matrices, aligned equations (`√(x²+1) ≤ x+1, x ∈ ℝ`). The plugin adds:

- **Vault macros**: formulas using `preamble.sty` macros (`\vb`, `\R`, `\dd`, `\abs`, `\norm`,
  `\pdv`, … and any `\newcommand` you add) are expanded just before display, so they render
  too. Display-only: notes and what the model sees are unchanged.
- **Full-size exponents**: `2^3 · 2^4`, `x^(n+1)` instead of pi's small Unicode superscripts
  (`2³`), in chat and in quiz dialogs; fraction layouts stay aligned. Set `mathExponents` to
  `"superscript"` to get pi's default back.
- **Quiz dialogs**: math in questions, options and hints is shown rendered; the tutor still
  receives the original LaTeX of the chosen option.

In Claude Code, chat math depends on the client (see *Claude Code*).

Formulas that use something the terminal renderer cannot draw (or that are wider than the
terminal) are shown as LaTeX source.

## Obsidian formatting

Parts the plugin generates (properties, Dashboard, syllabus and lesson tables, links,
embeds, tags, Mermaid maps) are written by code. Notes the tutor writes follow the
`notes-obsidian` rules and templates, and **every write or edit is checked
automatically**; the tutor fixes reported errors immediately. The checker covers:

- YAML properties: closed frontmatter, `key: value` syntax, quotes and lists, values with
  `: ` or `#`, wikilinks in properties, duplicates, required properties per note type,
  unfilled `{{placeholders}}`;
- math: unbalanced `$`/`$$`, `\(…\)`/`\[…\]`, spaces inside `$ … $`;
- callouts: lines missing the `>` prefix (fatal for `$$` blocks), unknown types;
- tables: unescaped wikilink pipes;
- links: embeds of missing files (error), links to notes that do not exist yet (warning),
  relative `../` links;
- footnotes without definition, unclosed code blocks, more than one `#` title, broken
  generated sections.

Code blocks, inline code and `%% comments %%` are ignored. Run `/check-notes` anytime
(e.g. after editing notes by hand).

## Fact checking

Statements that are not computed — exact theorem statements and **hypotheses**,
definitions and conventions, physical constants, data, names, dates, history — are
checked with `source_lookup` before they go into a note, in this order:

1. **Your sources**: put textbooks, lecture notes and syllabi (PDF with a text layer,
   Markdown, text) in the vault folder `Sources/` (subfolders per subject are fine).
   PDFs are read once (pypdf) and cited with a link to the exact page,
   e.g. `[[Sources/Analisi 1/Book.pdf#page=212|Book, p. 212]]`. Your book's convention wins.
2. **Official references**: NIST CODATA (physical constants), NIST DLMF (special
   functions, identities — formulas come back as LaTeX with their hypotheses), OEIS.
3. **Reference encyclopedias**: Encyclopedia of Mathematics, Wikipedia (any language),
   nLab.
4. **Literature**: arXiv, Crossref (DOIs); any specific URL.

Checked statements get footnotes and a **Sources** section in the note (plus a
`sources:` property); anything that cannot be confirmed is marked with a
`[!warning] Not verified` callout. Lookups are cached in the workspace. ProofWiki is not
used: it blocks automated access.

## Subjects and shared topics

A **subject** is a course with an ordered syllabus of topics. Every topic lives in **one**
home subject folder; other subjects that need it **link** it instead of copying it
(e.g. *Derivatives* lives in *Calculus 1* and is linked by *Physics 1*). When a subject
needs a known topic from a different angle, the tutor adds a short **bridge topic**
(e.g. *Vectors in physics*) that builds on the original. The subject index note shows
the syllabus (↗ marks shared topics), a Mermaid topic map and the final-exam status;
notes carry `subjects: [...]` so Dataview finds shared topics from every subject.

## Vault layout

```
<Vault>/
├── .learning-curve/          config, state, Python venv, Manim sources (hidden in Obsidian)
├── 00 Learner/               Profile, Learning Style, Dashboard
├── Sources/                  your textbooks, lecture notes, syllabi (fact-checking sources)
├── preamble.sty              shared LaTeX macros (Extended MathJax)
└── <Subject>/
    ├── <Subject>.md          subject index: syllabus, topic map, final exam
    ├── Exams/                final exams
    └── NN - <Topic>/         home of the topic, numbered in syllabus order (other subjects link it)
        ├── NN - <Topic>.md   topic index (folder note)
        ├── Study Plan.md
        ├── Flashcards.md     flashcards of the topic, one section per lesson (if enabled)
        ├── Lessons/NN - Title/   lesson note, reinforcement notes, media/
        └── Quizzes/  Tests/  Exercises/
```

Topic folders are numbered like lessons (`01 - Richiami di algebra`, `02 - Insiemi e
funzioni`, …) so Obsidian shows them in syllabus order. When the syllabus changes, folders
are renumbered and every link in your notes is updated. Vaults created before 0.9 are asked
once at startup; to opt out later set `"numberTopicFolders": false` in
`.learning-curve/config.json`.

## Recommended Obsidian plugins

Chosen from the official community-plugin download statistics, filtered for quality of
life, LaTeX, graphs and math. Preselected: Latex Suite, Extended MathJax, TikZJax, Desmos,
Excalidraw, Spaced Repetition, Dataview, Folder notes, Omnisearch, Homepage, Advanced
Tables. Optional: Charts, Media Extended, Execute Code, Templater, Git, Style Settings,
Iconize. MathJax, callouts, Mermaid and video embeds are built into Obsidian.

Add more later with **`/learn-plugins`**: it installs from the recommended list or from
the whole Obsidian community catalog (searched by name, id or keywords, most downloaded
first), updates, disables (keeping settings) or removes plugins. The tutor only uses
plugin-specific blocks (Desmos, TikZ, Dataview, charts, flashcards) for plugins that are
enabled; plugins installed from Obsidian's own browser are detected too. Reload Obsidian
after changes.

## Configuration

`.learning-curve/config.json` in the vault:

| Key | Default | Meaning |
|---|---|---|
| `notesLanguage` | from setup | Language of the notes (chat follows your language) |
| `passThreshold` | `0.8` | Minimum quiz/test score |
| `flashcards` | from setup | Flashcards note per topic (Spaced Repetition plugin) |
| `mathExponents` | `"caret"` | Exponents in the terminal: `"caret"` shows them full size (`2^3`, `x^(n+1)`); `"superscript"` keeps pi's small Unicode (`2³`) |
| `learnerFolder` | `00 Learner` | Folder of profile notes |
| `python` | from setup | Interpreter and detected capabilities (SymPy, matplotlib, Manim, LaTeX) |

Recommended model: a strong reasoning model with high thinking (e.g. Claude Opus, high).

## TODO

Ideas and known gaps for future development:

- [ ] **Tablet whiteboard** (`/tablet`): a page served on the local Wi-Fi where you write with an
      Apple Pencil or upload screenshots; each step is sent to the tutor, which sees the whole
      resolution process (designed, postponed).
- [ ] **More built-in lesson kinds**: chemistry (reactions, balancing, safety), humanities
      (sources, timelines, arguments), foreign languages (vocabulary, grammar, dialogues).
- [ ] **Topic folder numbering in Claude Code** for vaults created before 0.9: pi asks once at
      start-up; Claude Code only applies it when already enabled.
- [ ] **Continuous integration**: tests and typecheck on GitHub Actions (Windows, macOS, Linux).
      Development and live tests so far ran on Windows.
- [ ] **Screenshots / short demo** in this README (lesson note, quiz form, dashboard).
- [ ] **Listings**: publish in the pi package gallery and submit to Claude Code plugin marketplaces.
- [ ] **Source adapters**: arXiv and the Encyclopedia of Mathematics failed during tests (no
      response, HTTP 502); add retries and fallbacks.
- [ ] **Claude Code quiz forms**: a form shows only the first lines of a question (the tutor
      writes questions in chat first); revisit if Claude Code adds multi-line form messages.

## Development

```bash
npm install                    # type definitions for development only (no runtime dependencies)
npm test                       # node --test: core logic, tools, MCP protocol, hooks, templates
npm run typecheck
pi -e ./extensions/index.ts    # try it in pi without installing (run inside a workspace)
claude --plugin-dir .          # try it in Claude Code without installing (run inside a workspace)
claude plugin validate .       # check the Claude Code plugin manifest, commands and skills
```

The repository has no lockfile on purpose: Claude Code runs `npm ci` when a plugin ships one.
See [docs/DESIGN.md](docs/DESIGN.md) for the architecture and [CHANGELOG.md](CHANGELOG.md) for
the history.

## License

MIT
