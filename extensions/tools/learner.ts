/** learner_profile (knowledge and learning style) and review_queue (spaced repetition). */

import { StringEnum } from "../lib/schema.ts";
import { Type } from "../lib/schema.ts";
import { findTopic } from "../lib/curriculum.ts";
import { readStyleSummary } from "../lib/notes.ts";
import { safeName } from "../lib/paths.ts";
import { createReviewItem, dueItems, normalizeConcept, schedule } from "../lib/srs.ts";
import { resolveTopicRef } from "../lib/subjects.ts";
import { type LcState, newId, today, topicKey } from "../lib/types.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { mutateState, readState, requireWorkspace, textResult } from "../runtime.ts";

function keyFor(state: LcState, subject?: string, topic?: string): string | undefined {
	if (topic) {
		const t = resolveTopicRef(state, topic, subject ? safeName(subject) : state.active?.subject) ?? findTopic(state, topic);
		return t ? topicKey(t.subject, t.topic) : undefined;
	}
	return state.active?.topicKey;
}

const ProfileParams = Type.Object({
	action: StringEnum(["get", "observe", "set_knowledge"] as const, {
		description:
			"get: style summary, recent observations and knowledge map. observe: record evidence about how the learner understands. set_knowledge: set the level of a concept (e.g. from the assessment interview).",
	}),
	signal: Type.Optional(Type.String({ description: "observe: what was tried, e.g. 'geometric picture before formula', 'physical analogy (springs)'" })),
	effect: Type.Optional(StringEnum(["works", "does-not-work", "neutral"] as const)),
	evidence: Type.Optional(Type.String({ description: "observe: what the learner said or did that shows it" })),
	concept: Type.Optional(Type.String()),
	level: Type.Optional(Type.Integer({ minimum: 0, maximum: 4, description: "0 unknown, 1 heard of, 2 can follow, 3 can apply, 4 can explain" })),
	note: Type.Optional(Type.String()),
	subject: Type.Optional(Type.String()),
	topic: Type.Optional(Type.String()),
});

const ReviewParams = Type.Object({
	action: StringEnum(["due", "record", "add", "list"] as const, {
		description: "due: items due today. record: outcome of a review. add: schedule a concept manually. list: all items (soonest first).",
	}),
	limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
	id: Type.Optional(Type.String({ description: "record: review item id" })),
	grade: Type.Optional(StringEnum(["again", "hard", "good", "easy"] as const, { description: "again = wrong/forgot, hard = right with effort or shaky reasoning, good = right, easy = instant and well reasoned" })),
	error: Type.Optional(Type.String({ description: "record with grade again: what went wrong" })),
	concept: Type.Optional(Type.String()),
	note: Type.Optional(Type.String({ description: "add: vault-relative note that teaches the concept" })),
	subject: Type.Optional(Type.String()),
	topic: Type.Optional(Type.String()),
});

