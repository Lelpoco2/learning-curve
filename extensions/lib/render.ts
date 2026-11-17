/** Markdown rendering of generated sections (dashboard, profile, topic index). Pure. */

import { relative } from "node:path";
import { lessonPaths, subjectPaths, toPosix, topicFolder, topicPaths } from "./paths.ts";
import { dueItems } from "./srs.ts";
import { examDue, missingPrerequisites, nextSubjectTopic, subjectProgress, topicPrerequisites, topicSubjects } from "./subjects.ts";
import { type LcState, type Subject, type Topic, today, topicKey } from "./types.ts";

const STATUS_ICON: Record<string, string> = {
	planned: "⬜",
	assessing: "🔍",
	planning: "🗺️",
	"in-progress": "🟨",
	done: "✅",
};
const LEVELS = ["unknown", "heard of", "can follow", "can apply", "can explain"];

/** Vault-relative wikilink to a file (without .md), with an alias. */
export function wikilink(vault: string, file: string, alias?: string, inTable = false): string {
	const rel = toPosix(relative(vault, file)).replace(/\.md$/, "");
	// Inside Markdown tables the alias pipe must be escaped or it splits the cell.
	return alias ? `[[${rel}${inTable ? "\\|" : "|"}${alias}]]` : `[[${rel}]]`;
}

export function renderLessonsTable(vault: string, t: Topic): string {
	if (t.lessons.length === 0) return "_No study plan yet._";
	const lines = ["| # | Lesson | Block | Difficulty | Status |", "|---|---|---|---|---|"];
	for (const l of t.lessons) {
		const lp = lessonPaths(vault, t.subject, topicFolder(t), l.n, l.title);
		lines.push(
			`| ${l.n} | ${wikilink(vault, lp.note, l.title, true)} | ${l.block} | ${"●".repeat(l.difficulty)}${"○".repeat(5 - l.difficulty)} | ${STATUS_ICON[l.status] ?? ""} ${l.status} |`,
		);
	}
	return lines.join("\n");
}

function dots(d: number): string {
	return `${"●".repeat(d)}${"○".repeat(5 - d)}`;
}

/** Ordered syllabus of a subject; linked topics show their home subject. */
export function renderSyllabusTable(vault: string, state: LcState, s: Subject): string {
	if (s.syllabus.length === 0) return "_No syllabus yet. In pi: `/new-subject` or `/learn <topic>`._";
	const lines = ["| # | Topic | Home | Difficulty | Lessons | Status |", "|---|---|---|---|---|---|"];
	s.syllabus.forEach((item, k) => {
		const t = state.topics[item.topicKey];
		if (!t) return;
		const index = topicPaths(vault, t.subject, topicFolder(t)).topicIndex;
		const home = t.subject === s.name ? "—" : wikilink(vault, subjectPaths(vault, t.subject).index, `↗ ${t.subject}`, true);
		const lessons = t.lessons.length ? `${t.lessons.filter((l) => l.status === "done").length}/${t.lessons.length}` : item.estLessons ? `~${item.estLessons}` : "—";
		const note = item.note ? ` — _${item.note.replace(/\|/g, "/")}_` : "";
		lines.push(`| ${k + 1} | ${wikilink(vault, index, t.topic, true)}${note} | ${home} | ${dots(item.difficulty)} | ${lessons} | ${STATUS_ICON[t.status] ?? ""} ${t.status} |`);
	});
	const { done, total } = subjectProgress(state, s);
	const next = nextSubjectTopic(state, s);
	const missing = next ? missingPrerequisites(state, topicKey(next.subject, next.topic)) : [];
	lines.push(
		"",
		`**Progress:** ${done}/${total} topics${next ? ` · **Next:** ${next.topic}` : ""}${missing.length ? ` · ⚠️ first: ${missing.map((t) => `${t.topic} (${t.subject})`).join(", ")}` : ""}`,
	);
	return lines.join("\n");
}

