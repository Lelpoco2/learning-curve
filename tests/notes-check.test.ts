import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setPlan } from "../extensions/lib/curriculum.ts";
import { refreshGenerated, scaffoldLearner, scaffoldSubject, scaffoldTopic } from "../extensions/lib/notes.ts";
import { setSyllabus } from "../extensions/lib/subjects.ts";
import { emptyState, type LcConfig } from "../extensions/lib/types.ts";
import { saveConfig, type Workspace } from "../extensions/lib/workspace.ts";
import { checkScope } from "../extensions/notes-check.ts";

function workspace(): Workspace {
	const root = mkdtempSync(join(tmpdir(), "lc-check-"));
	const config: LcConfig = {
		version: 1,
		app: { id: "obsidian", name: "Obsidian" },
		notesRoot: ".",
		notesLanguage: "Italiano",
		passThreshold: 0.8,
		learnerFolder: "00 Learner",
		flashcards: true,
		createdAt: "x",
		updatedAt: "x",
	};
	saveConfig(root, config);
	return { root, dataDir: join(root, ".learning-curve"), config };
}

test("every note the plugin generates passes the checker", () => {
	const ws = workspace();
	const state = emptyState();
	const D = "2026-11-09";
	setSyllabus(state, "Analisi 1", [{ topic: "Limiti", difficulty: 2 }, { topic: "Derivate", difficulty: 3, prerequisites: ["Limiti"] }], { goal: 'Esame "Analisi 1": scritto e orale', finalExam: true }, D);
	setSyllabus(state, "Fisica 1", [{ topic: "Derivate", home: "Analisi 1", difficulty: 2 }, { topic: "Cinematica", difficulty: 3 }], {}, D);
	setPlan(state, "Analisi 1", "Derivate", [{ name: "Base", lessons: [{ title: "Rapporto incrementale", difficulty: 1 }, { title: "Teorema di Lagrange", difficulty: 3 }] }], D);
	state.attempts.push({ id: "a", kind: "exam", subject: "Analisi 1", scope: "Final", note: "Analisi 1/Exams/Exam - Final - 1.md", date: D, score: 0.9, passed: true, questions: [] });
	scaffoldLearner(ws);
	for (const s of Object.values(state.subjects)) scaffoldSubject(ws, s);
	for (const t of Object.values(state.topics)) scaffoldTopic(ws, t);
	refreshGenerated(ws, state);

	const { reports, checked } = checkScope(ws);
	assert.ok(checked >= 9, `checked ${checked}`);
	const errors = reports.flatMap((r) => r.issues.filter((i) => i.severity === "error").map((i) => `${r.file}:${i.line} ${i.message}`));
	assert.deepEqual(errors, []);
	// Only expected warnings: links to notes that will be written later (study plans, lessons, exams).
	const unexpected = reports.flatMap((r) => r.issues.filter((i) => i.severity === "warning" && i.rule !== "link").map((i) => `${r.file}:${i.line} ${i.message}`));
	assert.deepEqual(unexpected, []);
});

test("checkScope limits to a note or folder and rejects paths outside the vault", () => {
	const ws = workspace();
	writeFileSync(join(ws.root, "Bad.md"), "Testo con $ x $ sbagliato.\n");
	writeFileSync(join(ws.root, "Good.md"), "Testo con $x$.\n");
	assert.equal(checkScope(ws, "Good.md").reports.length, 0);
	assert.equal(checkScope(ws, "Bad").reports[0].issues[0].rule, "math");
	assert.equal(checkScope(ws).checked, 2);
	assert.throws(() => checkScope(ws, "../outside.md"), /inside the vault/);
});
