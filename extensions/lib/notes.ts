/** Vault scaffolding and generated sections. Uses node:fs only. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { learnerPaths, subjectPaths, toPosix, topicFolder, topicPaths } from "./paths.ts";
import {
	renderDashboard,
	renderExamStatus,
	renderKnowledgeMap,
	renderLessonsTable,
	renderStyleObservations,
	renderSubjectMap,
	renderSyllabusTable,
	renderTopicSubjects,
	wikilink,
} from "./render.ts";
import { topicSubjects } from "./subjects.ts";
import { type LcState, type Subject, type Topic, today } from "./types.ts";
import { notesRoot, replaceMarkedSection, type Workspace, writeIfMissing } from "./workspace.ts";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TEMPLATES_DIR = join(PACKAGE_ROOT, "templates");
export const SKILLS_DIR = join(PACKAGE_ROOT, "skills");
export const PROMPTS_DIR = join(PACKAGE_ROOT, "prompts");

export function readTemplate(name: string): string {
	return readFileSync(join(TEMPLATES_DIR, name), "utf8");
}

export function fillTemplate(text: string, vars: Record<string, string | number | undefined>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		const v = vars[key];
		return v === undefined ? match : String(v);
	});
}

export function tagSlug(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFC")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

export function yamlString(value: string): string {
	return value.replace(/"/g, "'").replace(/\r?\n/g, " ");
}

export function topicVars(vault: string, t: { subject: string; topic: string; order?: number }, subjects: string[] = [t.subject]): Record<string, string> {
	const { subject, topic } = t;
	const tp = topicPaths(vault, subject, topicFolder(t));
	return {
		subject,
		topic,
		subjectsList: subjects.map((s) => `"${yamlString(s)}"`).join(", "),
		subjectTags: subjects.map((s) => `subject/${tagSlug(s)}`).join(", "),
		subjectTag: `subject/${tagSlug(subject)}`,
		topicTag: `topic/${tagSlug(topic)}`,
		flashcardTag: `${tagSlug(subject)}/${tagSlug(topic)}`,
		subjectFolder: toPosix(relative(vault, tp.subjectDir)),
		topicFolder: toPosix(relative(vault, tp.topicDir)),
		studyPlanLink: toPosix(relative(vault, tp.studyPlan)).replace(/\.md$/, ""),
		flashcardsLink: toPosix(relative(vault, tp.flashcards)).replace(/\.md$/, ""),
		topicLink: toPosix(relative(vault, tp.topicIndex)).replace(/\.md$/, ""),
		subjectLink: toPosix(relative(vault, tp.subjectIndex)).replace(/\.md$/, ""),
		date: today(),
	};
}

/** Create learner notes, dashboard and LaTeX preamble when missing. Returns created files. */
export function scaffoldLearner(ws: Workspace): string[] {
	const vault = notesRoot(ws);
	const lp = learnerPaths(vault, ws.config.learnerFolder);
	const vars = { date: today() };
	const created: string[] = [];
	const write = (path: string, template: string) => {
		if (writeIfMissing(path, fillTemplate(readTemplate(template), vars))) created.push(path);
	};
	write(lp.profile, "profile.md");
	write(lp.style, "learning-style.md");
	write(lp.dashboard, "dashboard.md");
	write(join(vault, ws.config.sourcesFolder ?? "Sources", "README.md"), "sources-readme.md");
	if (ws.config.app.id === "obsidian") write(join(vault, "preamble.sty"), "preamble.sty");
	return created;
}

function subjectIndexContent(vault: string, name: string, goal?: string, status = "in-progress"): string {
	const sp = subjectPaths(vault, name);
	return fillTemplate(readTemplate("subject-index.md"), {
		subject: name,
		subjectTag: `subject/${tagSlug(name)}`,
		subjectFolder: toPosix(relative(vault, sp.dir)),
		goal: yamlString(goal ?? ""),
		status,
		date: today(),
	});
}

/** Create the subject index note when missing. */
export function scaffoldSubject(ws: Workspace, s: Subject | undefined): string[] {
	if (!s) return [];
	const vault = notesRoot(ws);
	const sp = subjectPaths(vault, s.name);
	return writeIfMissing(sp.index, subjectIndexContent(vault, s.name, s.goal, s.status)) ? [sp.index] : [];
}

