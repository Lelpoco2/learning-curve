/** learning_state: subjects, topics, lessons bookkeeping and canonical paths. */

import { existsSync, readdirSync } from "node:fs";
import { relative } from "node:path";
import { Type } from "../lib/schema.ts";
import { ensureTopic, isEndOfBlock, nextLesson, setAssessment, setLessonStatus, setPlan } from "../lib/curriculum.ts";
import { scaffoldSubject, scaffoldTopic, tagSlug, topicVars } from "../lib/notes.ts";
import { customKindPath, DEFAULT_KIND, isValidKindId, kindTemplate, listKinds, topicKind } from "../lib/kinds.ts";
import { attemptNotePath, examNotePath, lessonPaths, reinforcementPath, safeName, subjectPaths, toPosix, topicFolder, topicPaths } from "../lib/paths.ts";
import { StringEnum } from "../lib/schema.ts";
import { renumberTopics } from "../lib/renumber.ts";
import { dueItems } from "../lib/srs.ts";
import {
	ensureSubject,
	examDue,
	findTopicsByName,
	linkTopic,
	missingPrerequisites,
	nextSubjectTopic,
	refreshSubjectsOfTopic,
	resolveTopicRef,
	setSubjectAssessment,
	setSyllabus,
	subjectProgress,
	topicSubjects,
} from "../lib/subjects.ts";
import { type LcState, type Subject, type Topic, today, topicKey } from "../lib/types.ts";
import { notesRoot, type Workspace } from "../lib/workspace.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { mutateState, readState, requireWorkspace, textResult } from "../runtime.ts";

const LessonInput = Type.Object({
	title: Type.String(),
	difficulty: Type.Integer({ minimum: 1, maximum: 5, description: "1 easiest … 5 hardest" }),
	concepts: Type.Optional(Type.Array(Type.String(), { description: "Concepts taught (used for quizzes, gaps and reviews)" })),
	prerequisites: Type.Optional(Type.Array(Type.String())),
});

const SyllabusInput = Type.Object({
	topic: Type.String({ description: "Topic name (folder name, notes language)" }),
	home: Type.Optional(Type.String({ description: "Home subject when the topic already exists in ANOTHER subject (linked, not copied). Omit for topics living in this subject." })),
	difficulty: Type.Integer({ minimum: 1, maximum: 5 }),
	estLessons: Type.Optional(Type.Integer({ minimum: 1 })),
	prerequisites: Type.Optional(Type.Array(Type.String(), { description: "Topic names (this syllabus or other subjects)" })),
	note: Type.Optional(Type.String({ description: "Why it is here / angle needed, e.g. 'bridge: vectors as forces'" })),
});

const Assessment = Type.Object({
	level: Type.String({ description: "e.g. beginner / intermediate / advanced, with nuance" }),
	summary: Type.String(),
	known: Type.Array(Type.String()),
	weak: Type.Array(Type.String()),
});

const ACTIONS = [
	"overview",
	"subject_overview",
	"find_topic",
	"paths",
	"set_subject_assessment",
	"set_syllabus",
	"set_assessment",
	"set_plan",
	"set_lesson_status",
	"set_active",
	"set_kind",
] as const;

