/**
 * Subjects: courses made of an ordered syllabus of topics. Pure: no pi imports.
 *
 * A topic has ONE home subject (its folder) and may be listed in the syllabus of other
 * subjects (linked, never duplicated). `topic.subjects` records every subject using it.
 */

import { safeName } from "./paths.ts";
import { type Assessment, type LcState, type Subject, type SyllabusItem, type Topic, topicKey } from "./types.ts";

export function ensureSubject(state: LcState, name: string, date: string): Subject {
	const key = safeName(name);
	let s = state.subjects[key];
	if (!s) {
		s = { name: key, status: "assessing", syllabus: [], finalExam: true, createdAt: date, updatedAt: date };
		state.subjects[key] = s;
	}
	return s;
}

export function setSubjectAssessment(state: LcState, name: string, assessment: Assessment, goal?: string): Subject {
	const s = ensureSubject(state, name, assessment.date);
	s.assessment = assessment;
	if (goal) s.goal = goal;
	if (s.status === "assessing") s.status = "planning";
	s.updatedAt = assessment.date;
	return s;
}

/** Add a subject to a topic's subject list (home subject always first). */
export function linkTopic(t: Topic, subject: string): void {
	const list = new Set([t.subject, ...(t.subjects ?? []), subject]);
	t.subjects = [...list];
}

export function unlinkTopic(t: Topic, subject: string): void {
	if (subject === t.subject) return;
	t.subjects = (t.subjects ?? [t.subject]).filter((s) => s !== subject);
}

export function topicSubjects(t: Topic): string[] {
	return t.subjects?.length ? t.subjects : [t.subject];
}

function norm(s: string): string {
	return safeName(s).toLowerCase();
}

/** Topics whose name matches (exact first, then containment), across all subjects. */
export function findTopicsByName(state: LcState, name: string): Topic[] {
	const q = norm(name);
	const all = Object.values(state.topics);
	const exact = all.filter((t) => norm(t.topic) === q);
	if (exact.length) return exact;
	return all.filter((t) => norm(t.topic).includes(q) || q.includes(norm(t.topic)));
}

/**
 * Resolve a topic reference: a full key "Subject/Topic", a topic of the given subject
 * (home or linked in its syllabus), or a globally unique topic name.
 */
export function resolveTopicRef(state: LcState, ref: string, subject?: string): Topic | undefined {
	if (state.topics[ref]) return state.topics[ref];
	const slash = ref.indexOf("/");
	if (slash > 0) {
		const key = topicKey(safeName(ref.slice(0, slash)), safeName(ref.slice(slash + 1)));
		if (state.topics[key]) return state.topics[key];
	}
	const q = norm(ref);
	if (subject) {
		const s = state.subjects[safeName(subject)];
		const inSyllabus = s?.syllabus.map((i) => state.topics[i.topicKey]).find((t) => t && norm(t.topic) === q);
		if (inSyllabus) return inSyllabus;
		const home = state.topics[topicKey(safeName(subject), safeName(ref))];
		if (home) return home;
	}
	const matches = Object.values(state.topics).filter((t) => norm(t.topic) === q);
	return matches.length === 1 ? matches[0] : undefined;
}

export interface SyllabusInput {
	topic: string;
	/** Home subject of the topic. Omit for topics that live in this subject. */
	home?: string;
	difficulty: number;
	estLessons?: number;
	prerequisites?: string[];
	note?: string;
}

export interface SyllabusResult {
	subject: Subject;
	created: Topic[];
	linked: Topic[];
	removed: string[];
	warnings: string[];
}

/**
 * Replace the syllabus of a subject.
 * - Topics homed in this subject are created as `planned` stubs when missing.
 * - Topics homed elsewhere must already exist; they are linked, never copied.
 * - A new topic whose name already exists in another subject is rejected: link it
 *   (set `home`) or give the bridge topic a distinct name.
 */
