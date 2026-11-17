/** Quiz scoring, gap and knowledge bookkeeping. Pure: no pi imports. */

import { createReviewItem, findReviewItem, gradeFromResult, normalizeConcept, schedule } from "./srs.ts";
import {
	type Attempt,
	type AttemptKind,
	type Gap,
	type LcState,
	newId,
	type QuestionResult,
	today,
} from "./types.ts";

export interface ScoreResult {
	/** 0..1 over non-guided questions (1 when there are none). */
	score: number;
	counted: number;
	passed: boolean;
	/** Concepts whose answer reveals a gap (wrong, partial, or flawed reasoning). */
	gapConcepts: string[];
}

const POINTS = { yes: 1, partial: 0.5, no: 0 } as const;

export function isGap(q: QuestionResult): boolean {
	return q.correct !== "yes" || q.reasoning === "flawed" || q.reasoning === "partial";
}

export function isSolid(q: QuestionResult): boolean {
	return q.correct === "yes" && (q.reasoning === undefined || q.reasoning === "sound" || q.reasoning === "n/a");
}

export function scoreQuestions(questions: QuestionResult[], threshold: number): ScoreResult {
	const counted = questions.filter((q) => !q.guided);
	let points = 0;
	for (const q of counted) {
		let p = POINTS[q.correct];
		// A right result with flawed reasoning is not a full point: the reasoning is what we teach.
		if (q.correct === "yes" && q.reasoning === "flawed") p = 0.5;
		points += p;
	}
	const score = counted.length === 0 ? 1 : points / counted.length;
	const gapConcepts = unique(questions.filter(isGap).map((q) => q.concept));
	return { score: round2(score), counted: counted.length, passed: score >= threshold, gapConcepts };
}

export interface RecordInput {
	kind: AttemptKind;
	topicKey?: string;
	/** Subject-level attempts (subject assessment, final exam). */
	subject?: string;
	/** Topics in scope for "still open" gaps (e.g. every topic of the subject for an exam). */
	scopeTopicKeys?: string[];
	lesson?: number;
	scope: string;
	note?: string;
	questions: QuestionResult[];
	threshold: number;
	date?: string;
}

export interface RecordOutcome {
	attempt: Attempt;
	opened: Gap[];
	resolved: Gap[];
	stillOpen: Gap[];
	scheduled: string[];
	/** Passed and no open gaps left for the attempt's topic. */
	mastered: boolean;
}

/** Record an attempt into the state (mutates `state`) and return what changed. */
export function recordAttempt(state: LcState, input: RecordInput): RecordOutcome {
	const date = input.date ?? today();
	const result = scoreQuestions(input.questions, input.threshold);
	const attempt: Attempt = {
		id: newId("at"),
		kind: input.kind,
		topicKey: input.topicKey,
		subject: input.subject,
		lesson: input.lesson,
		scope: input.scope,
		note: input.note,
		date,
		score: result.score,
		passed: result.passed,
		questions: input.questions,
	};
	state.attempts.push(attempt);

	const opened: Gap[] = [];
	const resolved: Gap[] = [];
	const scheduled: string[] = [];

	for (const q of input.questions) {
		const key = normalizeConcept(q.concept);
		// Exams and subject assessments attribute each question to its own topic.
		const qTopic = q.topicKey ?? input.topicKey;
		const openGap = state.gaps.find(
			(g) => g.status === "open" && normalizeConcept(g.concept) === key && (g.topicKey === qTopic || !qTopic),
		);

		if (isGap(q)) {
			if (!openGap && !opened.some((g) => normalizeConcept(g.concept) === key)) {
				const gap: Gap = {
					id: newId("gap"),
					concept: q.concept.trim(),
					topicKey: qTopic,
					lesson: q.topicKey ? undefined : input.lesson,
					error: q.error,
					opened: date,
					openedBy: attempt.id,
					status: "open",
				};
				state.gaps.push(gap);
				opened.push(gap);
			} else if (openGap && q.error) {
				openGap.error = q.error;
			}
		} else if (isSolid(q) && openGap && input.kind !== "assessment") {
			// Guided answers had hints: they do not prove the gap is closed.
			if (!q.guided) {
				openGap.status = "resolved";
				openGap.resolved = date;
				resolved.push(openGap);
			}
		}

		updateKnowledge(state, q, qTopic, date);

		// The initial assessment calibrates the plan; reviews start once a concept is taught.
		if (input.kind !== "assessment" && !q.guided) {
			const grade = gradeFromResult(q.correct, q.reasoning);
			const existing = findReviewItem(state.reviews, q.concept, qTopic);
			if (existing) {
				Object.assign(existing, schedule(existing, grade, date));
			} else {
				const item = schedule(createReviewItem(q.concept, { topicKey: qTopic, note: input.note, date }), grade, date);
				state.reviews.push(item);
			}
			scheduled.push(q.concept);
		}
	}

	const scope = input.scopeTopicKeys ?? (input.topicKey ? [input.topicKey] : undefined);
	const stillOpen = state.gaps.filter((g) => g.status === "open" && (!scope || (g.topicKey !== undefined && scope.includes(g.topicKey))));
	return {
		attempt,
		opened,
		resolved,
		stillOpen,
		scheduled: unique(scheduled),
		mastered: result.passed && stillOpen.length === 0,
	};
}

function updateKnowledge(state: LcState, q: QuestionResult, topicKey: string | undefined, date: string): void {
	const key = `${topicKey ?? "_"}::${normalizeConcept(q.concept)}`;
	const entry = state.knowledge[key] ?? { concept: q.concept.trim(), topicKey, level: 0, correct: 0, total: 0, updated: date };
	entry.total += 1;
	if (isSolid(q)) entry.correct += 1;
	const ratio = entry.correct / entry.total;
	// Level from recent evidence: solid answers with sound reasoning push towards 4.
	let level = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
	if (level === 3 && q.reasoning === "sound" && entry.total >= 3) level = 4;
	entry.level = Math.max(level, isSolid(q) ? Math.min(entry.level, 4) : 0);
	entry.updated = date;
	state.knowledge[key] = entry;
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const v of values) {
		const k = normalizeConcept(v);
		if (!seen.has(k)) {
			seen.add(k);
			out.push(v.trim());
		}
	}
	return out;
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
