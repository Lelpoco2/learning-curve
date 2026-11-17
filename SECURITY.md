# Security Policy

## Supported versions

Learning Curve is in active development (0.x). Security fixes are made on the latest release only.

| Version | Supported |
|---|---|
| 0.14.x (latest) | ✅ |
| < 0.14 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Report them privately:

1. **GitHub private vulnerability reporting** (preferred): go to the repository's
   [Security tab → Report a vulnerability](https://github.com/Lelpoco2/learning-curve/security/advisories/new).
2. Or email **alessio.divizia.dev@gmail.com** with the subject `[learning-curve security]`.

Include what you found, the affected version, the agent (pi or Claude Code), steps to reproduce
or a proof of concept, and the impact you see. You will get an acknowledgement within
**7 days** and an assessment within **14 days**. Once a fix is released you will be credited in
the changelog and the advisory, unless you prefer to stay anonymous.

## What Learning Curve does that matters for security

Knowing the intended behaviour helps telling a vulnerability from a feature:

- **It runs code on your machine, by design.** `math_check`, `plot_render`, `manim_render` and
  `code_run` execute scripts written by the agent (or by you, when grading exercises) with your
  user's permissions, in a temporary folder of the workspace. They are not sandboxed. Your agent's
  permission settings (pi, Claude Code) decide whether these tool calls need your approval.
- **It installs software only with consent.** Toolchains (compilers, interpreters, MiKTeX) and
  the Python environment are installed only after you agree; Obsidian plugins are downloaded
  from their official GitHub releases when you choose them.
- **It reads the web for fact checking.** `source_lookup` fetches reference sites (Wikipedia,
  NIST, arXiv…) and any URL the agent passes. Fetched text is treated as untrusted content.
- **It writes inside the vault.** Note paths are resolved inside the workspace; tools refuse
  paths outside it.
- **Claude Code integration** runs a local MCP server over stdio and two hooks (session start,
  after Write/Edit); nothing listens on the network.

## In scope

- Path traversal: any way to make a tool read or write outside the workspace/vault.
- Code execution **without** a tool call the agent made (e.g. through a crafted note, source
  file, plugin manifest, PDF or downloaded catalog).
- Prompt injection through fetched sources or your `Sources/` files that makes the tutor run
  code or change files outside the learning flow, where Learning Curve's own instructions or
  tools make it easier.
- Downloads not coming from the expected origin, or installs without consent.
- Leaks of local data (notes, state, configuration) to the network.

## Out of scope

- Code that runs because you (or your agent with your approval) asked `code_run`/`math_check`
  to run it.
- Vulnerabilities in pi, Claude Code, Obsidian, its community plugins, Python packages or
  language toolchains themselves — please report them to those projects.
- Social engineering, and issues needing an already compromised machine.
