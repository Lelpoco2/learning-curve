/** quiz_ask (interactive questions) and quiz_record (grading bookkeeping). */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { StringEnum } from "../lib/schema.ts";
import { type Static, Type } from "../lib/schema.ts";
import { findTopic } from "../lib/curriculum.ts";
import { mathText as renderMathText } from "../lib/mathtext.ts";
import type { UiPort } from "../lib/tool.ts";
import { resolveTopicRef, subjectTopicKeys, updateSubjectStatus } from "../lib/subjects.ts";
import { lessonPaths, reinforcementPath, safeName, toPosix, topicFolder } from "../lib/paths.ts";
import { recordAttempt } from "../lib/scoring.ts";
import { type LcState, today, topicKey } from "../lib/types.ts";
import { notesRoot } from "../lib/workspace.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { mutateState, requireWorkspace, resolveInVault, textResult } from "../runtime.ts";

// ---------------------------------------------------------------- quiz_ask

const QuestionSchema = Type.Object({
	id: Type.String({ description: "Short id, e.g. q1" }),
	type: StringEnum(["mcq", "numeric", "short", "open", "proof"] as const),
	prompt: Type.String({ description: "Question text. LaTeX allowed ($…$); keep it readable in a terminal." }),
	options: Type.Optional(Type.Array(Type.String(), { description: "mcq only: answer options" })),
	hints: Type.Optional(Type.Array(Type.String(), { description: "Progressive hints, from gentle to specific (guided mode)" })),
	askWhy: Type.Optional(Type.Boolean({ description: "Ask the learner to justify the answer (default true except mcq in independent mode)" })),
	unit: Type.Optional(Type.String({ description: "numeric only: expected unit, shown to the learner" })),
});

const AskParams = Type.Object({
	title: Type.Optional(Type.String()),
	preface: Type.Optional(
		Type.String({
			description:
				"Short text (max 4 lines) shown at the top of the first question, e.g. the verdict on the previous answer. Text written before this tool call may be pushed off-screen by the dialog: put anything the learner must read here, or send it in a turn of its own.",
		}),
	),
	mode: Type.Optional(StringEnum(["guided", "independent"] as const, { description: "guided: hints available. Default independent." })),
	questions: Type.Array(QuestionSchema, { minItems: 1 }),
});

export interface AskAnswer {
	id: string;
	answer?: string;
	why?: string;
	hintsUsed: number;
	skipped: boolean;
	seconds: number;
	/** Changed during the review before submitting (compared with the first answer). */
	changed?: boolean;
	firstAnswer?: string;
	firstWhy?: string;
}

export interface AskDetails {
	title?: string;
	mode: string;
	answers: AskAnswer[];
	cancelled: boolean;
}

const HINT = "💡 Hint";
const OWN = "✎ Write my own answer";
const SKIP = "⏭ Skip";
const SUBMIT = "✓ Submit answers";
const SKIPPED_LABEL = "(skipped)";

type Question = Static<typeof QuestionSchema>;
type AskParamsT = Static<typeof AskParams>;