const Params = Type.Object({
	action: StringEnum(ACTIONS, {
		description: [
			"overview: progress summary.",
			"subject_overview: syllabus and status of a subject.",
			"find_topic: existing topics with a given name in any subject (check before creating topics).",
			"paths: canonical note paths (subject, topic, lessons, attempt notes, exams).",
			"set_subject_assessment: store the broad assessment (and goal) of a subject.",
			"set_syllabus: store/revise the ordered topics of a subject (link topics of other subjects with `home`).",
			"set_assessment: store a topic's knowledge assessment.",
			"set_plan: store/revise a topic's study plan.",
			"set_lesson_status: planned/in-progress/done.",
			"set_active: choose the active subject/topic/lesson.",
			"set_kind: set the lesson kind (and programming language) of a subject, or override it for one topic (lessonKind 'inherit' removes the override); call without lessonKind to list the kinds.",
		].join(" "),
	}),
	subject: Type.Optional(Type.String({ description: "Subject (course), e.g. 'Calculus 1'. Defaults to the active subject." })),
	topic: Type.Optional(Type.String({ description: "Topic name, or 'Subject/Topic'. Defaults to the active topic. Topics linked from other subjects are found automatically." })),
	lesson: Type.Optional(Type.Integer({ minimum: 1, description: "Lesson number" })),
	status: Type.Optional(StringEnum(["planned", "in-progress", "done"] as const)),
	goal: Type.Optional(Type.String({ description: "Subject goal (exam, course, curiosity, work…)" })),
	finalExam: Type.Optional(Type.Boolean({ description: "set_syllabus: end the subject with a final exam (default true)" })),
	assessment: Type.Optional(Assessment),
	items: Type.Optional(Type.Array(SyllabusInput, { description: "set_syllabus: topics ordered by dependency, then increasing difficulty" })),
	blocks: Type.Optional(
		Type.Array(Type.Object({ name: Type.String(), lessons: Type.Array(LessonInput) }), {
			description: "set_plan: ordered blocks; lessons inside each block sorted by increasing difficulty.",
		}),
	),
	kind: Type.Optional(StringEnum(["quiz", "test", "exercises", "exam"] as const, { description: "paths: also return the next attempt note path (exam = subject final exam)" })),
	scope: Type.Optional(Type.String({ description: "paths: scope label for the attempt note, e.g. 'L03 Dot product', 'Block 1', 'Final'" })),
	concept: Type.Optional(Type.String({ description: "paths: also return the reinforcement note path for this concept" })),
	lessonKind: Type.Optional(
		Type.String({ description: "set_kind / set_syllabus / set_subject_assessment: lesson template kind: math, physics, cs, programming, generic, or a custom kind of the vault" }),
	),
	language: Type.Optional(Type.String({ description: "set_kind / set_syllabus: programming language chosen by the learner, with version if relevant (e.g. 'Python 3.12', 'C++20')" })),
});

function kindLine(ws: Workspace, kind: string, language?: string): string {
	const tpl = kindTemplate(ws, kind);
	return `Lesson kind: ${kind}${language ? ` · language: ${language}` : ""} · template: ${tpl ? `${toPosix(tpl.path)} (${tpl.source})` : "MISSING — create it (skill lesson-kinds) or choose another kind"}`;
}

function describeKinds(ws: Workspace): string {
	return listKinds(ws)
		.map((k) => `- ${k.id} (${k.source}): ${k.use}`)
		.join("\n");
}

/** Validate and apply lessonKind/language to a subject or topic. Returns a report line. */
function applyKind(ws: Workspace, target: { lessonKind?: string; language?: string }, kind?: string, language?: string): string {
	if (kind !== undefined) {
		if (kind === "inherit") delete target.lessonKind;
		else {
			if (!isValidKindId(kind)) throw new Error(`Invalid lesson kind "${kind}": use lowercase letters, digits and dashes.`);
			if (!kindTemplate(ws, kind)) throw new Error(`No template for lesson kind "${kind}". Available:\n${describeKinds(ws)}\nTo create a custom kind, write ${toPosix(customKindPath(ws, kind))} first (skill lesson-kinds).`);
			target.lessonKind = kind;
		}
	}
	if (language !== undefined) {
		if (language.trim() === "" || language === "inherit") delete target.language;
		else target.language = language.trim();
	}
	return "";
}

type Details = { action: string; topicKey?: string; subject?: string };

function rel(ws: Workspace, p: string): string {
	return toPosix(relative(notesRoot(ws), p));
}

function nextAttempt(dir: string, prefix: string): number {
	if (!existsSync(dir)) return 1;
	return readdirSync(dir).filter((f) => f.startsWith(prefix)).length + 1;
}

function activeSubject(state: LcState, name?: string): Subject | undefined {
	const key = name ? safeName(name) : state.active?.subject;
	return key ? state.subjects[key] : undefined;
}

/** Resolve the topic for an action: explicit topic (following links), else the active one. */
function resolveTopic(state: LcState, subject?: string, topic?: string): Topic | undefined {
	if (topic) return resolveTopicRef(state, topic, subject ?? state.active?.subject);
	return state.active?.topicKey ? state.topics[state.active.topicKey] : undefined;
}

