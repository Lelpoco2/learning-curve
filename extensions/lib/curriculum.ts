/** Topic plans and lesson bookkeeping. Pure: no pi imports. */

import { type Assessment, type LcState, type Lesson, type LessonStatus, type Topic, topicKey } from "./types.ts";
import { safeName } from "./paths.ts";

export interface PlanLessonInput {
	title: string;
	difficulty: number;
	concepts?: string[];
	prerequisites?: string[];
}

export interface PlanBlockInput {
	name: string;
	lessons: PlanLessonInput[];
}

export function ensureTopic(state: LcState, subject: string, topic: string, date: string): Topic {
	const key = topicKey(safeName(subject), safeName(topic));
	let t = state.topics[key];
	if (!t) {
		t = {
			subject: safeName(subject),
			topic: safeName(topic),
			subjects: [safeName(subject)],
			status: "assessing",
			blocks: [],
			lessons: [],
			createdAt: date,
			updatedAt: date,
		};
		state.topics[key] = t;
	}
	return t;
}

export function setAssessment(state: LcState, subject: string, topic: string, assessment: Assessment): Topic {
	const t = ensureTopic(state, subject, topic, assessment.date);
	t.assessment = assessment;
	if (t.status === "assessing" || t.status === "planned") t.status = "planning";
	t.updatedAt = assessment.date;
	return t;
}

/**
 * Replace the plan of a topic. Lessons keep their status when a lesson with the same title
 * already exists, so a plan can be revised mid-way without losing progress.
 * Lessons are numbered in block order; within a block the given order is kept.
 */
export function setPlan(state: LcState, subject: string, topic: string, blocks: PlanBlockInput[], date: string): Topic {
	const t = ensureTopic(state, subject, topic, date);
	const previous = new Map(t.lessons.map((l) => [l.title.toLowerCase(), l]));
	const lessons: Lesson[] = [];
	let n = 1;
	for (const block of blocks) {
		for (const l of block.lessons) {
			const old = previous.get(safeName(l.title).toLowerCase());
			lessons.push({
				n: n++,
				title: safeName(l.title),
				difficulty: clampDifficulty(l.difficulty),
				block: block.name.trim(),
				concepts: (l.concepts ?? []).map((c) => c.trim()).filter(Boolean),
				prerequisites: l.prerequisites?.map((p) => p.trim()).filter(Boolean),
				status: old?.status ?? "planned",
			});
		}
	}
	t.blocks = blocks.map((b) => b.name.trim());
	t.lessons = lessons;
	if (t.status === "assessing" || t.status === "planning" || t.status === "planned") t.status = "in-progress";
	t.updatedAt = date;
	return t;
}

export function setLessonStatus(t: Topic, n: number, status: LessonStatus, date: string): Lesson {
	const lesson = t.lessons.find((l) => l.n === n);
	if (!lesson) throw new Error(`Lesson ${n} not found in ${t.subject}/${t.topic}`);
	lesson.status = status;
	t.updatedAt = date;
	if (t.lessons.length > 0 && t.lessons.every((l) => l.status === "done")) t.status = "done";
	else if (t.status === "done") t.status = "in-progress";
	return lesson;
}

export function nextLesson(t: Topic): Lesson | undefined {
	return t.lessons.find((l) => l.status === "in-progress") ?? t.lessons.find((l) => l.status === "planned");
}

/** True when `n` is the last lesson of its block (a natural checkpoint for a quiz). */
export function isEndOfBlock(t: Topic, n: number): boolean {
	const lesson = t.lessons.find((l) => l.n === n);
	if (!lesson) return false;
	const sameBlock = t.lessons.filter((l) => l.block === lesson.block);
	return sameBlock[sameBlock.length - 1]?.n === n;
}

export function findTopic(state: LcState, query: string): Topic | undefined {
	const q = query.trim().toLowerCase();
	if (!q) return undefined;
	const all = Object.values(state.topics);
	return (
		all.find((t) => topicKey(t.subject, t.topic).toLowerCase() === q) ??
		all.find((t) => t.topic.toLowerCase() === q) ??
		all.find((t) => t.topic.toLowerCase().includes(q))
	);
}

function clampDifficulty(d: number): number {
	if (!Number.isFinite(d)) return 1;
	return Math.min(5, Math.max(1, Math.round(d)));
}