/** One line, at most `max` characters (for the review list). */
function clip(s: string, max = 60): string {
	const one = s.replace(/\s*\n\s*/g, " ").trim();
	return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

function header(i: number, n: number, mode: string, title?: string): string {
	return `${title ? `${title} · ` : ""}Question ${i + 1}/${n}${mode === "guided" ? " · guided" : ""}`;
}

/**
 * Ask one question. With `previous` (review), the current answer is shown and pre-filled, hints
 * already revealed stay visible, and Esc keeps the current answer (returns undefined).
 */
async function askOne(
	ui: UiPort,
	q: Question,
	i: number,
	n: number,
	mode: string,
	title?: string,
	previous?: AskAnswer,
	preface?: string,
): Promise<AskAnswer | undefined> {
	const start = Date.now();
	// Math is shown rendered (Unicode) in the dialogs; answers go back to the tutor as LaTeX.
	const hints = (mode === "guided" ? (q.hints ?? []) : []).map((h) => renderMathText(h));
	const shown: string[] = hints.slice(0, previous?.hintsUsed ?? 0);
	const head =
		(preface?.trim() ? `${renderMathText(preface.trim())}\n\n` : "") +
		header(i, n, mode, title ? renderMathText(title) : undefined) +
		(previous ? " · changing (Esc keeps the current answer)" : "");
	const current = previous ? `\n\nCurrent answer: ${previous.skipped ? SKIPPED_LABEL : renderMathText(previous.answer ?? "")}` : "";
	const prompt = renderMathText(q.prompt) + current;
	const hintBlock = () => (shown.length ? `\n\n${shown.map((h, k) => `💡 Hint ${k + 1}: ${h}`).join("\n")}` : "");
	let answer: string | undefined;

	if (q.type === "mcq" && q.options?.length) {
		const letter = (k: number) => String.fromCharCode(65 + k);
		// Options may arrive already lettered ("A) …"): keep one letter.
		const bare = q.options.map((o) => o.replace(/^\s*[A-Za-z][).:]\s+/, ""));
		const letters = bare.map((o, k) => `${letter(k)}) ${renderMathText(o).replace(/\n+/g, " ")}`);
		for (;;) {
			const extra = [...(shown.length < hints.length ? [HINT] : []), OWN, SKIP];
			const choice = await ui.select(`${head}\n\n${prompt}${hintBlock()}`, [...letters, ...extra]);
			if (choice === undefined) return undefined;
			if (choice === HINT) {
				shown.push(hints[shown.length]);
				continue;
			}
			if (choice === SKIP) return { id: q.id, skipped: true, hintsUsed: shown.length, seconds: secs(start) };
			if (choice === OWN) {
				const own = await ui.editor(
					`${head}\n${prompt}\n\nYour answer:`,
					previous && !previous.skipped && !/^[A-Z]\) /.test(previous.answer ?? "") ? (previous.answer ?? "") : "",
					"Your answer",
				);
				if (own === undefined) return undefined;
				answer = own.trim();
			} else {
				const k = letters.indexOf(choice);
				answer = k >= 0 ? `${letter(k)}) ${bare[k]}` : choice;
			}
			break;
		}
	} else {
		const instructions = [
			q.unit ? `Unit: ${q.unit}.` : "",
			hints.length ? "Submit a single ? for a hint." : "",
			"Submit empty to skip.",
		]
			.filter(Boolean)
			.join(" ");
		for (;;) {
			const text = await ui.editor(
				`${head}\n\n${prompt}${hintBlock()}\n\n${instructions}`,
				previous && !previous.skipped ? (previous.answer ?? "") : "",
				`Answer${q.unit ? ` (${q.unit})` : ""}${hints.length > shown.length ? " — ? for a hint" : ""} — empty to skip`,
			);
			if (text === undefined) return undefined;
			const t = text.trim();
			if (t === "?" && shown.length < hints.length) {
				shown.push(hints[shown.length]);
				continue;
			}
			if (t === "" || t === "?") return { id: q.id, skipped: true, hintsUsed: shown.length, seconds: secs(start) };
			answer = t;
			break;
		}
	}

	let why: string | undefined;
	const wantWhy = q.askWhy ?? !(q.type === "mcq" && mode === "independent");
	if (wantWhy && answer) {
		const w = await ui.editor(
			`${head}\n\nYour answer: ${renderMathText(answer)}\n\nWhy? Explain your reasoning in a few lines.`,
			previous?.why ?? "",
			"Why? Explain your reasoning",
		);
		if (w === undefined) return { id: q.id, answer, why: previous?.why, hintsUsed: shown.length, skipped: false, seconds: secs(start) };
		why = w.trim() || undefined;
	}
	return { id: q.id, answer, why, hintsUsed: shown.length, skipped: false, seconds: secs(start) };
}

function secs(start: number): number {
	return Math.round((Date.now() - start) / 1000);
}