export function setSyllabus(
	state: LcState,
	name: string,
	items: SyllabusInput[],
	opts: { goal?: string; finalExam?: boolean },
	date: string,
): SyllabusResult {
	const s = ensureSubject(state, name, date);
	const created: Topic[] = [];
	const linked: Topic[] = [];
	const warnings: string[] = [];
	const resolved: { item: SyllabusInput; topic: Topic }[] = [];

	// Validate everything before mutating, so a bad item leaves the state untouched.
	const plan = items.map((item) => {
		const home = safeName(item.home ?? s.name);
		const title = safeName(item.topic);
		const key = topicKey(home, title);
		const exists = state.topics[key];
		if (home !== s.name && !exists) {
			const near = findTopicsByName(state, title).map((t) => topicKey(t.subject, t.topic));
			throw new Error(`Topic "${title}" does not exist in subject "${home}".${near.length ? ` Did you mean: ${near.join(", ")}?` : ""}`);
		}
		if (home === s.name && !exists) {
			const elsewhere = findTopicsByName(state, title).filter((t) => norm(t.topic) === norm(title) && t.subject !== s.name);
			if (elsewhere.length) {
				throw new Error(
					`Topic "${title}" already exists in ${elsewhere.map((t) => `"${t.subject}"`).join(", ")}. Link it (home: "${elsewhere[0].subject}") or name the bridge topic differently (e.g. "${title} in ${s.name}").`,
				);
			}
		}
		return { item, home, title, key, exists };
	});

	for (const p of plan) {
		let t = p.exists;
		if (!t) {
			t = { subject: p.home, topic: p.title, subjects: [p.home], status: "planned", blocks: [], lessons: [], createdAt: date, updatedAt: date };
			state.topics[p.key] = t;
			created.push(t);
		} else if (p.home !== s.name) linked.push(t);
		linkTopic(t, s.name);
		resolved.push({ item: p.item, topic: t });
	}

	const syllabus: SyllabusItem[] = resolved.map(({ item, topic }) => {
		const prerequisites: string[] = [];
		for (const ref of item.prerequisites ?? []) {
			const inThis = resolved.find((r) => norm(r.topic.topic) === norm(ref));
			const target = inThis?.topic ?? resolveTopicRef(state, ref, s.name);
			if (target) prerequisites.push(topicKey(target.subject, target.topic));
			else warnings.push(`Prerequisite "${ref}" of "${topic.topic}" is not a known topic (kept as a note only).`);
		}
		return {
			topicKey: topicKey(topic.subject, topic.topic),
			difficulty: Math.min(5, Math.max(1, Math.round(item.difficulty || 1))),
			estLessons: item.estLessons,
			prerequisites: prerequisites.length ? prerequisites : undefined,
			note: item.note,
		};
	});

	// Topics dropped from the syllabus.
	const keep = new Set(syllabus.map((i) => i.topicKey));
	const removed: string[] = [];
	for (const old of s.syllabus) {
		if (keep.has(old.topicKey)) continue;
		const t = state.topics[old.topicKey];
		if (!t) continue;
		removed.push(old.topicKey);
		if (t.subject === s.name && t.status === "planned" && t.lessons.length === 0 && topicSubjects(t).length <= 1) {
			delete state.topics[old.topicKey];
		} else unlinkTopic(t, s.name);
	}

	s.syllabus = syllabus;
	if (opts.goal) s.goal = opts.goal;
	if (opts.finalExam !== undefined) s.finalExam = opts.finalExam;
	if (s.status === "assessing" || s.status === "planning") s.status = "in-progress";
	s.updatedAt = date;
	updateSubjectStatus(state, s.name, date);
	return { subject: s, created, linked, removed, warnings };
}

export function syllabusTopics(state: LcState, subject: Subject): Topic[] {
	return subject.syllabus.map((i) => state.topics[i.topicKey]).filter((t): t is Topic => !!t);
}

/** Prerequisites of a topic, merged from every syllabus that lists it (they may come from other subjects). */
export function topicPrerequisites(state: LcState, key: string): string[] {
	const out = new Set<string>();
	for (const s of Object.values(state.subjects)) {
		for (const item of s.syllabus) if (item.topicKey === key) for (const p of item.prerequisites ?? []) out.add(p);
	}
	return [...out];
}

/** Prerequisite topics that exist and are not done yet. */
export function missingPrerequisites(state: LcState, key: string): Topic[] {
	return topicPrerequisites(state, key)
		.map((p) => state.topics[p])
		.filter((t): t is Topic => !!t && t.status !== "done");
}

/** First syllabus topic not done whose prerequisites (from every subject) are done; falls back to the first not done. */
export function nextSubjectTopic(state: LcState, subject: Subject): Topic | undefined {
	const notDone = subject.syllabus.filter((i) => state.topics[i.topicKey]?.status !== "done");
	const ready = notDone.find((i) => missingPrerequisites(state, i.topicKey).length === 0);
	const pick = ready ?? notDone[0];
	return pick ? state.topics[pick.topicKey] : undefined;
}

export function subjectProgress(state: LcState, subject: Subject): { done: number; total: number } {
	const topics = syllabusTopics(state, subject);
	return { done: topics.filter((t) => t.status === "done").length, total: subject.syllabus.length };
}

export function subjectTopicKeys(subject: Subject): string[] {
	return subject.syllabus.map((i) => i.topicKey);
}

/** Recompute a subject's status: done = every topic done and (no final exam, or exam passed). */
export function updateSubjectStatus(state: LcState, name: string, date: string): Subject | undefined {
	const s = state.subjects[safeName(name)];
	if (!s || s.syllabus.length === 0) return s;
	const { done, total } = subjectProgress(state, s);
	const complete = done === total && (!s.finalExam || !!s.examPassed);
	if (complete && s.status !== "done") {
		s.status = "done";
		s.updatedAt = date;
	} else if (!complete && s.status === "done") {
		s.status = "in-progress";
		s.updatedAt = date;
	}
	return s;
}

/** Recompute every subject containing the topic (after a topic status change). */
export function refreshSubjectsOfTopic(state: LcState, t: Topic, date: string): void {
	for (const name of topicSubjects(t)) updateSubjectStatus(state, name, date);
}

/** Final exam is due: all topics done, exam enabled and not passed yet. */
export function examDue(state: LcState, subject: Subject): boolean {
	const { done, total } = subjectProgress(state, subject);
	return subject.finalExam && !subject.examPassed && total > 0 && done === total;
}
