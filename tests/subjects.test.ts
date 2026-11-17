import assert from "node:assert/strict";
import { test } from "node:test";
import { setLessonStatus, setPlan } from "../extensions/lib/curriculum.ts";
import { recordAttempt } from "../extensions/lib/scoring.ts";
import {
	examDue,
	findTopicsByName,
	nextSubjectTopic,
	refreshSubjectsOfTopic,
	resolveTopicRef,
	setSubjectAssessment,
	setSyllabus,
	subjectProgress,
	subjectTopicKeys,
	updateSubjectStatus,
} from "../extensions/lib/subjects.ts";
import { emptyState } from "../extensions/lib/types.ts";

const D = "2026-11-09";

function calculus() {
	const state = emptyState();
	setSubjectAssessment(state, "Calculus 1", { level: "beginner", date: D, summary: "s", known: [], weak: [] }, "Pass the exam");
	setSyllabus(
		state,
		"Calculus 1",
		[
			{ topic: "Limits", difficulty: 2 },
			{ topic: "Derivatives", difficulty: 3, prerequisites: ["Limits"] },
		],
		{ finalExam: true },
		D,
	);
	return state;
}

test("a syllabus creates planned topic stubs homed in the subject", () => {
	const state = calculus();
	const s = state.subjects["Calculus 1"];
	assert.equal(s.status, "in-progress");
	assert.equal(s.goal, "Pass the exam");
	assert.deepEqual(subjectTopicKeys(s), ["Calculus 1/Limits", "Calculus 1/Derivatives"]);
	assert.equal(state.topics["Calculus 1/Limits"].status, "planned");
	assert.deepEqual(s.syllabus[1].prerequisites, ["Calculus 1/Limits"]);
});

test("another subject links an existing topic instead of duplicating it", () => {
	const state = calculus();
	const r = setSyllabus(
		state,
		"Physics 1",
		[
			{ topic: "Derivatives", home: "Calculus 1", difficulty: 2 },
			{ topic: "Kinematics", difficulty: 3, prerequisites: ["Derivatives"] },
		],
		{},
		D,
	);
	assert.equal(r.linked.length, 1);
	assert.equal(Object.keys(state.topics).filter((k) => k.endsWith("/Derivatives")).length, 1);
	assert.deepEqual(state.topics["Calculus 1/Derivatives"].subjects, ["Calculus 1", "Physics 1"]);
	assert.deepEqual(state.subjects["Physics 1"].syllabus[1].prerequisites, ["Calculus 1/Derivatives"]);
	assert.equal(resolveTopicRef(state, "Derivatives", "Physics 1")?.subject, "Calculus 1");
});

test("a duplicate topic name in a new subject is rejected with a hint", () => {
	const state = calculus();
	assert.throws(() => setSyllabus(state, "Physics 1", [{ topic: "derivatives", difficulty: 2 }], {}, D), /already exists in "Calculus 1".*home: "Calculus 1"/);
	// Nothing was mutated by the failed call.
	assert.equal(state.subjects["Physics 1"].syllabus.length, 0);
	assert.equal(Object.keys(state.topics).length, 2);
});

test("linking a topic that does not exist fails with suggestions", () => {
	const state = calculus();
	assert.throws(() => setSyllabus(state, "Physics 1", [{ topic: "Derivative", home: "Calculus 1", difficulty: 2 }], {}, D), /Did you mean: Calculus 1\/Derivatives/);
});

test("dropping topics deletes untouched stubs and unlinks shared ones", () => {
	const state = calculus();
	setSyllabus(state, "Physics 1", [{ topic: "Derivatives", home: "Calculus 1", difficulty: 2 }, { topic: "Optics", difficulty: 2 }], {}, D);
	const r = setSyllabus(state, "Physics 1", [{ topic: "Kinematics", difficulty: 2 }], {}, D);
	assert.deepEqual(r.removed.sort(), ["Calculus 1/Derivatives", "Physics 1/Optics"]);
	assert.equal(state.topics["Physics 1/Optics"], undefined);
	assert.deepEqual(state.topics["Calculus 1/Derivatives"].subjects, ["Calculus 1"]);
});

test("next topic respects prerequisites; progress, exam and completion", () => {
	const state = calculus();
	const s = state.subjects["Calculus 1"];
	assert.equal(nextSubjectTopic(state, s)?.topic, "Limits");
	for (const name of ["Limits", "Derivatives"]) {
		const t = setPlan(state, "Calculus 1", name, [{ name: "B", lessons: [{ title: `${name} intro`, difficulty: 1 }] }], D);
		setLessonStatus(t, 1, "done", D);
		refreshSubjectsOfTopic(state, t, D);
	}
	assert.deepEqual(subjectProgress(state, s), { done: 2, total: 2 });
	assert.equal(examDue(state, s), true);
	assert.equal(s.status, "in-progress");
	s.examPassed = D;
	updateSubjectStatus(state, "Calculus 1", D);
	assert.equal(s.status, "done");
});

test("exam questions open gaps on their own topics", () => {
	const state = calculus();
	const keys = subjectTopicKeys(state.subjects["Calculus 1"]);
	const out = recordAttempt(state, {
		kind: "exam",
		subject: "Calculus 1",
		scope: "Final exam",
		scopeTopicKeys: keys,
		threshold: 0.8,
		questions: [
			{ concept: "epsilon-delta", correct: "no", topicKey: "Calculus 1/Limits" },
			{ concept: "chain rule", correct: "yes", reasoning: "sound", topicKey: "Calculus 1/Derivatives" },
		],
	});
	assert.equal(out.opened[0].topicKey, "Calculus 1/Limits");
	assert.equal(out.stillOpen.length, 1);
	assert.equal(out.mastered, false);
	assert.equal(state.reviews.find((r) => r.concept === "chain rule")?.topicKey, "Calculus 1/Derivatives");
});

test("prerequisites are merged across subjects for linked topics", async () => {
	const { missingPrerequisites } = await import("../extensions/lib/subjects.ts");
	const { renderSubjectMap } = await import("../extensions/lib/render.ts");
	const state = calculus();
	setSyllabus(
		state,
		"Physics 1",
		[
			{ topic: "Derivatives", home: "Calculus 1", difficulty: 2 },
			{ topic: "Vectors in physics", difficulty: 2 },
		],
		{},
		D,
	);
	const phys = state.subjects["Physics 1"];
	// Derivatives needs Limits (from Calculus 1): not ready, so the bridge topic comes first.
	assert.deepEqual(missingPrerequisites(state, "Calculus 1/Derivatives").map((t) => t.topic), ["Limits"]);
	assert.equal(nextSubjectTopic(state, phys)?.topic, "Vectors in physics");
	const map = renderSubjectMap(state, phys);
	assert.match(map, /\["Limits · Calculus 1"\]/);
	assert.equal(map.match(/Limits · Calculus 1/g)?.length, 1);
});

test("findTopicsByName matches across subjects", () => {
	const state = calculus();
	assert.deepEqual(findTopicsByName(state, "deriv").map((t) => t.topic), ["Derivatives"]);
});