/** Merge a re-answer into the previous one, tracking the first answer to report changes. */
export function mergeRevision(prev: AskAnswer, next: AskAnswer): AskAnswer {
	const firstAnswer = prev.changed ? prev.firstAnswer : prev.skipped ? SKIPPED_LABEL : prev.answer;
	const firstWhy = prev.changed ? prev.firstWhy : prev.why;
	const nowAnswer = next.skipped ? SKIPPED_LABEL : next.answer;
	const changed = nowAnswer !== firstAnswer || next.why !== firstWhy;
	return {
		...next,
		seconds: prev.seconds + next.seconds,
		hintsUsed: Math.max(prev.hintsUsed, next.hintsUsed),
		changed: changed || undefined,
		firstAnswer: changed ? firstAnswer : undefined,
		firstWhy: changed ? firstWhy : undefined,
	};
}

/**
 * Ask every question; with two or more, show a review list before submitting where the learner
 * can pick any question to change its answer or justification.
 */
export async function runQuiz(ui: UiPort, p: AskParamsT): Promise<AskDetails> {
	const mode = p.mode ?? "independent";
	const n = p.questions.length;
	const answers: AskAnswer[] = [];
	let cancelled = false;
	for (let i = 0; i < n; i++) {
		const a = await askOne(ui, p.questions[i], i, n, mode, p.title, undefined, i === 0 ? p.preface : undefined);
		if (!a) {
			cancelled = true;
			break;
		}
		answers.push(a);
	}
	if (!cancelled && n >= 2) {
		const title = `${p.title ? `${renderMathText(p.title)} · ` : ""}Review your answers — choose one to change it, or submit`;
		for (;;) {
			const items = answers.map(
				(a, i) =>
					`${i + 1}. ${clip(renderMathText(p.questions[i].prompt), 50)} → ${a.skipped ? SKIPPED_LABEL : clip(renderMathText(a.answer ?? ""), 40)}${a.changed ? "  ✎" : ""}`,
			);
			const choice = await ui.select(title, [...items, SUBMIT]);
			if (choice === SUBMIT) break;
			if (choice === undefined) {
				if (await ui.confirm("Submit your answers?", "Yes = send them to the tutor now. No = back to the review.")) break;
				continue;
			}
			const i = items.indexOf(choice);
			if (i < 0) continue;
			const next = await askOne(ui, p.questions[i], i, n, mode, p.title, answers[i]);
			if (next) answers[i] = mergeRevision(answers[i], next);
		}
	}
	return { title: p.title, mode, answers, cancelled };
}

export function formatQuizResult(questions: Question[], d: AskDetails): string {
	const lines = d.answers.map((a) => {
		const q = questions.find((x) => x.id === a.id);
		const change = a.changed
			? `\n   changed during review — first answer: ${a.firstAnswer ?? SKIPPED_LABEL}${a.firstWhy !== a.why ? `${a.firstWhy ? ` (first why: ${a.firstWhy})` : ""}` : ""}`
			: "";
		if (a.skipped) return `${a.id}: SKIPPED (hints used: ${a.hintsUsed})${change}`;
		return `${a.id}${q ? ` [${q.type}]` : ""}: answer: ${a.answer}${a.why ? `\n   why: ${a.why}` : ""}\n   hints used: ${a.hintsUsed}, time: ${a.seconds}s${change}`;
	});
	if (d.cancelled) lines.push(`Learner stopped the quiz after ${d.answers.length}/${questions.length} questions.`);
	const changed = d.answers.filter((a) => a.changed).length;
	if (changed) lines.push(`${changed} answer(s) changed during the review: a sign of uncertainty worth addressing in the feedback.`);
	return lines.join("\n") || "No answers.";
}

// ---------------------------------------------------------------- quiz_record

const ResultSchema = Type.Object({
	concept: Type.String({ description: "Concept the question tests (reuse the plan's concept names)" }),
	correct: StringEnum(["yes", "partial", "no"] as const),
	reasoning: Type.Optional(StringEnum(["sound", "partial", "flawed", "missing", "n/a"] as const, { description: "Quality of the justification" })),
	guided: Type.Optional(Type.Boolean({ description: "Question answered with hints (excluded from score)" })),
	error: Type.Optional(Type.String({ description: "The misconception or error, in a few words" })),
	topic: Type.Optional(Type.String({ description: "Topic of this question (exams and subject assessments span several topics)" })),
});

