import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findTopic, isEndOfBlock, nextLesson, setLessonStatus, setPlan } from "../extensions/lib/curriculum.ts";
import { attemptNotePath, lessonPaths, safeName, topicPaths } from "../extensions/lib/paths.ts";
import { mergeEnabledPlugins } from "../extensions/lib/plugins.ts";
import { emptyState } from "../extensions/lib/types.ts";
import { findWorkspaceRoot, replaceMarkedSection, saveConfig } from "../extensions/lib/workspace.ts";

const blocks = [
	{ name: "Vectors", lessons: [{ title: "What is a vector", difficulty: 1 }, { title: "Dot product", difficulty: 2 }] },
	{ name: "Matrices", lessons: [{ title: "Linear maps", difficulty: 3, concepts: ["linearity"] }] },
];

test("setPlan numbers lessons across blocks and keeps status on revision", () => {
	const state = emptyState();
	const t = setPlan(state, "Mathematics", "Linear Algebra", blocks, "2026-11-08");
	assert.deepEqual(t.lessons.map((l) => l.n), [1, 2, 3]);
	assert.equal(t.status, "in-progress");
	setLessonStatus(t, 2, "done", "2026-11-08");
	const revised = setPlan(
		state,
		"Mathematics",
		"Linear Algebra",
		[{ name: "Vectors", lessons: [{ title: "Dot product", difficulty: 2 }, { title: "Cross product", difficulty: 3 }] }],
		"2026-11-09",
	);
	assert.equal(revised.lessons[0].status, "done");
	assert.equal(revised.lessons[1].status, "planned");
});

test("nextLesson, end of block and topic completion", () => {
	const state = emptyState();
	const t = setPlan(state, "Math", "LA", blocks, "2026-11-08");
	assert.equal(nextLesson(t)?.n, 1);
	assert.equal(isEndOfBlock(t, 1), false);
	assert.equal(isEndOfBlock(t, 2), true);
	for (const n of [1, 2, 3]) setLessonStatus(t, n, "done", "2026-11-08");
	assert.equal(t.status, "done");
	assert.equal(nextLesson(t), undefined);
});

test("findTopic matches key, name and substring", () => {
	const state = emptyState();
	setPlan(state, "Mathematics", "Linear Algebra", blocks, "2026-11-08");
	assert.ok(findTopic(state, "Mathematics/Linear Algebra"));
	assert.ok(findTopic(state, "linear algebra"));
	assert.ok(findTopic(state, "algebra"));
	assert.equal(findTopic(state, "topology"), undefined);
});

test("safeName removes characters that break paths and links", () => {
	assert.equal(safeName('Eq: a/b? "x" #1 [y]'), "Eq a b x 1 y");
	assert.equal(safeName("  "), "Untitled");
	assert.equal(safeName("Ends with dot."), "Ends with dot");
});

test("vault paths follow subject/topic/lessons layout", () => {
	const tp = topicPaths("V", "Physics", "Kinematics");
	assert.equal(tp.topicIndex, join("V", "Physics", "Kinematics", "Kinematics.md"));
	const lp = lessonPaths("V", "Physics", "Kinematics", 3, "Projectile motion");
	assert.equal(lp.note, join("V", "Physics", "Kinematics", "Lessons", "03 - Projectile motion", "03 - Projectile motion.md"));
	assert.equal(attemptNotePath(tp, "test", "Block 1", 2), join(tp.testsDir, "Test - Block 1 - 2.md"));
});

test("replaceMarkedSection replaces in place or appends", () => {
	const a = replaceMarkedSection("# T\n", "x", "one");
	assert.match(a, /<!-- lc:x:begin -->\none\n<!-- lc:x:end -->/);
	const b = replaceMarkedSection(`${a}\nfooter\n`, "x", "two");
	assert.match(b, /two/);
	assert.doesNotMatch(b, /one/);
	assert.match(b, /footer/);
});

test("mergeEnabledPlugins keeps existing ids and tolerates bad JSON", () => {
	assert.deepEqual(JSON.parse(mergeEnabledPlugins('["a"]', ["b", "a"])), ["a", "b"]);
	assert.deepEqual(JSON.parse(mergeEnabledPlugins("{oops", ["b"])), ["b"]);
});

test("findWorkspaceRoot walks up to the config", () => {
	const root = mkdtempSync(join(tmpdir(), "lc-"));
	saveConfig(root, {
		version: 1,
		app: { id: "obsidian", name: "Obsidian" },
		notesRoot: ".",
		notesLanguage: "English",
		passThreshold: 0.8,
		learnerFolder: "00 Learner",
		flashcards: true,
		createdAt: "x",
		updatedAt: "x",
	});
	const deep = join(root, "Math", "LA");
	writeFileSync(join(root, "note.md"), "x");
	assert.equal(findWorkspaceRoot(root), root);
	assert.equal(findWorkspaceRoot(deep), root);
	assert.ok(readFileSync(join(root, ".learning-curve", "config.json"), "utf8").includes("obsidian"));
});

test("wikilinks escape the alias pipe inside tables", async () => {
	const { renderLessonsTable } = await import("../extensions/lib/render.ts");
	const state = emptyState();
	const t = setPlan(state, "Math", "LA", blocks, "2026-11-08");
	const table = renderLessonsTable("V", t);
	assert.match(table, /\[\[Math\/LA\/Lessons\/01 - What is a vector\/01 - What is a vector\\\|What is a vector\]\]/);
	// Every row keeps exactly 6 unescaped pipes (5 columns).
	for (const row of table.split("\n").slice(2)) assert.equal(row.replace(/\\\|/g, "").split("|").length - 1, 6);
});