export const learnerTools = [
	defineTool({
		name: "learner_profile",
		label: "Learner profile",
		description:
			"Read or update what the tutor knows about the learner: knowledge level per concept and observations about how the learner understands (which explanations work or fail). Observations are logged in the Learning Style note.",
		parameters: ProfileParams,
		sequential: true,
		async execute(p, env) {
			const ws = requireWorkspace();
			if (p.action === "get") {
				const state = readState();
				const key = keyFor(state, p.subject, p.topic);
				const knowledge = Object.values(state.knowledge).filter((k) => !key || k.topicKey === key);
				const out = [
					"Learning style summary:",
					readStyleSummary(ws) ?? "(none yet: run the learning-style interview)",
					"",
					"Recent observations:",
					...(state.style.slice(-15).map((o) => `- ${o.effect}: ${o.signal}${o.evidence ? ` (${o.evidence})` : ""}`) || []),
					"",
					`Knowledge${key ? ` [${key}]` : ""}:`,
					...knowledge.map((k) => `- ${k.concept}: level ${k.level} (${k.correct}/${k.total})${k.note ? ` — ${k.note}` : ""}`),
				];
				return textResult(out.join("\n"), { action: p.action as string });
			}
			if (p.action === "observe") {
				if (!p.signal || !p.effect) throw new Error("signal and effect are required");
				await mutateState((state) => {
					state.style.push({ date: today(), signal: p.signal!.trim(), effect: p.effect!, evidence: p.evidence?.trim() });
				});
				return textResult(`Observation recorded (${p.effect}): ${p.signal}. If it changes the overall picture, update the Summary of the Learning Style note.`, {
					action: p.action as string,
				});
			}
			// set_knowledge
			if (!p.concept || p.level === undefined) throw new Error("concept and level are required");
			const msg = await mutateState((state) => {
				const key = keyFor(state, p.subject, p.topic);
				const id = `${key ?? "_"}::${normalizeConcept(p.concept!)}`;
				const prev = state.knowledge[id];
				state.knowledge[id] = {
					concept: p.concept!.trim(),
					topicKey: key,
					level: p.level!,
					correct: prev?.correct ?? 0,
					total: prev?.total ?? 0,
					updated: today(),
					note: p.note ?? prev?.note,
				};
				return `Knowledge: ${p.concept} → level ${p.level}${key ? ` [${key}]` : ""}.`;
			});
			return textResult(msg, { action: p.action as string });
		},
	}),

	defineTool({
		name: "review_queue",
		label: "Reviews",
		description:
			"Spaced-repetition queue (SM-2). List due concepts, record review outcomes (reschedules the item; 'again' also opens a gap), add concepts, or list everything.",
		parameters: ReviewParams,
		sequential: true,
		async execute(p, env) {
			requireWorkspace();
			const date = today();
			if (p.action === "due" || p.action === "list") {
				const state = readState();
				const items = p.action === "due" ? dueItems(state.reviews, date) : [...state.reviews].sort((a, b) => a.due.localeCompare(b.due));
				const shown = items.slice(0, p.limit ?? 20);
				if (shown.length === 0) return textResult(p.action === "due" ? "No reviews due today." : "Review queue is empty.", { count: 0 });
				const lines = shown.map(
					(r) => `- id ${r.id} · ${r.concept}${r.topicKey ? ` [${r.topicKey}]` : ""} · due ${r.due} · interval ${r.interval}d · reps ${r.reps} · lapses ${r.lapses}${r.note ? ` · note ${r.note}` : ""}`,
				);
				return textResult(`${items.length} item(s)${items.length > shown.length ? `, showing ${shown.length}` : ""}:\n${lines.join("\n")}`, { count: items.length });
			}
			if (p.action === "add") {
				if (!p.concept) throw new Error("concept is required");
				const msg = await mutateState((state) => {
					const key = keyFor(state, p.subject, p.topic);
					const item = createReviewItem(p.concept!, { topicKey: key, note: p.note, date });
					state.reviews.push(item);
					return `Scheduled "${item.concept}" for ${item.due} (id ${item.id}).`;
				});
				return textResult(msg, { count: 1 });
			}
			// record
			if (!p.id || !p.grade) throw new Error("id and grade are required");
			const msg = await mutateState((state) => {
				const item = state.reviews.find((r) => r.id === p.id);
				if (!item) throw new Error(`Review item ${p.id} not found`);
				Object.assign(item, schedule(item, p.grade!, date));
				let extra = "";
				if (p.grade === "again") {
					const open = state.gaps.find((g) => g.status === "open" && normalizeConcept(g.concept) === normalizeConcept(item.concept));
					if (!open) {
						state.gaps.push({
							id: newId("gap"),
							concept: item.concept,
							topicKey: item.topicKey,
							error: p.error,
							opened: date,
							openedBy: `review:${item.id}`,
							status: "open",
						});
						extra = " Forgotten: gap opened — write a short reinforcement note and retest.";
					}
				}
				return `"${item.concept}" → ${p.grade}; next review ${item.due} (interval ${item.interval}d).${extra}`;
			});
			return textResult(msg, { count: 1 });
		},
	}),
];
