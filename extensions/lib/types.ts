/** Shared data types for the learning workspace. Pure: no pi imports. */

export const WORKSPACE_DIR = ".learning-curve";
export const CONFIG_FILE = "config.json";
export const STATE_FILE = "state.json";

export type NoteAppId = "obsidian" | "logseq" | "zettlr" | "joplin" | "markdown" | "other";

export interface PythonConfig {
	/** Absolute path of the Python interpreter used for math checks, plots and Manim. */
	python: string;
	/** Venv directory, when created by setup. */
	venv?: string;
	sympy: boolean;
	matplotlib: boolean;
	manim: boolean;
	/** LaTeX available for Manim MathTex. */
	latex: boolean;
	/** Extra directory prepended to PATH when rendering (e.g. MiKTeX bin). */
	latexBin?: string;
}

export interface LcConfig {
	version: 1;
	app: { id: NoteAppId; name: string };
	/** Notes root, relative to the workspace root ("." = workspace root is the vault). */
	notesRoot: string;
	/** Language the notes are written in (e.g. "Italiano", "English"). */
	notesLanguage: string;
	/** Minimum score (0..1) to pass a quiz/test. */
	passThreshold: number;
	/** Folder (relative to notesRoot) holding learner profile notes. */
	learnerFolder: string;
	/** Write Spaced Repetition plugin flashcards (one Flashcards note per topic). */
	flashcards: boolean;
	/** Exponents in the terminal: "caret" (default, full size: 2^3) or "superscript" (pi's small Unicode 2³). */
	mathExponents?: "caret" | "superscript";
	/** Number topic folders in syllabus order ("01 - Topic"). Undefined in vaults created before 0.9 until the learner decides. */
	numberTopicFolders?: boolean;
	/** Folder (relative to notesRoot) with the learner's textbooks/course notes used for fact checking. Default "Sources". */
	sourcesFolder?: string;
	python?: PythonConfig;
	plugins?: string[];
	createdAt: string;
	updatedAt: string;
}

export type LessonStatus = "planned" | "in-progress" | "done";
/** "planned": listed in a subject syllabus, not started yet. */
export type TopicStatus = "planned" | "assessing" | "planning" | "in-progress" | "done";
export type SubjectStatus = "assessing" | "planning" | "in-progress" | "done";

export interface Lesson {
	n: number;
	title: string;
	/** 1 (easiest) .. 5 (hardest). */
	difficulty: number;
	block: string;
	concepts: string[];
	prerequisites?: string[];
	status: LessonStatus;
}

export interface Assessment {
	level: string;
	date: string;
	summary: string;
	known: string[];
	weak: string[];
}

export interface Topic {
	/** Home subject: the folder where the topic's notes live. */
	subject: string;
	topic: string;
	/** Every subject whose syllabus includes this topic (home first). */
	subjects?: string[];
	/** Position among the topics homed in its subject (syllabus order): folder "NN - Topic". */
	order?: number;
	/** Lesson kind overriding the home subject's (e.g. a programming topic inside a math course). */
	lessonKind?: string;
	/** Programming language overriding the home subject's. */
	language?: string;
	status: TopicStatus;
	assessment?: Assessment;
	blocks: string[];
	lessons: Lesson[];
	createdAt: string;
	updatedAt: string;
}

export type AttemptKind = "assessment" | "quiz" | "test" | "exercises" | "retest" | "review" | "exam";
export type Correctness = "yes" | "partial" | "no";
export type Reasoning = "sound" | "partial" | "flawed" | "missing" | "n/a";

export interface QuestionResult {
	concept: string;
	correct: Correctness;
	reasoning?: Reasoning;
	/** Guided questions (with hints) teach; they are excluded from the score. */
	guided?: boolean;
	/** Short description of the error or misconception. */
	error?: string;
	/** Topic of this question when an attempt spans several topics (subject assessments, exams). */
	topicKey?: string;
}

export interface Attempt {
	id: string;
	kind: AttemptKind;
	topicKey?: string;
	/** Subject of subject-level attempts (assessment of a subject, final exam). */
	subject?: string;
	lesson?: number;
	scope: string;
	note?: string;
	date: string;
	score: number;
	passed: boolean;
	questions: QuestionResult[];
}

export interface Gap {
	id: string;
	concept: string;
	topicKey?: string;
	lesson?: number;
	error?: string;
	opened: string;
	openedBy: string;
	status: "open" | "resolved";
	resolved?: string;
	reinforcement?: string;
}

export interface ReviewItem {
	id: string;
	concept: string;
	topicKey?: string;
	note?: string;
	/** ISO date (YYYY-MM-DD) when the item is next due. */
	due: string;
	/** Current interval in days. */
	interval: number;
	ease: number;
	reps: number;
	lapses: number;
	lastReviewed?: string;
}

export interface KnowledgeEntry {
	concept: string;
	topicKey?: string;
	/** 0 unknown, 1 heard of, 2 can follow, 3 can apply, 4 can explain/teach. */
	level: number;
	correct: number;
	total: number;
	updated: string;
	note?: string;
}

export interface StyleObservation {
	date: string;
	signal: string;
	effect: "works" | "does-not-work" | "neutral";
	evidence?: string;
}

export interface SyllabusItem {
	/** Key of the topic (its home subject may differ from this subject). */
	topicKey: string;
	/** 1 (easiest) .. 5 (hardest) within the subject. */
	difficulty: number;
	estLessons?: number;
	/** Topic keys that must come first (may belong to other subjects). */
	prerequisites?: string[];
	/** Why it is here / what angle this subject needs (e.g. "bridge: vectors as forces"). */
	note?: string;
}

export interface Subject {
	name: string;
	goal?: string;
	status: SubjectStatus;
	assessment?: Assessment;
	/** Ordered topics: dependency first, then increasing difficulty. */
	syllabus: SyllabusItem[];
	/** End the subject with a final exam on all its topics. */
	finalExam: boolean;
	/** Date the final exam was passed with no open gaps. */
	examPassed?: string;
	/** Lesson kind (template) of the subject's lessons: math, physics, cs, programming, generic or a custom one. */
	lessonKind?: string;
	/** Programming language (and version) the learner chose, e.g. "Python 3.12", "C++20". */
	language?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ActiveRef {
	subject?: string;
	topicKey?: string;
	lesson?: number;
}

export interface LcState {
	version: 1;
	active?: ActiveRef;
	subjects: Record<string, Subject>;
	topics: Record<string, Topic>;
	attempts: Attempt[];
	gaps: Gap[];
	reviews: ReviewItem[];
	knowledge: Record<string, KnowledgeEntry>;
	style: StyleObservation[];
}

export function emptyState(): LcState {
	return { version: 1, subjects: {}, topics: {}, attempts: [], gaps: [], reviews: [], knowledge: {}, style: [] };
}

export function topicKey(subject: string, topic: string): string {
	return `${subject}/${topic}`;
}

export function today(date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function newId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
