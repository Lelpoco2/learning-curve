import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setPlan } from "../extensions/lib/curriculum.ts";
import { scaffoldTopic } from "../extensions/lib/notes.ts";
import { topicFolder } from "../extensions/lib/paths.ts";
import { desiredOrder, pendingRenames, renumberTopics, rewriteReferences } from "../extensions/lib/renumber.ts";
import { setSyllabus } from "../extensions/lib/subjects.ts";
import { emptyState, type LcConfig } from "../extensions/lib/types.ts";
import type { Workspace } from "../extensions/lib/workspace.ts";

const D = "2026-11-09";
const moves = [{ subject: "Analisi 1", from: "Derivate", to: "10 - Derivate" }];

test("topicFolder numbers only topics with an order", () => {
	assert.equal(topicFolder({ topic: "Derivate" }), "Derivate");
	assert.equal(topicFolder({ topic: "Derivate", order: 3 }), "03 - Derivate");
});

test("rewriteReferences updates links, embeds, index links, escaped table pipes and Dataview paths", () => {
	const note = [
		"[[Analisi 1/Derivate/Lessons/01 - Rapporto/01 - Rapporto|lezione]]",
		"![[Analisi 1/Derivate/Lessons/01 - Rapporto/media/plot.png|400]]",
		"[[Analisi 1/Derivate/Derivate|indice]] e [[Analisi 1/Derivate/Derivate#Lessons]]",
		"| 1 | [[Analisi 1/Derivate/Study Plan\\|Piano]] |",
		"[[Derivate]] e [[Derivate|alias]]",
		'FROM "Analisi 1/Derivate"',
		"[[Analisi 1/Derivate parziali/x]] [[Fisica 1/Derivate/y]] [[Analisi 1/Limiti/Limiti]]",
	].join("\n");
	assert.equal(
		rewriteReferences(note, moves),
		[
			"[[Analisi 1/10 - Derivate/Lessons/01 - Rapporto/01 - Rapporto|lezione]]",
			"![[Analisi 1/10 - Derivate/Lessons/01 - Rapporto/media/plot.png|400]]",
			"[[Analisi 1/10 - Derivate/10 - Derivate|indice]] e [[Analisi 1/10 - Derivate/10 - Derivate#Lessons]]",
			"| 1 | [[Analisi 1/10 - Derivate/Study Plan\\|Piano]] |",
			"[[10 - Derivate]] e [[10 - Derivate|alias]]",
			'FROM "Analisi 1/10 - Derivate"',
			"[[Analisi 1/Derivate parziali/x]] [[Fisica 1/Derivate/y]] [[Analisi 1/Limiti/Limiti]]",
		].join("\n"),
	);
});

function workspace(): Workspace {
	const root = mkdtempSync(join(tmpdir(), "lc-renum-"));
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
	return { root, dataDir: join(root, ".learning-curve"), config };
}

