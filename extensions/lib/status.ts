/** One-line progress status (pi footer, Claude Code status line). */

import { nextLesson } from "./curriculum.ts";
import { dueItems } from "./srs.ts";
import { examDue, subjectProgress } from "./subjects.ts";
import { type LcState, today } from "./types.ts";

export function statusText(state: LcState, date = today()): string {
	const parts: string[] = ["📘"];
	const s = state.active?.subject ? state.subjects[state.active.subject] : undefined;
	if (s) {
		const { done, total } = subjectProgress(state, s);
		parts.push(`${s.name}${total ? ` ${done}/${total}` : ""}${examDue(state, s) ? " · exam due" : ""} ›`);
	}
	const t = state.active?.topicKey ? state.topics[state.active.topicKey] : undefined;
	if (t) {
		const done = t.lessons.filter((l) => l.status === "done").length;
		const current = t.lessons.find((l) => l.n === state.active?.lesson) ?? nextLesson(t);
		parts.push(`${t.topic}${t.lessons.length ? ` ${done}/${t.lessons.length}` : ""}${current ? ` · L${current.n}` : ""}`);
	} else parts.push(s ? "next topic" : "no active subject");
	const due = dueItems(state.reviews, date).length;
	const gaps = state.gaps.filter((g) => g.status === "open").length;
	if (due) parts.push(`· ${due} due`);
	if (gaps) parts.push(`· ${gaps} gap${gaps === 1 ? "" : "s"}`);
	return parts.join(" ");
}
