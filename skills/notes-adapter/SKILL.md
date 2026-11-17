---
name: notes-adapter
description: Learn and use a note-taking app other than Obsidian (Logseq, Zettlr, Joplin, Notion, plain Markdown, others) - research or interview to build the app profile, then map the learning notes (structure, math, links, callouts, flashcards) onto what the app supports. Use when the workspace app is not Obsidian.
---

# Note app adapter

The learning content and structure never change; only the syntax and storage do.

## 1. Learn the app (once)

Read `.learning-curve/app-profile.md` in the workspace. If `status: to-learn`:

1. Start from the quick reference below if the app is listed.
2. Research what is missing: the app's official docs (fetch with `bash` + `curl` if
   network is available), otherwise ask the learner targeted questions:
   - Where are notes stored (folder of .md files, database, cloud)? Path?
   - Folders/notebooks/namespaces: how is a hierarchy expressed?
   - Math: is LaTeX rendered? Delimiters? Inline and block?
   - Links between notes and embeds of images/videos?
   - Metadata/properties? Tags syntax? Callout/admonition equivalent?
   - Flashcards or spaced-repetition plugin?
3. Write the profile: storage, hierarchy mapping (Subject → Topic → Lessons/…), syntax
   table (math, links, embeds, callouts, properties, tags, flashcards), limitations and
   workarounds. Set `status: learned`. Show a summary to the learner and confirm.
4. Write one small test note, ask the learner to open it in the app, and fix the profile
   from their feedback.

## 2. Use the profile

- Keep the same logical structure and templates; translate syntax per the profile.
- Callouts without native support → bold label + blockquote (`> **Definition —** …`).
- No video embeds → link to the file.
- No properties → a small metadata block at the top in the app's convention.
- Math must stay LaTeX. If the app cannot render it, keep `$…$` anyway (the learner can
  read it and it stays portable) and say so once.

## Quick references

**Zettlr** — plain .md files in folders; `$…$` / `$$…$$` (KaTeX); `[[wikilinks]]`
(by file name or ID); YAML frontmatter; tags `#tag`; images `![](path)`; no callouts
(use blockquotes); no built-in flashcards. Hierarchy = folders (same layout as Obsidian).

**Logseq** — outliner: every paragraph is a block starting with `- `; pages are files in
`pages/`; hierarchy via namespaces `Subject/Topic/Lesson` (file name uses `___` for `/`);
math `$$…$$` for both inline and display (KaTeX); properties `key:: value` on the first
block; links `[[Page]]`; admonitions `#+BEGIN_NOTE … #+END_NOTE` (also TIP, WARNING,
IMPORTANT); flashcards: block with `#card`, child blocks are the answer; cloze `{{cloze …}}`.

**Joplin** — notes in a database; write through the Data API (Web Clipper service,
`http://localhost:41184`, token in Options → Web Clipper) or import a folder of .md files.
Notebooks nest (Subject → Topic → Lessons); math `$…$` / `$$…$$` (KaTeX); links
`[title](:/noteId)`; resources via API; no callouts (blockquotes).

**Notion** — requires an integration (API token) or an MCP server; pages nest
(Subject → Topic → Lesson); equations are blocks/inline equations (LaTeX); callout blocks
exist; toggles for folded answers. Ask the learner to configure an MCP server or token
first; otherwise fall back to a Markdown folder export.

**Plain Markdown** — folders like the Obsidian layout; `$…$` / `$$…$$`; standard links
`[Title](relative/path.md)` (URL-encode spaces as `%20`); blockquote callouts;
images `![](media/plot.png)`; videos as links.