/** Make sure a topic created outside a syllabus belongs to a subject entity. */
function attachToSubject(state: LcState, t: Topic, subjectName: string, date: string): string | undefined {
	const s = ensureSubject(state, subjectName, date);
	const key = topicKey(t.subject, t.topic);
	linkTopic(t, s.name);
	if (s.syllabus.some((i) => i.topicKey === key)) return undefined;
	if (s.syllabus.length === 0 && s.status === "assessing") {
		// Ad-hoc subject born from /learn: no subject assessment, no final exam unless planned later.
		s.status = "in-progress";
		s.finalExam = false;
	}
	s.syllabus.push({ topicKey: key, difficulty: 3 });
	s.updatedAt = date;
	return `Added "${t.topic}" to the syllabus of "${s.name}" (at the end; revise with set_syllabus if needed).`;
}

/** Number the topic folders of a subject in syllabus order (when enabled). Returns a short report. */
function numberFolders(ws: Workspace, state: LcState, subject: string): string {
	if (ws.config.numberTopicFolders !== true) return "";
	const r = renumberTopics(state, notesRoot(ws), [subject]);
	const parts: string[] = [];
	if (r.moved.length) parts.push(`Renumbered ${r.moved.length} topic folder(s) to follow the syllabus (${r.filesUpdated} note(s) with updated links).`);
	if (r.conflicts.length) parts.push(`Could not rename: ${r.conflicts.map((c) => `${c.from} → ${c.to}`).join(", ")} (target exists or folder in use).`);
	return parts.join(" ");
}

function describeTopic(ws: Workspace, state: LcState, t: Topic): string {
	const vault = notesRoot(ws);
	const key = topicKey(t.subject, t.topic);
	const tp = topicPaths(vault, t.subject, topicFolder(t));
	const subs = topicSubjects(t);
	const out = [`## Topic ${t.topic} — ${t.status} (home: ${t.subject}${subs.length > 1 ? `; also in ${subs.filter((s) => s !== t.subject).join(", ")}` : ""})`];
	if (t.assessment) out.push(`Assessment (${t.assessment.date}): ${t.assessment.level}. ${t.assessment.summary}`);
	const tk = topicKind(state, t);
	out.push(kindLine(ws, tk.kind, tk.language) + (t.lessonKind ? " (topic override)" : ""));
	out.push(`Index: ${rel(ws, tp.topicIndex)} · Study plan: ${rel(ws, tp.studyPlan)}`);
	for (const l of t.lessons) {
		const lp = lessonPaths(vault, t.subject, topicFolder(t), l.n, l.title);
		const end = isEndOfBlock(t, l.n) ? " ⟵ end of block (checkpoint)" : "";
		out.push(`- ${l.n}. [${l.status}] ${l.title} · block "${l.block}" · d${l.difficulty} · ${rel(ws, lp.note)}${end}`);
	}
	const next = nextLesson(t);
	if (next) out.push(`Next lesson: ${next.n}. ${next.title}`);
	const gaps = state.gaps.filter((g) => g.status === "open" && g.topicKey === key);
	if (gaps.length) out.push(`Open gaps: ${gaps.map((g) => `${g.concept}${g.reinforcement ? ` (note: ${g.reinforcement})` : ""}`).join("; ")}`);
	const last = state.attempts.filter((a) => a.topicKey === key).slice(-3);
	if (last.length) out.push(`Recent attempts: ${last.map((a) => `${a.kind} "${a.scope}" ${Math.round(a.score * 100)}%${a.passed ? " ✓" : " ✗"}`).join("; ")}`);
	return out.join("\n");
}

