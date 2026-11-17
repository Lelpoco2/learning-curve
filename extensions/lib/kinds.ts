/**
 * Lesson kinds: each subject (or topic) uses a lesson template suited to how it is learned.
 * Built-in kinds live in `templates/lessons/<kind>.md`; a vault can override them or add its own
 * in `.learning-curve/templates/lesson-<kind>.md` (hidden folder: never linted as a note).
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES_DIR } from "./notes.ts";
import type { LcState, Topic } from "./types.ts";
import type { Workspace } from "./workspace.ts";

export interface KindInfo {
	id: string;
	label: string;
	/** What the kind is for (shown when choosing). */
	use: string;
}

export const BUILTIN_KINDS: KindInfo[] = [
	{ id: "math", label: "Math", use: "definitions, theorems and proofs; computations checked with SymPy" },
	{ id: "physics", label: "Physics", use: "phenomenon → model and assumptions → laws → problem solving with units and estimates" },
	{ id: "cs", label: "Computer Science", use: "algorithms, data structures, complexity: specification, pseudocode, trace, correctness, cost, tested implementation" },
	{ id: "programming", label: "Practical programming", use: "a language or tool: runnable examples with real output, official syntax/API, debugging, exercises with tests" },
	{ id: "generic", label: "Generic", use: "any other subject: motivation, concepts with precise statements, examples, recap" },
];

export const DEFAULT_KIND = "math";

export function isValidKindId(id: string): boolean {
	return /^[a-z][a-z0-9-]{1,30}$/.test(id);
}

export function customTemplatesDir(ws: Workspace): string {
	return join(ws.dataDir, "templates");
}

/** Built-in and custom kinds available in the workspace. */
export function listKinds(ws: Workspace): (KindInfo & { source: "built-in" | "vault" | "vault override" })[] {
	const dir = customTemplatesDir(ws);
	const custom = existsSync(dir)
		? readdirSync(dir)
				.map((f) => f.match(/^lesson-([a-z][a-z0-9-]*)\.md$/)?.[1])
				.filter((x): x is string => !!x)
		: [];
	const out: (KindInfo & { source: "built-in" | "vault" | "vault override" })[] = BUILTIN_KINDS.map((k) => ({ ...k, source: custom.includes(k.id) ? "vault override" : "built-in" }));
	for (const id of custom) if (!BUILTIN_KINDS.some((k) => k.id === id)) out.push({ id, label: id, use: "custom kind of this vault", source: "vault" });
	return out;
}

/** Template file of a kind: the vault's own version first, then the built-in one. */
export function kindTemplate(ws: Workspace, kind: string): { path: string; source: "vault" | "built-in" } | undefined {
	const own = join(customTemplatesDir(ws), `lesson-${kind}.md`);
	if (existsSync(own)) return { path: own, source: "vault" };
	const builtIn = join(TEMPLATES_DIR, "lessons", `${kind}.md`);
	return existsSync(builtIn) ? { path: builtIn, source: "built-in" } : undefined;
}

/** Path where a custom kind must be saved (folder created). */
export function customKindPath(ws: Workspace, kind: string): string {
	mkdirSync(customTemplatesDir(ws), { recursive: true });
	return join(customTemplatesDir(ws), `lesson-${kind}.md`);
}

/** Effective lesson kind and language of a topic: its own override, else its home subject's. */
export function topicKind(state: LcState, t: Topic): { kind: string; language?: string; explicit: boolean } {
	const s = state.subjects[t.subject];
	const kind = t.lessonKind ?? s?.lessonKind;
	return { kind: kind ?? DEFAULT_KIND, language: t.language ?? s?.language, explicit: kind !== undefined };
}
