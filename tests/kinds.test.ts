import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BUILTIN_KINDS, customKindPath, kindTemplate, listKinds, topicKind } from "../extensions/lib/kinds.ts";
import { lintNote } from "../extensions/lib/lint.ts";
import { fillTemplate } from "../extensions/lib/notes.ts";
import { setSyllabus } from "../extensions/lib/subjects.ts";
import { emptyState } from "../extensions/lib/types.ts";
import { loadWorkspace } from "../extensions/lib/workspace.ts";
import { setWorkspaceFromCwd } from "../extensions/runtime.ts";
import { registerStateTool } from "../extensions/pi-tools.ts";

function workspace() {
	const root = mkdtempSync(join(tmpdir(), "lc-kinds-"));
	mkdirSync(join(root, ".learning-curve"), { recursive: true });
	writeFileSync(
		join(root, ".learning-curve", "config.json"),
		JSON.stringify({ version: 1, app: { id: "obsidian", name: "Obsidian" }, notesRoot: ".", notesLanguage: "English", passThreshold: 0.8, learnerFolder: "00 Learner", flashcards: false, numberTopicFolders: true }),
	);
	return loadWorkspace(root)!;
}

test("every built-in kind has a template; vault files override or add kinds", () => {
	const ws = workspace();
	for (const k of BUILTIN_KINDS) assert.equal(kindTemplate(ws, k.id)?.source, "built-in", k.id);
	assert.equal(kindTemplate(ws, "history"), undefined);
	writeFileSync(customKindPath(ws, "history"), "---\ntype: lesson\nkind: history\n---\n");
	writeFileSync(customKindPath(ws, "math"), "---\ntype: lesson\nkind: math\n---\n");
	assert.equal(kindTemplate(ws, "history")?.source, "vault");
	assert.equal(kindTemplate(ws, "math")?.source, "vault");
	const list = listKinds(ws);
	assert.equal(list.find((k) => k.id === "math")?.source, "vault override");
	assert.equal(list.find((k) => k.id === "history")?.source, "vault");
});

test("a topic uses its own kind, else its home subject's, else math", () => {
	const state = emptyState();
	setSyllabus(state, "Analisi 1", [{ topic: "Limiti", difficulty: 2 }, { topic: "Metodi numerici", difficulty: 3 }], {}, "2026-11-09");
	const lim = state.topics["Analisi 1/Limiti"];
	const num = state.topics["Analisi 1/Metodi numerici"];
	assert.deepEqual(topicKind(state, lim), { kind: "math", language: undefined, explicit: false });
	state.subjects["Analisi 1"].lessonKind = "math";
	num.lessonKind = "programming";
	num.language = "Python 3.12";
	assert.equal(topicKind(state, lim).kind, "math");
	assert.deepEqual(topicKind(state, num), { kind: "programming", language: "Python 3.12", explicit: true });
});

test("built-in templates, once filled, pass the note check (numbering, spacing, code tags)", () => {
	const vars = { subject: "S", topic: "T", subjectsList: '"S"', n: 1, block: "B", difficulty: 2, concepts: "a", prerequisites: "", date: "2026-11-09", subjectTags: "subject/s", topicTag: "topic/t", title: "01 - L", language: "Python 3.12" };
	for (const k of BUILTIN_KINDS) {
		const ws = workspace();
		const text = fillTemplate(readFileSync(kindTemplate(ws, k.id)!.path, "utf8"), vars).replace(/```<language>/g, "```python");
		const issues = lintNote(text).filter((i) => i.severity === "error" || ["numbering", "heading", "code"].includes(i.rule));
		assert.deepEqual(issues, [], `${k.id}: ${issues.map((i) => `${i.line} ${i.rule} ${i.message}`).join("; ")}`);
		assert.match(text, new RegExp(`^kind: ${k.id}$`, "m"));
	}
});

test("learning_state set_kind: lists kinds, validates, sets subject kind/language and topic overrides", async () => {
	const ws = workspace();
	setWorkspaceFromCwd(ws.root);
	let exec: ((id: string, p: Record<string, unknown>) => Promise<{ content: { text: string }[] }>) | undefined;
	registerStateTool({ registerTool: (t: { execute: typeof exec }) => (exec = t.execute) } as never);
	const call = async (p: Record<string, unknown>) => (await exec!("x", p)).content[0].text;

	await call({ action: "set_syllabus", subject: "Python base", items: [{ topic: "Variabili", difficulty: 1 }, { topic: "Liste", difficulty: 2 }], lessonKind: "programming", language: "Python 3.12" });
	assert.match(await call({ action: "set_kind" }), /- physics \(built-in\)/);
	await assert.rejects(call({ action: "set_kind", subject: "Python base", lessonKind: "history" }), /No template for lesson kind "history"/);
	const paths = await call({ action: "paths", subject: "Python base", topic: "Variabili" });
	assert.match(paths, /Lesson kind: programming · language: Python 3\.12 · template: .*lessons\/programming\.md \(built-in\)/);
	assert.match(paths, /language="Python 3\.12" kind=programming/);
	const topic = await call({ action: "set_kind", subject: "Python base", topic: "Liste", lessonKind: "cs" });
	assert.match(topic, /Topic Liste: Lesson kind: cs · language: Python 3\.12 .*\(topic override\)/);
	const back = await call({ action: "set_kind", subject: "Python base", topic: "Liste", lessonKind: "inherit" });
	assert.match(back, /Lesson kind: programming .*\(from its subject\)/);
	assert.match(await call({ action: "subject_overview", subject: "Python base" }), /Lesson kind: programming · language: Python 3\.12/);
});
