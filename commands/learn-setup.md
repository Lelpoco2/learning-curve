---
description: "Learning Curve: create or reconfigure the learning workspace (note app, vault, language, plugins, Python)"
argument-hint: ""
---

Set up the Learning Curve workspace. Ask the learner one question at a time (use AskUserQuestion for the choices): 1) note-taking app (Obsidian recommended; Logseq, Zettlr, Joplin, plain Markdown, other); 2) vault folder (default: this project folder); 3) notes language; 4) Obsidian only: flashcards in a Flashcards note per topic (Spaced Repetition plugin)?; 5) Obsidian only: which plugins — call obsidian_plugins action recommended and offer the ★ ones as the default; 6) Python tools (SymPy, NumPy, SciPy, matplotlib, Manim, pypdf; needs uv; a few minutes)?; 7) only if they want Manim videos with formulas and LaTeX is missing: MiKTeX (about 1 GB)? Summarise the answers, then call workspace_setup once. Show its report. Then call tutor_context and propose the learning-style interview (/learning-curve:style). $ARGUMENTS