/** Mermaid dependency map of a subject's topics (prerequisites → topic). */
export function renderSubjectMap(state: LcState, s: Subject): string {
	if (s.syllabus.length === 0) return "_The map appears once the syllabus exists._";
	const ids = new Map<string, string>();
	const id = (key: string) => {
		if (!ids.has(key)) ids.set(key, `t${ids.size + 1}`);
		return ids.get(key)!;
	};
	const label = (key: string) => (state.topics[key]?.topic ?? key.split("/").pop() ?? key).replace(/"/g, "'");
	const lines = ["```mermaid", "flowchart TD"];
	const inSyllabus = new Set(s.syllabus.map((i) => i.topicKey));
	for (const item of s.syllabus) lines.push(`  ${id(item.topicKey)}["${label(item.topicKey)}"]`);
	for (const item of s.syllabus) {
		for (const p of topicPrerequisites(state, item.topicKey)) {
			if (!inSyllabus.has(p) && !ids.has(p)) lines.push(`  ${id(p)}(["${label(p)} · ${p.split("/")[0]}"])`);
			lines.push(`  ${id(p)} --> ${id(item.topicKey)}`);
		}
	}
	lines.push("  classDef done fill:#d3f9d8,stroke:#2b8a3e", "  classDef linked stroke-dasharray: 5 5");
	for (const [key, nodeId] of ids) {
		const t = state.topics[key];
		if (t?.status === "done") lines.push(`  class ${nodeId} done`);
		if (t && t.subject !== s.name) lines.push(`  class ${nodeId} linked`);
	}
	lines.push("```", "", "_Dashed: topic shared with another subject. Green: done._");
	return lines.join("\n");
}

export function renderExamStatus(state: LcState, s: Subject): string {
	if (!s.finalExam) return "_No final exam for this subject._";
	const attempts = state.attempts.filter((a) => a.kind === "exam" && a.subject === s.name);
	const out: string[] = [];
	if (s.examPassed) out.push(`✅ Passed on ${s.examPassed}.`);
	else if (examDue(state, s)) out.push("🎯 All topics done: the final exam is due. In pi: `/exam`.");
	else out.push("⏳ Available when every topic of the syllabus is done.");
	for (const a of attempts.slice(-5)) {
		const link = a.note ? `[[${a.note.replace(/\.md$/, "")}|${a.scope}]]` : a.scope;
		out.push(`- ${a.date} · ${link} · ${Math.round(a.score * 100)}% ${a.passed ? "✅" : "❌"}`);
	}
	return out.join("\n");
}

export function renderTopicSubjects(vault: string, subjects: string[]): string {
	return subjects.map((s, i) => `- ${wikilink(vault, subjectPaths(vault, s).index, s)}${i === 0 ? " (home)" : ""}`).join("\n");
}

export function topicProgress(t: Topic): { done: number; total: number } {
	return { done: t.lessons.filter((l) => l.status === "done").length, total: t.lessons.length };
}

export function renderDashboard(vault: string, state: LcState, date = today()): string {
	const out: string[] = [`_Updated ${date}_`, ""];
	const subjects = Object.values(state.subjects);
	if (subjects.length) {
		out.push("## Subjects", "", "| Subject | Topics | Status | Next | Final exam |", "|---|---|---|---|---|");
		for (const s of subjects) {
			const { done, total } = subjectProgress(state, s);
			const next = nextSubjectTopic(state, s);
			const exam = !s.finalExam ? "—" : s.examPassed ? `✅ ${s.examPassed}` : examDue(state, s) ? "🎯 due" : "⏳";
			out.push(`| ${wikilink(vault, subjectPaths(vault, s.name).index, s.name, true)} | ${done}/${total} | ${s.status} | ${next?.topic ?? "—"} | ${exam} |`);
		}
		out.push("");
	}
	out.push("## Topics", "");
	const topics = Object.values(state.topics).filter((t) => t.status !== "planned");
	if (topics.length === 0) out.push("_No topics started yet. In pi: `/new-subject <name>` or `/learn <topic>`._");
	else {
		out.push("| Topic | Subjects | Lessons | Status | Open gaps |", "|---|---|---|---|---|");
		for (const t of topics) {
			const { done, total } = topicProgress(t);
			const key = topicKey(t.subject, t.topic);
			const gaps = state.gaps.filter((g) => g.status === "open" && g.topicKey === key).length;
			const index = topicPaths(vault, t.subject, topicFolder(t)).topicIndex;
			out.push(`| ${wikilink(vault, index, t.topic, true)} | ${topicSubjects(t).join(", ")} | ${done}/${total} | ${t.status} | ${gaps} |`);
		}
	}

	const due = dueItems(state.reviews, date);
	out.push("", `## Reviews due (${due.length})`, "");
	if (due.length === 0) out.push("_Nothing due today._");
	else for (const r of due.slice(0, 20)) out.push(`- ${r.concept}${r.topicKey ? ` — _${r.topicKey}_` : ""} (due ${r.due})`);

	const open = state.gaps.filter((g) => g.status === "open");
	out.push("", `## Open gaps (${open.length})`, "");
	if (open.length === 0) out.push("_No open gaps._");
	else for (const g of open.slice(0, 20)) out.push(`- **${g.concept}**${g.topicKey ? ` — _${g.topicKey}_` : ""}${g.error ? `: ${g.error}` : ""}`);

	const recent = state.attempts.slice(-8).reverse();
	out.push("", "## Recent attempts", "");
	if (recent.length === 0) out.push("_No attempts yet._");
	else {
		out.push("| Date | Kind | Scope | Score | Passed |", "|---|---|---|---|---|");
		for (const a of recent) out.push(`| ${a.date} | ${a.kind} | ${a.scope} | ${Math.round(a.score * 100)}% | ${a.passed ? "✅" : "❌"} |`);
	}
	return out.join("\n");
}

export function renderKnowledgeMap(state: LcState): string {
	const entries = Object.values(state.knowledge);
	if (entries.length === 0) return "_The knowledge map fills in as you answer assessments and quizzes._";
	const byTopic = new Map<string, typeof entries>();
	for (const e of entries) {
		const k = e.topicKey ?? "General";
		byTopic.set(k, [...(byTopic.get(k) ?? []), e]);
	}
	const out: string[] = [];
	for (const [k, list] of byTopic) {
		out.push(`### ${k}`, "", "| Concept | Level | Correct | Updated |", "|---|---|---|---|");
		for (const e of list.sort((a, b) => a.concept.localeCompare(b.concept))) {
			out.push(`| ${e.concept} | ${e.level} · ${LEVELS[e.level] ?? ""} | ${e.correct}/${e.total} | ${e.updated} |`);
		}
		out.push("");
	}
	return out.join("\n");
}

export function renderStyleObservations(state: LcState): string {
	if (state.style.length === 0) return "_No observations yet._";
	const icon = { works: "✅", "does-not-work": "❌", neutral: "➖" } as const;
	return state.style
		.slice(-40)
		.map((o) => `- ${o.date} ${icon[o.effect]} ${o.signal}${o.evidence ? ` — _${o.evidence}_` : ""}`)
		.join("\n");
}