function describeSubject(ws: Workspace, state: LcState, s: Subject): string {
	const vault = notesRoot(ws);
	const { done, total } = subjectProgress(state, s);
	const out = [`## Subject ${s.name} — ${s.status}, ${done}/${total} topics done${s.finalExam ? `, final exam ${s.examPassed ? `passed ${s.examPassed}` : "pending"}` : ""}`];
	if (s.goal) out.push(`Goal: ${s.goal}`);
	if (s.assessment) out.push(`Assessment (${s.assessment.date}): ${s.assessment.level}. ${s.assessment.summary}`);
	out.push(s.lessonKind ? kindLine(ws, s.lessonKind, s.language) : `Lesson kind: not chosen (default ${DEFAULT_KIND}) — agree one with the learner (skill lesson-kinds), then set_kind.`);
	out.push(`Index: ${rel(ws, subjectPaths(vault, s.name).index)}`);
	s.syllabus.forEach((i, k) => {
		const t = state.topics[i.topicKey];
		const linked = t && t.subject !== s.name ? ` (linked from ${t.subject})` : "";
		const lessons = t?.lessons.length ? ` · ${t.lessons.filter((l) => l.status === "done").length}/${t.lessons.length} lessons` : i.estLessons ? ` · ~${i.estLessons} lessons` : "";
		const pre = i.prerequisites?.length ? ` · after: ${i.prerequisites.map((p) => state.topics[p]?.topic ?? p).join(", ")}` : "";
		out.push(`${k + 1}. [${t?.status ?? "missing"}] ${t?.topic ?? i.topicKey}${linked} · d${i.difficulty}${lessons}${pre}${i.note ? ` · ${i.note}` : ""}`);
	});
	const next = nextSubjectTopic(state, s);
	if (next) {
		const missing = missingPrerequisites(state, topicKey(next.subject, next.topic));
		out.push(
			`Next topic: ${next.topic}${next.subject !== s.name ? ` (home ${next.subject})` : ""}${missing.length ? ` — ⚠ prerequisites not done yet: ${missing.map((t) => `${t.topic} (${t.subject})`).join(", ")}. Propose studying them first (or a short refresher if the learner already knows them).` : ""}`,
		);
	}
	if (examDue(state, s)) out.push("All topics done: the FINAL EXAM is due (skill quiz-and-exercises, kind exam).");
	return out.join("\n");
}