const RecordParams = Type.Object({
	kind: StringEnum(["assessment", "quiz", "test", "exercises", "retest", "review", "exam"] as const, {
		description: "exam = final exam of a subject (questions span its topics). An assessment with a subject and no topic is a subject-level assessment.",
	}),
	scope: Type.String({ description: "What was tested, e.g. 'L03 Dot product', 'Block 1', 'Topic test', 'Final'" }),
	subject: Type.Optional(Type.String({ description: "Subject (required for exams and subject assessments; defaults to the active subject)" })),
	topic: Type.Optional(Type.String({ description: "Topic of a topic-level attempt (defaults to the active topic)" })),
	lesson: Type.Optional(Type.Integer({ minimum: 1 })),
	note: Type.Optional(Type.String({ description: "Vault-relative path of the quiz/test/exercise note (its score/passed properties are updated)" })),
	questions: Type.Array(ResultSchema, { minItems: 1 }),
});

function setFrontmatter(path: string, values: Record<string, string>): void {
	if (!existsSync(path)) return;
	let text = readFileSync(path, "utf8");
	const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return;
	let body = fm[1];
	for (const [k, v] of Object.entries(values)) {
		const re = new RegExp(`^${k}:.*$`, "m");
		body = re.test(body) ? body.replace(re, `${k}: ${v}`) : `${body}\n${k}: ${v}`;
	}
	text = text.replace(fm[0], `---\n${body}\n---`);
	writeFileSync(path, text, "utf8");
}

function resolveKey(state: LcState, subject?: string, topic?: string): string | undefined {
	if (topic) {
		const t = resolveTopicRef(state, topic, subject ?? state.active?.subject) ?? findTopic(state, topic);
		return t ? topicKey(t.subject, t.topic) : undefined;
	}
	return state.active?.topicKey;
}

