/** Spaced-repetition scheduler (SM-2 variant). Pure: no pi imports. */

import { newId, type ReviewItem, today } from "./types.ts";

export type ReviewGrade = "again" | "hard" | "good" | "easy";

const QUALITY: Record<ReviewGrade, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const MIN_EASE = 1.3;
const MAX_INTERVAL = 365;

export function addDays(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	date.setDate(date.getDate() + days);
	return today(date);
}

export function normalizeConcept(concept: string): string {
	return concept.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createReviewItem(concept: string, opts: { topicKey?: string; note?: string; date?: string } = {}): ReviewItem {
	const date = opts.date ?? today();
	return {
		id: newId("rv"),
		concept: concept.trim(),
		topicKey: opts.topicKey,
		note: opts.note,
		due: addDays(date, 1),
		interval: 0,
		ease: 2.5,
		reps: 0,
		lapses: 0,
	};
}

/** Return a new item scheduled after a review with the given grade. */
export function schedule(item: ReviewItem, grade: ReviewGrade, date = today()): ReviewItem {
	const q = QUALITY[grade];
	let { interval, ease, reps, lapses } = item;

	if (q < 3) {
		reps = 0;
		lapses += 1;
		interval = 1;
	} else {
		reps += 1;
		if (reps === 1) interval = 1;
		else if (reps === 2) interval = grade === "hard" ? 3 : 4;
		else interval = Math.round(interval * (grade === "hard" ? 1.2 : ease));
		if (grade === "easy") interval = Math.round(interval * 1.3) + 1;
	}

	ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
	interval = Math.min(MAX_INTERVAL, Math.max(1, interval));

	return { ...item, interval, ease: Math.round(ease * 100) / 100, reps, lapses, due: addDays(date, interval), lastReviewed: date };
}

export function isDue(item: ReviewItem, date = today()): boolean {
	return item.due <= date;
}

export function dueItems(items: ReviewItem[], date = today()): ReviewItem[] {
	return items.filter((i) => isDue(i, date)).sort((a, b) => a.due.localeCompare(b.due) || a.ease - b.ease);
}

/** Map a quiz outcome on a concept to a review grade. */
export function gradeFromResult(correct: "yes" | "partial" | "no", reasoning?: string): ReviewGrade {
	if (correct === "no" || reasoning === "flawed") return "again";
	if (correct === "partial" || reasoning === "partial" || reasoning === "missing") return "hard";
	return "good";
}

/** Find the review item for a concept (same topic preferred). */
export function findReviewItem(items: ReviewItem[], concept: string, topicKey?: string): ReviewItem | undefined {
	const key = normalizeConcept(concept);
	return (
		items.find((i) => normalizeConcept(i.concept) === key && i.topicKey === topicKey) ??
		items.find((i) => normalizeConcept(i.concept) === key)
	);
}