test("existing unnumbered folders are renamed in syllabus order with every reference updated", () => {
	const ws = workspace();
	const state = emptyState();
	setSyllabus(state, "Analisi 1", ["Richiami di algebra", "Insiemi e funzioni", "Limiti"].map((topic) => ({ topic, difficulty: 2 })), {}, D);
	setSyllabus(state, "Fisica 1", [{ topic: "Limiti", home: "Analisi 1", difficulty: 2 }, { topic: "Cinematica", difficulty: 3 }], {}, D);
	const algebra = setPlan(state, "Analisi 1", "Richiami di algebra", [{ name: "B", lessons: [{ title: "Potenze", difficulty: 1 }] }], D);
	for (const t of Object.values(state.topics)) scaffoldTopic(ws, t); // old layout: no numbers
	assert.ok(existsSync(join(ws.root, "Analisi 1", "Richiami di algebra", "Richiami di algebra.md")));
	const lessonDir = join(ws.root, "Analisi 1", "Richiami di algebra", "Lessons", "01 - Potenze");
	mkdirSync(lessonDir, { recursive: true });
	writeFileSync(join(lessonDir, "01 - Potenze.md"), "Vedi [[Analisi 1/Limiti/Limiti|limiti]] e [[Analisi 1/Richiami di algebra/Study Plan|piano]].\n");
	state.gaps.push({ id: "g", concept: "potenze", topicKey: "Analisi 1/Richiami di algebra", opened: D, openedBy: "a", status: "open", reinforcement: "Analisi 1/Richiami di algebra/Lessons/01 - Potenze/Reinforcement - potenze.md" });

	assert.deepEqual([...desiredOrder(state, "Analisi 1").values()], [1, 2, 3]);
	assert.equal(pendingRenames(state, ws.root).length, 4); // 3 in Analisi 1 + Cinematica in Fisica 1

	const r = renumberTopics(state, ws.root);
	assert.equal(r.moved.length, 4);
	assert.deepEqual(readdirSync(join(ws.root, "Analisi 1")).sort(), ["01 - Richiami di algebra", "02 - Insiemi e funzioni", "03 - Limiti", "Analisi 1.md"]);
	assert.ok(existsSync(join(ws.root, "Analisi 1", "03 - Limiti", "03 - Limiti.md")), "index note renamed with its folder");
	const cards = readFileSync(join(ws.root, "Analisi 1", "03 - Limiti", "Flashcards.md"), "utf8");
	assert.match(cards, /^#flashcards\/analisi-1\/limiti$/m, "topic flashcards note with its deck tag");
	assert.match(cards, /\[\[Analisi 1\/03 - Limiti\/03 - Limiti\|Limiti\]\]/, "back link follows the rename");
	assert.match(readFileSync(join(ws.root, "Analisi 1", "03 - Limiti", "03 - Limiti.md"), "utf8"), /\[\[Analisi 1\/03 - Limiti\/Flashcards\|Flashcards\]\]/, "topic index links the flashcards");
	assert.ok(existsSync(join(ws.root, "Fisica 1", "01 - Cinematica")), "linked topics are numbered only in their home subject");
	const lesson = readFileSync(join(ws.root, "Analisi 1", "01 - Richiami di algebra", "Lessons", "01 - Potenze", "01 - Potenze.md"), "utf8");
	assert.equal(lesson, "Vedi [[Analisi 1/03 - Limiti/03 - Limiti|limiti]] e [[Analisi 1/01 - Richiami di algebra/Study Plan|piano]].\n");
	const index = readFileSync(join(ws.root, "Analisi 1", "01 - Richiami di algebra", "01 - Richiami di algebra.md"), "utf8");
	assert.match(index, /FROM "Analisi 1\/01 - Richiami di algebra"/);
	assert.equal(state.gaps[0].reinforcement, "Analisi 1/01 - Richiami di algebra/Lessons/01 - Potenze/Reinforcement - potenze.md");
	assert.equal(algebra.order, 1);

	// Idempotent.
	assert.equal(renumberTopics(state, ws.root).moved.length, 0);

	// Reordering the syllabus renumbers; new topics just get a number (created later, numbered).
	setSyllabus(state, "Analisi 1", ["Insiemi e funzioni", "Richiami di algebra", "Numeri reali", "Limiti"].map((topic) => ({ topic, difficulty: 2 })), {}, D);
	const r2 = renumberTopics(state, ws.root, ["Analisi 1"]);
	assert.deepEqual(r2.moved.map((m) => `${m.from} → ${m.to}`).sort(), ["01 - Richiami di algebra → 02 - Richiami di algebra", "02 - Insiemi e funzioni → 01 - Insiemi e funzioni", "03 - Limiti → 04 - Limiti"]);
	assert.equal(state.topics["Analisi 1/Numeri reali"].order, 3);
	scaffoldTopic(ws, state.topics["Analisi 1/Numeri reali"]);
	assert.ok(existsSync(join(ws.root, "Analisi 1", "03 - Numeri reali", "03 - Numeri reali.md")));
	assert.match(readFileSync(join(ws.root, "Analisi 1", "02 - Richiami di algebra", "Lessons", "01 - Potenze", "01 - Potenze.md"), "utf8"), /\[\[Analisi 1\/04 - Limiti\/04 - Limiti\|limiti\]\]/);
});

test("a rename onto an existing folder is reported as a conflict and leaves the topic as it was", () => {
	const ws = workspace();
	const state = emptyState();
	setSyllabus(state, "Analisi 1", [{ topic: "Limiti", difficulty: 2 }], {}, D);
	scaffoldTopic(ws, state.topics["Analisi 1/Limiti"]);
	mkdirSync(join(ws.root, "Analisi 1", "01 - Limiti"), { recursive: true });
	const r = renumberTopics(state, ws.root);
	assert.equal(r.conflicts.length, 1);
	assert.equal(state.topics["Analisi 1/Limiti"].order, undefined);
	assert.ok(existsSync(join(ws.root, "Analisi 1", "Limiti", "Limiti.md")));
});