/** Create the topic index note (and its home subject index) when missing. */
export function scaffoldTopic(ws: Workspace, t: Topic): string[] {
	const vault = notesRoot(ws);
	const tp = topicPaths(vault, t.subject, topicFolder(t));
	const base = topicVars(vault, t, topicSubjects(t));
	const vars = { ...base, status: t.status, flashcardsLine: ws.config.flashcards ? `\n- [[${base.flashcardsLink}|Flashcards]]` : "" };
	const created: string[] = [];
	if (writeIfMissing(tp.subjectIndex, subjectIndexContent(vault, t.subject))) created.push(tp.subjectIndex);
	if (writeIfMissing(tp.topicIndex, fillTemplate(readTemplate("topic-index.md"), vars))) created.push(tp.topicIndex);
	if (ws.config.flashcards && writeIfMissing(tp.flashcards, fillTemplate(readTemplate("flashcards.md"), vars))) created.push(tp.flashcards);
	return created;
}

function updateFile(path: string, fn: (content: string) => string): boolean {
	if (!existsSync(path)) return false;
	const before = readFileSync(path, "utf8");
	const after = fn(before);
	if (after !== before) writeFileSync(path, after, "utf8");
	return true;
}

/** Set (or add) a top-level property in the YAML frontmatter. */
export function setFrontmatterLine(content: string, key: string, value: string): string {
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return content;
	const re = new RegExp(`^${key}:.*$`, "m");
	const body = re.test(fm[1]) ? fm[1].replace(re, `${key}: ${value}`) : `${fm[1]}\n${key}: ${value}`;
	return content.replace(fm[0], `---\n${body}\n---`);
}

function touchUpdated(content: string, date: string): string {
	return content.replace(/^(---\r?\n[\s\S]*?^updated:)\s*.*$/m, `$1 ${date}`);
}

/** Refresh every generated section (dashboard, knowledge map, observations, lesson tables). */
export function refreshGenerated(ws: Workspace, state: LcState): void {
	const vault = notesRoot(ws);
	const lp = learnerPaths(vault, ws.config.learnerFolder);
	const date = today();
	updateFile(lp.dashboard, (c) => replaceMarkedSection(c, "progress", renderDashboard(vault, state, date)));
	updateFile(lp.profile, (c) => touchUpdated(replaceMarkedSection(c, "knowledge", renderKnowledgeMap(state)), date));
	updateFile(lp.style, (c) => replaceMarkedSection(c, "observations", renderStyleObservations(state)));
	for (const s of Object.values(state.subjects)) {
		const sp = subjectPaths(vault, s.name);
		updateFile(sp.index, (c) => {
			let out = replaceMarkedSection(c, "syllabus", renderSyllabusTable(vault, state, s));
			out = replaceMarkedSection(out, "map", renderSubjectMap(state, s));
			out = replaceMarkedSection(out, "exam", renderExamStatus(state, s));
			out = setFrontmatterLine(out, "status", `"${s.status}"`);
			if (s.goal) out = setFrontmatterLine(out, "goal", `"${yamlString(s.goal)}"`);
			return out;
		});
	}
	for (const t of Object.values(state.topics)) {
		const tp = topicPaths(vault, t.subject, topicFolder(t));
		const table = renderLessonsTable(vault, t);
		const subjects = topicSubjects(t);
		updateFile(tp.topicIndex, (c) => {
			let out = replaceMarkedSection(c, "lessons", table);
			out = replaceMarkedSection(out, "subjects", renderTopicSubjects(vault, subjects));
			out = setFrontmatterLine(out, "status", `"${t.status}"`);
			out = setFrontmatterLine(out, "tags", `[learning/topic, ${subjects.map((x) => `subject/${tagSlug(x)}`).join(", ")}, topic/${tagSlug(t.topic)}]`);
			return setFrontmatterLine(out, "subjects", `[${subjects.map((x) => `"${yamlString(x)}"`).join(", ")}]`);
		});
		updateFile(tp.studyPlan, (c) => replaceMarkedSection(c, "lessons", table));
	}
}

/** Read the "## Summary" section of the Learning Style note (what the tutor must keep in mind). */
export function readStyleSummary(ws: Workspace, maxChars = 1500): string | undefined {
	const lp = learnerPaths(notesRoot(ws), ws.config.learnerFolder);
	if (!existsSync(lp.style)) return undefined;
	// The first H2 section is the summary (its heading may be translated into the notes language).
	const text = readFileSync(lp.style, "utf8");
	const parts = text.split(/^##\s+[^\n]*$/m);
	if (parts.length < 2) return undefined;
	const body = parts[1].replace(/<!--[\s\S]*?-->/g, "").trim();
	if (!body || body.includes("(filled after the learning-style interview)")) return undefined;
	return body.slice(0, maxChars);
}

export { wikilink };