export const stateTools = [
	defineTool({
		name: "learning_state",
		label: "Learning state",
		description:
			"Learning bookkeeping for the workspace: subjects (courses with an ordered syllabus of topics; a topic lives in one home subject and can be linked from others), topics (assessment, study plan, lessons), lesson status, active subject/topic, canonical note paths and progress overview.",
		parameters: Params,
		sequential: true,
		async execute(p, env) {
			const ws = requireWorkspace();
			const vault = notesRoot(ws);
			const date = today();

			// ------------------------------------------------------------- read-only
			if (p.action === "overview") {
				const state = readState();
				const parts = [
					`Active: subject ${state.active?.subject ?? "none"} · topic ${state.active?.topicKey ?? "none"}${state.active?.lesson ? ` · lesson ${state.active.lesson}` : ""}`,
					`Reviews due: ${dueItems(state.reviews, date).length} · Open gaps: ${state.gaps.filter((g) => g.status === "open").length}`,
				];
				const subj = activeSubject(state, p.subject);
				if (subj) parts.push(describeSubject(ws, state, subj));
				const focus = resolveTopic(state, p.subject, p.topic);
				if (focus) parts.push(describeTopic(ws, state, focus));
				for (const s of Object.values(state.subjects)) {
					if (s === subj) continue;
					const { done, total } = subjectProgress(state, s);
					parts.push(`- Subject ${s.name}: ${s.status}, ${done}/${total} topics`);
				}
				const inSyllabus = new Set(Object.values(state.subjects).flatMap((s) => s.syllabus.map((i) => i.topicKey)));
				for (const [key, t] of Object.entries(state.topics)) {
					if (!inSyllabus.has(key) && t !== focus) parts.push(`- Topic ${key} (no subject syllabus): ${t.status}`);
				}
				if (Object.keys(state.subjects).length === 0 && Object.keys(state.topics).length === 0) parts.push("No subjects or topics yet.");
				return textResult(parts.join("\n"), { action: p.action } as Details);
			}

			if (p.action === "subject_overview") {
				const state = readState();
				const s = activeSubject(state, p.subject);
				if (!s) throw new Error(p.subject ? `Subject "${p.subject}" not found.` : "No active subject.");
				return textResult(describeSubject(ws, state, s), { action: p.action, subject: s.name } as Details);
			}

			if (p.action === "find_topic") {
				if (!p.topic) throw new Error("topic is required");
				const state = readState();
				const found = findTopicsByName(state, p.topic);
				if (found.length === 0) return textResult(`No existing topic matches "${p.topic}": it can be created in the new subject.`, { action: p.action } as Details);
				const lines = found.map((t) => {
					const done = t.lessons.filter((l) => l.status === "done").length;
					return `- ${topicKey(t.subject, t.topic)} · ${t.status} · ${done}/${t.lessons.length} lessons · subjects: ${topicSubjects(t).join(", ")}${t.assessment ? ` · level ${t.assessment.level}` : ""}`;
				});
				return textResult(
					`Existing topics matching "${p.topic}" (link with home = their subject, or create a distinct bridge topic):\n${lines.join("\n")}`,
					{ action: p.action } as Details,
				);
			}

			if (p.action === "paths") {
				const state = readState();
				const out: string[] = [];
				const subjName = p.subject ? safeName(p.subject) : state.active?.subject;
				if (subjName) {
					const sp = subjectPaths(vault, subjName);
					out.push(`Subject index: ${rel(ws, sp.index)} · Exams dir: ${rel(ws, sp.examsDir)}`);
					if (p.kind === "exam") {
						const scope = p.scope ?? "Final";
						const n = nextAttempt(sp.examsDir, `Exam - ${safeName(scope)} - `);
						out.push(`Next exam note (attempt ${n}): ${rel(ws, examNotePath(sp, scope, n))}`);
					}
				}
				const t = p.kind === "exam" && !p.topic ? undefined : resolveTopic(state, p.subject, p.topic);
				if (t) {
					const tp = topicPaths(vault, t.subject, topicFolder(t));
					// Topics created before the topic flashcards note existed get it on first use.
					if (ws.config.flashcards) scaffoldTopic(ws, t);
					const tk = topicKind(state, t);
					out.push(
						`${kindLine(ws, tk.kind, tk.language)} — write lessons with THIS template (its comment block lists the sections and checks).`,
						`Topic (home ${t.subject}) index: ${rel(ws, tp.topicIndex)}`,
						`Study plan: ${rel(ws, tp.studyPlan)} · Lessons dir: ${rel(ws, tp.lessonsDir)}`,
						...(ws.config.flashcards ? [`Flashcards note (append a "## N. Lesson title" section per lesson, one "### N.k" heading per multi-line card): ${rel(ws, tp.flashcards)}`] : []),
						`Quizzes dir: ${rel(ws, tp.quizzesDir)} · Tests dir: ${rel(ws, tp.testsDir)} · Exercises dir: ${rel(ws, tp.exercisesDir)}`,
					);
					for (const l of t.lessons.filter((x) => !p.lesson || x.n === p.lesson)) {
						const lp = lessonPaths(vault, t.subject, topicFolder(t), l.n, l.title);
						const code = tk.kind === "programming" || tk.kind === "cs" ? ` · code ${rel(ws, lp.code)}` : "";
						out.push(`Lesson ${l.n}: note ${rel(ws, lp.note)} · media ${rel(ws, lp.media)}${code}`);
						if (p.concept) out.push(`Reinforcement (${p.concept}): ${rel(ws, reinforcementPath(lp, p.concept))}`);
					}
					if (p.kind && p.kind !== "exam" && p.scope) {
						const label = p.kind === "quiz" ? "Quiz" : p.kind === "test" ? "Test" : "Exercises";
						const dir = p.kind === "quiz" ? tp.quizzesDir : p.kind === "test" ? tp.testsDir : tp.exercisesDir;
						const n = nextAttempt(dir, `${label} - ${safeName(p.scope)} - `);
						out.push(`Next ${p.kind} note (attempt ${n}): ${rel(ws, attemptNotePath(tp, p.kind, p.scope, n))}`);
					}
					const v = topicVars(vault, t, topicSubjects(t));
					out.push(
						`Template values: subject="${v.subject}" topic="${v.topic}" subjects=[${v.subjectsList}] subjectTag=${v.subjectTag} topicTag=${v.topicTag} flashcardTag=${v.flashcardTag} language="${tk.language ?? ""}" kind=${tk.kind} date=${v.date} threshold=${Math.round(ws.config.passThreshold * 100)}`,
					);
				} else if (subjName) {
					out.push(`Template values: subject="${subjName}" subjectTag=subject/${tagSlug(subjName)} date=${date}`);
				}
				if (out.length === 0) throw new Error("Give a subject and/or topic (nothing is active).");
				out.push("(Paths are relative to the vault root.)");
				return textResult(out.join("\n"), { action: p.action, topicKey: t ? topicKey(t.subject, t.topic) : undefined } as Details);
			}

			// ------------------------------------------------------------- lesson kinds
			if (p.action === "set_kind") {
				if (p.lessonKind === undefined && p.language === undefined) {
					return textResult(`Lesson kinds available:\n${describeKinds(ws)}\nCustom kinds: ${toPosix(customKindPath(ws, "<id>"))} (skill lesson-kinds).`, { action: p.action } as Details);
				}
				return mutateState((state) => {
					if (p.topic) {
						const t = resolveTopic(state, p.subject, p.topic);
						if (!t) throw new Error(`Topic "${p.topic}" not found.`);
						applyKind(ws, t, p.lessonKind, p.language);
						const tk = topicKind(state, t);
						return textResult(`Topic ${t.topic}: ${kindLine(ws, tk.kind, tk.language)}${t.lessonKind ? " (topic override)" : " (from its subject)"}.`, { action: p.action, topicKey: topicKey(t.subject, t.topic) } as Details);
					}
					const s = activeSubject(state, p.subject);
					if (!s) throw new Error("subject is required (nothing is active).");
					applyKind(ws, s, p.lessonKind, p.language);
					s.updatedAt = date;
					return textResult(`Subject ${s.name} updated. Existing lessons keep their layout; convert them only if the learner asks (skill lesson-kinds).\n${describeSubject(ws, state, s)}`, { action: p.action, subject: s.name } as Details);
				});
			}

			// ------------------------------------------------------------- subject writes
			if (p.action === "set_subject_assessment" || p.action === "set_syllabus") {
				const name = p.subject ?? readState().active?.subject;
				if (!name) throw new Error("subject is required");
				return mutateState((state) => {
					if (p.action === "set_subject_assessment") {
						if (!p.assessment) throw new Error("assessment is required");
						const s = setSubjectAssessment(state, name, { ...p.assessment, date }, p.goal);
						applyKind(ws, s, p.lessonKind, p.language);
						state.active = { subject: s.name };
						const created = scaffoldSubject(ws, s);
						return textResult(
							`Subject assessment saved for "${s.name}" (${p.assessment.level}).${created.length ? ` Created: ${created.map((c) => rel(ws, c)).join(", ")}.` : ""} Next: syllabus (skill subject-plan), then set_syllabus.`,
							{ action: p.action, subject: s.name } as Details,
						);
					}
					if (!p.items?.length) throw new Error("items are required");
					const r = setSyllabus(state, name, p.items, { goal: p.goal, finalExam: p.finalExam }, date);
					applyKind(ws, r.subject, p.lessonKind, p.language);
					const next = nextSubjectTopic(state, r.subject);
					state.active = { subject: r.subject.name, topicKey: next ? topicKey(next.subject, next.topic) : undefined };
					const renum = numberFolders(ws, state, r.subject.name);
					scaffoldSubject(ws, r.subject);
					for (const t of r.created) scaffoldTopic(ws, t);
					const extra = [
						renum,
						r.created.length ? `New topics: ${r.created.map((t) => t.topic).join(", ")}.` : "",
						r.linked.length ? `Linked from other subjects: ${r.linked.map((t) => `${t.topic} (${t.subject})`).join(", ")}.` : "",
						r.removed.length ? `Removed: ${r.removed.join(", ")}.` : "",
						...r.warnings,
					].filter(Boolean);
					return textResult(`Syllabus saved.\n${extra.join("\n")}\n${describeSubject(ws, state, r.subject)}`, { action: p.action, subject: r.subject.name } as Details);
				});
			}

			// ------------------------------------------------------------- topic writes
			return mutateState((state) => {
				const subjectHint = p.subject ? safeName(p.subject) : state.active?.subject;
				let t = resolveTopic(state, p.subject, p.topic);
				let createdNow = false;

				if (p.action === "set_active" && !p.topic && p.subject) {
					const s = state.subjects[safeName(p.subject)];
					if (!s) throw new Error(`Subject "${p.subject}" not found.`);
					const next = nextSubjectTopic(state, s);
					state.active = { subject: s.name, topicKey: next ? topicKey(next.subject, next.topic) : undefined, lesson: next ? nextLesson(next)?.n : undefined };
					return textResult(`Active subject: ${s.name}.\n${describeSubject(ws, state, s)}`, { action: p.action, subject: s.name } as Details);
				}

				if (!t) {
					if (!p.topic || !subjectHint) throw new Error("subject and topic are required (nothing is active).");
					if (p.action !== "set_assessment" && p.action !== "set_plan") throw new Error(`Topic "${p.topic}" not found.`);
					const same = findTopicsByName(state, p.topic).filter((x) => safeName(x.topic).toLowerCase() === safeName(p.topic!).toLowerCase());
					if (same.length) throw new Error(`Topic "${p.topic}" already exists in subject "${same[0].subject}". Pass topic "${same[0].subject}/${same[0].topic}" to use it.`);
					t = ensureTopic(state, subjectHint, p.topic, date);
					createdNow = true;
				}
				const key = topicKey(t.subject, t.topic);
				// The subject being studied: explicit, else the active one when the topic belongs to it, else its home.
				const activeSubj = state.active?.subject;
				const studySubject = p.subject
					? safeName(p.subject)
					: activeSubj && (createdNow || topicSubjects(t).includes(activeSubj))
						? activeSubj
						: t.subject;
				const notes: string[] = [];

				switch (p.action) {
					case "set_assessment": {
						if (!p.assessment) throw new Error("assessment is required");
						setAssessment(state, t.subject, t.topic, { ...p.assessment, date });
						const msg = attachToSubject(state, t, studySubject, date);
						if (msg) notes.push(msg);
						notes.push(numberFolders(ws, state, t.subject));
						state.active = { subject: studySubject, topicKey: key };
						const created = [...scaffoldSubject(ws, state.subjects[studySubject]), ...scaffoldTopic(ws, t)];
						return textResult(
							`Assessment saved for ${key} (${p.assessment.level}). ${notes.filter(Boolean).join(" ")}${created.length ? ` Created: ${created.map((c) => rel(ws, c)).join(", ")}.` : ""} Next: study plan (skill study-plan).`,
							{ action: p.action, topicKey: key } as Details,
						);
					}
					case "set_plan": {
						if (!p.blocks?.length) throw new Error("blocks are required");
						setPlan(state, t.subject, t.topic, p.blocks, date);
						const msg = attachToSubject(state, t, studySubject, date);
						if (msg) notes.push(msg);
						notes.push(numberFolders(ws, state, t.subject));
						state.active = { subject: studySubject, topicKey: key, lesson: nextLesson(t)?.n };
						scaffoldTopic(ws, t);
						refreshSubjectsOfTopic(state, t, date);
						return textResult(`Plan saved (${t.lessons.length} lessons in ${t.blocks.length} blocks). ${notes.filter(Boolean).join(" ")}\n${describeTopic(ws, state, t)}`, {
							action: p.action,
							topicKey: key,
						} as Details);
					}
					case "set_lesson_status": {
						if (!p.lesson || !p.status) throw new Error("lesson and status are required");
						const l = setLessonStatus(t, p.lesson, p.status, date);
						refreshSubjectsOfTopic(state, t, date);
						const next = nextLesson(t);
						state.active = { subject: studySubject, topicKey: key, lesson: p.status === "done" ? next?.n : l.n };
						const checkpoint = p.status === "done" && isEndOfBlock(t, l.n) ? ` Lesson ${l.n} closes block "${l.block}": suggest a checkpoint quiz/exercises.` : "";
						const s = state.subjects[studySubject];
						const after = next
							? ` Next: ${next.n}. ${next.title}.`
							: ` All lessons done: suggest the topic test.${s ? ` Then the subject continues with: ${nextSubjectTopic(state, s)?.topic ?? (examDue(state, s) ? "the FINAL EXAM" : "nothing (subject complete)")}.` : ""}`;
						return textResult(`Lesson ${l.n} "${l.title}" → ${l.status}.${checkpoint}${after}`, { action: p.action, topicKey: key } as Details);
					}
					case "set_active": {
						state.active = { subject: studySubject, topicKey: key, lesson: p.lesson ?? nextLesson(t)?.n };
						return textResult(`Active: ${studySubject} › ${t.topic}${state.active.lesson ? `, lesson ${state.active.lesson}` : ""}.\n${describeTopic(ws, state, t)}`, {
							action: p.action,
							topicKey: key,
						} as Details);
					}
					default:
						throw new Error(`Unknown action ${p.action}`);
				}
			});
		},
	}),
];
