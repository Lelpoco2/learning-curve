/** note_check tool (platform-neutral). */

import { checkScope, summarize } from "../lib/notecheck.ts";
import { Type } from "../lib/schema.ts";
import { defineTool } from "../lib/tool.ts";
import { requireWorkspace, textResult } from "../runtime.ts";

export const noteCheckTools = [
	defineTool({
		name: "note_check",
		label: "Note check",
		description:
			"Check Obsidian notes for formatting problems: broken YAML properties, missing required properties, unclosed or badly delimited math ($, $$, \\( \\)), callout lines missing '>', unescaped wikilink pipes in tables, links/embeds to files that do not exist, unfilled {{placeholders}}, undefined footnotes, unclosed code blocks, broken generated sections, heading spacing and numbering, flashcard format. Checks one note, a folder or the whole vault.",
		parameters: Type.Object({
			path: Type.Optional(Type.String({ description: "Note or folder, relative to the vault (default: whole vault)" })),
		}),
		async execute(p) {
			const ws = requireWorkspace();
			const { reports, checked } = checkScope(ws, p.path);
			const s = summarize(reports, checked);
			return textResult(s.errors + s.warnings === 0 ? `Checked ${checked} note(s): no problems.` : s.text, { errors: s.errors, warnings: s.warnings });
		},
	}),
];
