/** Canonical note paths inside the vault. Pure: no pi imports. */

import { join } from "node:path";

/** Characters that break file names on Windows or links in Obsidian. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;

/** Make a string safe as a file/folder name while keeping it readable. */
export function safeName(value: string): string {
	const cleaned = value
		.replace(FORBIDDEN, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[. ]+$/, "");
	return cleaned.length > 0 ? cleaned.slice(0, 120) : "Untitled";
}

export function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

export interface LearnerPaths {
	dir: string;
	profile: string;
	style: string;
	dashboard: string;
}

export interface TopicPaths {
	subjectDir: string;
	subjectIndex: string;
	topicDir: string;
	topicIndex: string;
	studyPlan: string;
	/** Spaced Repetition flashcards of the whole topic (one section per lesson). */
	flashcards: string;
	lessonsDir: string;
	quizzesDir: string;
	testsDir: string;
	exercisesDir: string;
}

export interface LessonPaths {
	dir: string;
	note: string;
	media: string;
	/** Runnable code of the lesson (cs/programming kinds). */
	code: string;
	name: string;
}

export interface SubjectPaths {
	dir: string;
	index: string;
	examsDir: string;
}

export function subjectPaths(notesRoot: string, subject: string): SubjectPaths {
	const s = safeName(subject);
	const dir = join(notesRoot, s);
	return { dir, index: join(dir, `${s}.md`), examsDir: join(dir, "Exams") };
}

export function examNotePath(sp: SubjectPaths, scope: string, attempt: number): string {
	return join(sp.examsDir, `Exam - ${safeName(scope)} - ${attempt}.md`);
}

export function learnerPaths(notesRoot: string, learnerFolder: string): LearnerPaths {
	const dir = join(notesRoot, learnerFolder);
	return {
		dir,
		profile: join(dir, "Profile.md"),
		style: join(dir, "Learning Style.md"),
		dashboard: join(dir, "Dashboard.md"),
	};
}

/** Folder (and index note) name of a topic: "NN - Topic" when it has a syllabus order. */
export function topicFolder(t: { topic: string; order?: number }): string {
	return t.order ? `${pad2(t.order)} - ${safeName(t.topic)}` : safeName(t.topic);
}

/** `topic` is the topic's folder name (see topicFolder). */
export function topicPaths(notesRoot: string, subject: string, topic: string): TopicPaths {
	const s = safeName(subject);
	const t = safeName(topic);
	const subjectDir = join(notesRoot, s);
	const topicDir = join(subjectDir, t);
	return {
		subjectDir,
		subjectIndex: join(subjectDir, `${s}.md`),
		topicDir,
		topicIndex: join(topicDir, `${t}.md`),
		studyPlan: join(topicDir, "Study Plan.md"),
		flashcards: join(topicDir, "Flashcards.md"),
		lessonsDir: join(topicDir, "Lessons"),
		quizzesDir: join(topicDir, "Quizzes"),
		testsDir: join(topicDir, "Tests"),
		exercisesDir: join(topicDir, "Exercises"),
	};
}

export function lessonName(n: number, title: string): string {
	return `${pad2(n)} - ${safeName(title)}`;
}

/** `topic` is the topic's folder name (see topicFolder). */
export function lessonPaths(notesRoot: string, subject: string, topic: string, n: number, title: string): LessonPaths {
	const tp = topicPaths(notesRoot, subject, topic);
	const name = lessonName(n, title);
	const dir = join(tp.lessonsDir, name);
	return { dir, note: join(dir, `${name}.md`), media: join(dir, "media"), code: join(dir, "code"), name };
}

export function reinforcementPath(lesson: LessonPaths, concept: string): string {
	return join(lesson.dir, `Reinforcement - ${safeName(concept)}.md`);
}

export type AttemptFolder = "quiz" | "test" | "exercises";

/** Path of a quiz/test/exercise note; `attempt` distinguishes retakes. */
export function attemptNotePath(tp: TopicPaths, kind: AttemptFolder, scope: string, attempt: number): string {
	const dir = kind === "quiz" ? tp.quizzesDir : kind === "test" ? tp.testsDir : tp.exercisesDir;
	const label = kind === "quiz" ? "Quiz" : kind === "test" ? "Test" : "Exercises";
	return join(dir, `${label} - ${safeName(scope)} - ${attempt}.md`);
}

/** Convert to forward slashes (for display and Obsidian links). */
export function toPosix(p: string): string {
	return p.replace(/\\/g, "/");
}