export const quizTools = [
	defineTool({
		name: "quiz_ask",
		label: "Quiz",
		description:
			"Ask the learner one or more questions interactively (multiple choice, numeric, short, open, proof). Guided mode lets the learner reveal progressive hints. Optionally asks 'why?' after each answer. Returns the raw answers; grade them yourself (verify with math_check) and then call quiz_record.",
		parameters: AskParams,
		sequential: true,
		async execute(p, env) {
			const mode = p.mode ?? "independent";
			if (!env.ui) {
				return textResult("No interactive UI available: ask the questions in the chat instead.", {
					title: p.title,
					mode,
					answers: [],
					cancelled: true,
				} as AskDetails);
			}
			const details = await runQuiz(env.ui, p);
			return textResult(formatQuizResult(p.questions, details), details);
		},
	}),

	defineTool({
		name: "quiz_record",
		label: "Record attempt",
		description:
			"Record a graded assessment/quiz/test/exercise set/retest: one entry per question with concept, correctness, reasoning quality and error. Computes the score (guided questions excluded), pass/fail against the threshold, opens a gap for every wrong or poorly reasoned answer (even when passed), resolves gaps proven by a correct non-guided retest, and schedules spaced-repetition reviews.",
		parameters: RecordParams,
		sequential: true,
		async execute(p, env) {
			const ws = requireWorkspace();
			const vault = notesRoot(ws);
			const notePath = p.note ? resolveInVault(ws, p.note) : undefined;
			const out = await mutateState((state) => {
				const date = today();
				const subjectLevel = p.kind === "exam" || (p.kind === "assessment" && !!p.subject && !p.topic);
				const subjName = p.subject ? safeName(p.subject) : state.active?.subject;
				const subj = subjName ? state.subjects[subjName] : undefined;
				if (subjectLevel && !subj) throw new Error(`Subject "${p.subject ?? "(none active)"}" not found.`);
				const key = subjectLevel ? undefined : resolveKey(state, p.subject, p.topic);
				const warnings: string[] = [];
				const questions = p.questions.map(({ topic, ...q }) => {
					if (!topic) return q;
					const t = resolveTopicRef(state, topic, subj?.name);
					if (!t) warnings.push(`Unknown topic "${topic}" for concept "${q.concept}".`);
					return t ? { ...q, topicKey: topicKey(t.subject, t.topic) } : q;
				});
				const outcome = recordAttempt(state, {
					kind: p.kind,
					topicKey: key,
					subject: subjectLevel ? subj?.name : undefined,
					scopeTopicKeys: subjectLevel && subj ? subjectTopicKeys(subj) : undefined,
					lesson: p.lesson,
					scope: p.scope,
					note: notePath ? toPosix(relative(vault, notePath)) : undefined,
					questions,
					threshold: ws.config.passThreshold,
				});
				let examNote = "";
				if (p.kind === "exam" && subj) {
					if (outcome.mastered) {
						subj.examPassed = date;
						examNote = ` Final exam of "${subj.name}" PASSED with no open gaps.`;
					} else examNote = ` Final exam of "${subj.name}" not complete yet: ${outcome.attempt.passed ? "close the gaps with reinforcement + retest, then the exam counts as passed" : "reinforce, then retake with new questions"}.`;
					updateSubjectStatus(state, subj.name, date);
				}
				// A retest closing the last gaps of a passed exam completes it too.
				if (p.kind === "retest" && subj?.finalExam && !subj.examPassed) {
					const lastExam = [...state.attempts].reverse().find((a) => a.kind === "exam" && a.subject === subj.name);
					const keys = subjectTopicKeys(subj);
					const open = state.gaps.some((g) => g.status === "open" && g.topicKey && keys.includes(g.topicKey));
					if (lastExam?.passed && !open) {
						subj.examPassed = date;
						updateSubjectStatus(state, subj.name, date);
						examNote = ` Last gaps closed: final exam of "${subj.name}" now PASSED.`;
					}
				}
				// Suggest reinforcement note paths for new gaps (in the lesson that teaches the concept).
				for (const g of outcome.opened) {
					const t = g.topicKey ? state.topics[g.topicKey] : undefined;
					const lessonN = g.lesson ?? t?.lessons.find((l) => l.concepts.some((c) => c.toLowerCase() === g.concept.toLowerCase()))?.n;
					const lesson = t?.lessons.find((l) => l.n === lessonN);
					if (t && lesson) {
						g.lesson = lesson.n;
						g.reinforcement = toPosix(relative(vault, reinforcementPath(lessonPaths(vault, t.subject, topicFolder(t), lesson.n, lesson.title), g.concept)));
					}
				}
				return { outcome, key: key ?? (subjectLevel ? subj?.name : undefined), examNote, warnings };
			});
			if (notePath) setFrontmatter(notePath, { score: String(out.outcome.attempt.score), passed: String(out.outcome.attempt.passed), updated: today() });

			const a = out.outcome.attempt;
			const pct = Math.round(a.score * 100);
			const threshold = Math.round(ws.config.passThreshold * 100);
			const lines = [
				`${a.kind} "${a.scope}"${out.key ? ` [${out.key}]` : ""}: score ${pct}% (threshold ${threshold}%) → ${a.passed ? "PASSED" : "NOT PASSED"}${out.outcome.mastered ? ", mastered (no open gaps)" : ""}.`,
			];
			if (out.outcome.opened.length) {
				lines.push(`New gaps (${out.outcome.opened.length}) — write a reinforcement note for each (skill reinforcement), then retest:`);
				for (const g of out.outcome.opened) lines.push(`- ${g.concept}${g.error ? `: ${g.error}` : ""}${g.reinforcement ? ` → ${g.reinforcement}` : ""} (gap id ${g.id})`);
			}
			if (out.outcome.resolved.length) lines.push(`Gaps closed: ${out.outcome.resolved.map((g) => g.concept).join(", ")}.`);
			if (out.outcome.stillOpen.length && a.kind !== "assessment") lines.push(`Still open: ${out.outcome.stillOpen.map((g) => g.concept).join(", ")}.`);
			if (out.outcome.scheduled.length) lines.push(`Reviews scheduled for: ${out.outcome.scheduled.join(", ")}.`);
			if (out.examNote) lines.push(out.examNote.trim());
			lines.push(...out.warnings);
			return textResult(lines.join("\n"), { attemptId: a.id, score: a.score, passed: a.passed, mastered: out.outcome.mastered });
		},
	}),
];
