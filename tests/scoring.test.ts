import assert from "node:assert/strict";
import { test } from "node:test";
import { recordAttempt, scoreQuestions } from "../extensions/lib/scoring.ts";
import { emptyState, type QuestionResult } from "../extensions/lib/types.ts";

const yes = (concept: string, extra: Partial<QuestionResult> = {}): QuestionResult => ({ concept, correct: "yes", reasoning: "sound", ...extra });
const no = (concept: string, extra: Partial<QuestionResult> = {}): QuestionResult => ({ concept, correct: "no", ...extra });

test("guided questions are excluded from the score", () => {
	const r = scoreQuestions([no("a", { guided: true }), yes("b"), yes("c")], 0.8);
	assert.equal(r.score, 1);
	assert.equal(r.counted, 2);
	assert.equal(r.passed, true);
});

test("partial answers count half; flawed reasoning halves a right result", () => {
	const r = scoreQuestions([{ concept: "a", correct: "partial" }, yes("b", { reasoning: "flawed" })], 0.8);
	assert.equal(r.score, 0.5);
	assert.equal(r.passed, false);
	assert.deepEqual(r.gapConcepts, ["a", "b"]);
});

test("passing with a wrong answer still opens a gap and is not mastered", () => {
	const state = emptyState();
	const qs = [yes("a"), yes("b"), yes("c"), yes("d"), no("e", { error: "sign error" })];
	const out = recordAttempt(state, { kind: "quiz", topicKey: "Math/LA", scope: "L1", questions: qs, threshold: 0.8 });
	assert.equal(out.attempt.score, 0.8);
	assert.equal(out.attempt.passed, true);
	assert.equal(out.opened.length, 1);
	assert.equal(out.opened[0].concept, "e");
	assert.equal(out.mastered, false);
});

test("a correct, non-guided retest resolves the gap; a guided one does not", () => {
	const state = emptyState();
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "L1", questions: [no("Dot product")], threshold: 0.8 });
	let out = recordAttempt(state, { kind: "retest", topicKey: "T", scope: "L1", questions: [yes("dot product", { guided: true })], threshold: 0.8 });
	assert.equal(out.resolved.length, 0);
	out = recordAttempt(state, { kind: "retest", topicKey: "T", scope: "L1", questions: [yes("dot  product")], threshold: 0.8 });
	assert.equal(out.resolved.length, 1);
	assert.equal(out.stillOpen.length, 0);
	assert.equal(out.mastered, true);
});

test("the same wrong concept twice does not open duplicate gaps", () => {
	const state = emptyState();
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "s", questions: [no("x"), no("x")], threshold: 0.8 });
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "s", questions: [no("x")], threshold: 0.8 });
	assert.equal(state.gaps.filter((g) => g.status === "open").length, 1);
});

test("assessment attempts do not schedule reviews; quizzes do", () => {
	const state = emptyState();
	recordAttempt(state, { kind: "assessment", topicKey: "T", scope: "a", questions: [yes("a")], threshold: 0.8 });
	assert.equal(state.reviews.length, 0);
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "q", questions: [yes("a")], threshold: 0.8 });
	assert.equal(state.reviews.length, 1);
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "q", questions: [yes("A")], threshold: 0.8 });
	assert.equal(state.reviews.length, 1);
	assert.equal(state.reviews[0].reps, 2);
});

test("knowledge map tracks counts per concept and topic", () => {
	const state = emptyState();
	recordAttempt(state, { kind: "quiz", topicKey: "T", scope: "q", questions: [yes("a"), no("a")], threshold: 0.8 });
	const entry = Object.values(state.knowledge)[0];
	assert.equal(entry.total, 2);
	assert.equal(entry.correct, 1);
});
