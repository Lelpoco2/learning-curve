# Contributing to Learning Curve

Thanks for your interest! Learning Curve is a STEM tutor that runs in two agents — **pi** and
**Claude Code** — on one shared core. This guide explains how to set up the project, where
things live, and what a good contribution looks like.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — use the *Bug report* issue template. Say which agent (pi or Claude Code,
  and which Claude Code client), your OS, Node version, and the steps to reproduce.
- **Suggest a feature** — use the *Feature request* template. Explain the learning problem it
  solves, not only the feature.
- **Improve teaching material** — skills (`skills/*/SKILL.md`) and templates
  (`templates/`) are plain Markdown: better instructions, a new lesson kind, clearer examples.
- **Fix or add code** — see below. Small, focused pull requests are reviewed fastest.
- **Security issues** — do **not** open a public issue: see [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js ≥ 22.18 (TypeScript runs directly through type stripping, there is no
build step), git, and optionally [pi](https://pi.dev) and/or
[Claude Code](https://code.claude.com) to try changes live. Python (with
[uv](https://docs.astral.sh/uv/)) is only needed for the tools that run SymPy, matplotlib or
Manim.

```bash
git clone https://github.com/Lelpoco2/learning-curve
cd learning-curve
npm install          # type definitions for development only
npm test             # all tests (node --test)
npm run typecheck    # tsc --noEmit
```

Try your changes without installing anything, **inside a learning workspace** (a folder with
`.learning-curve/config.json`; create a throw-away one with `/learn-setup` in a temporary
folder — never test on your real vault):

```bash
pi -e ./extensions/index.ts            # pi
claude --plugin-dir /path/to/learning-curve   # Claude Code
claude plugin validate .               # Claude Code manifest, commands and skills
```

## Project layout

| Path | What it is |
|---|---|
| `extensions/lib/` | Platform-neutral core: state, notes, note checker, lesson kinds, code runners, sources, spaced repetition, setup. **No pi imports.** |
| `extensions/tools/` | Every tool defined once with `defineTool` (`lib/tool.ts`), platform-neutral |
| `extensions/pi-tools.ts`, `extensions/*.ts` | pi adapter and pi-only features (persona injection, commands, wizards, terminal math, status) |
| `claude/` | Claude Code adapter: MCP server, hooks, platform notes, status line, launcher |
| `skills/` | Agent Skills shared by both agents (`SKILL.md`) |
| `templates/` | Note templates; `templates/lessons/<kind>.md` are the lesson kinds |
| `commands/` | Claude Code commands; `prompts/` are the pi equivalents |
| `.claude-plugin/`, `.mcp.json`, `hooks/` | Claude Code plugin packaging |
| `tests/` | `node --test` suites |
| `docs/DESIGN.md` | Architecture and design decisions |

## Rules that keep the project working

1. **Both agents.** A feature must work in pi *and* Claude Code, or degrade gracefully in one of
   them (say how in the PR). Tools are defined once in `extensions/tools/`; dialogs go through
   `UiPort` (pi dialogs / MCP elicitation forms).
2. **No runtime dependencies.** The plugin runs with Node's standard library only. Do not add
   `dependencies`, and do not commit a lockfile: Claude Code runs `npm ci` when a plugin ships
   one. Type definitions in `devDependencies` are fine.
3. **No pi imports outside the pi adapter.** `extensions/lib/`, `extensions/tools/` and
   `claude/` must load without pi installed (the tests check it implicitly through the MCP suite).
4. **Type stripping only.** Node runs the `.ts` files directly: no enums, namespaces, parameter
   properties or other syntax that needs a TypeScript compiler.
5. **Verified content.** Teaching rules require every computation to be checked
   (`math_check`), every snippet to be run (`code_run`) and facts to be sourced
   (`source_lookup`). Examples in skills and templates must be correct.
6. **Never test on real data.** Use temporary workspaces; tests create theirs in the OS temp
   folder.
7. **Notes stay valid Obsidian Markdown.** If you add a note feature, extend the note checker
   (`extensions/lib/lint.ts`) and its tests.

## Making a change

1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Fork the repository (or create a branch, if you have write access) from `master`. `master` is
   protected: changes reach it only through pull requests, and its history is never rewritten
   (force pushes and deletion are blocked for everyone).
3. Write or update tests next to the code you change (`tests/*.test.ts`). Every bug fix should
   come with a test that fails without the fix.
4. Run `npm test` and `npm run typecheck`; for Claude Code changes also `claude plugin validate .`.
5. Try it live in the agent(s) your change affects, in a temporary workspace.
6. Update the docs: `README.md` for user-facing changes, `docs/DESIGN.md` for architecture,
   and add an entry under a new version at the top of `CHANGELOG.md`.
7. Open a pull request using the template.

### Commit messages

Short, imperative, with a type prefix, e.g.:

```
feat: physics lesson template with dimensional checks
fix: quiz forms cut long questions in Claude Code
docs: table of contents in the README
test: MCP elicitation round trip
```

### Versioning

The project follows [semantic versioning](https://semver.org). The version lives in
`package.json` **and** `.claude-plugin/plugin.json` (a test checks they match). Maintainers tag
releases as `vX.Y.Z`.

## Writing skills and templates

- Skills are procedures for the agent: imperative, concise, one logical thread. Keep the YAML
  `name` and `description` accurate — agents choose skills from the description.
- Templates use `{{placeholders}}` filled by the tools; keep the frontmatter properties the
  dashboards rely on (`type`, `subject`, `topic`, `status`, `tags`…).
- Lesson templates carry their own rules in a leading HTML comment (sections, formal boxes,
  checks, quiz and flashcard style). New built-in kinds go in `templates/lessons/` and in
  `BUILTIN_KINDS` (`extensions/lib/kinds.ts`); `tests/kinds.test.ts` checks that every built-in
  template passes the note checker.

## Questions

Open a [discussion or issue](https://github.com/Lelpoco2/learning-curve/issues) — questions are
welcome.
