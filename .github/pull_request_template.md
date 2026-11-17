## What and why

<!-- What does this PR change, and which problem does it solve? Link the issue: "Closes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Teaching material (skills, templates, lesson kinds)
- [ ] Documentation
- [ ] Refactoring / tests / tooling

## Agents affected

- [ ] pi
- [ ] Claude Code (terminal / VS Code / desktop — say which you tried)
- [ ] Both — it works in both, or degrades gracefully in one (explain below)

## How it was tested

<!-- Commands you ran and what you checked live, in a temporary workspace (never a real vault). -->

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `claude plugin validate .` passes (if Claude Code files changed)
- [ ] Tried live in the affected agent(s)
- [ ] New or updated tests cover the change (bug fixes: a test that fails without the fix)

## Checklist

- [ ] No runtime dependencies added, no lockfile committed
- [ ] No pi imports outside the pi adapter (`extensions/lib`, `extensions/tools`, `claude/` load without pi)
- [ ] Only TypeScript syntax that Node's type stripping supports (no enums, namespaces, parameter properties)
- [ ] Math, code and facts in skills/templates/examples are verified
- [ ] Docs updated: README (user-facing), DESIGN (architecture), CHANGELOG entry
- [ ] Version bumped in `package.json` and `.claude-plugin/plugin.json` (if releasing)

## Notes for reviewers

<!-- Anything tricky, screenshots of notes/forms, follow-ups. -->
