/**
 * Learning commands.
 *
 * /learn, /lesson, /quiz, … are rewritten by an `input` handler into `/skill:<name> …`,
 * so pi expands the skill synchronously, exactly like a typed skill command (robust in
 * interactive, RPC and print modes). Prompt templates with the same names are contributed
 * only inside a workspace: they give autocomplete and descriptions. /progress is a local
 * command (no model call).
 */

import { relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { nextLesson } from "./lib/curriculum.ts";
import { refreshGenerated } from "./lib/notes.ts";
import { learnerPaths, toPosix } from "./lib/paths.ts";
import { dueItems } from "./lib/srs.ts";
import { examDue, nextSubjectTopic, subjectProgress } from "./lib/subjects.ts";
import { today } from "./lib/types.ts";
import { loadState, notesRoot } from "./lib/workspace.ts";
import { getWorkspace, setWorkspaceFromCwd } from "./runtime.ts";

export interface Route {
	name: string;
	skill: string;
	/** Text placed before the user's arguments. */
	prefix?: string;
}

export const ROUTES: Route[] = [
	{ name: "new-subject", skill: "subject-plan", prefix: "New subject:" },
	{ name: "learn", skill: "learn-topic", prefix: "Topic:" },
	{ name: "lesson", skill: "lesson-writing", prefix: "Lesson:" },
	{ name: "quiz", skill: "quiz-and-exercises", prefix: "Quiz on:" },
	{ name: "exercises", skill: "quiz-and-exercises", prefix: "Exercise set on:" },
	{ name: "test", skill: "quiz-and-exercises", prefix: "Test on:" },
	{ name: "exam", skill: "quiz-and-exercises", prefix: "Final exam of subject:" },
	{ name: "grade", skill: "quiz-and-exercises", prefix: "Grade the answers written in note:" },
	{ name: "reformulate", skill: "reformulation", prefix: "Reformulate:" },
	{ name: "remember", skill: "memory-aids", prefix: "Give me tips to remember:" },
	{ name: "review", skill: "spaced-review" },
	{ name: "style", skill: "learning-style-interview" },
];

/** Rewrite `/name args` into `/skill:<skill> <prefix> args`; undefined when not a route. */
export function routeInput(text: string): string | undefined {
	const m = text.match(/^\/([a-z-]+)(?:\s+([\s\S]*))?$/);
	if (!m) return undefined;
	const route = ROUTES.find((r) => r.name === m[1]);
	if (!route) return undefined;
	const args = (m[2] ?? "").trim();
	const bare: Record<string, string> = {
		lesson: "next",
		exam: "Final exam of the active subject",
		remember: "Give me tips to remember the key results of the current lesson",
	};
	const request = args ? [route.prefix, args].filter(Boolean).join(" ") : (bare[route.name] ?? "");
	return `/skill:${route.skill}${request ? ` ${request}` : ""}`;
}

export function registerCommands(pi: ExtensionAPI): void {
	pi.on("input", (event, ctx) => {
		const routed = routeInput(event.text.trim());
		if (!routed) return { action: "continue" };
		const ws = getWorkspace() ?? setWorkspaceFromCwd(ctx.cwd);
		if (!ws) {
			if (ctx.hasUI) ctx.ui.notify("Not inside a learning workspace. Run /learn-setup, then start pi inside your vault.", "warning");
			return { action: "handled" };
		}
		return { action: "transform", text: routed };
	});

	pi.registerEntryRenderer("lc-progress", (entry, _opts, theme) => {
		const data = entry.data as { lines: string[] };
		return new Text(`${theme.fg("accent", theme.bold("Progress"))}\n${data.lines.join("\n")}`, 1, 0);
	});

	pi.registerCommand("progress", {
		description: "Learning Curve: progress, open gaps and due reviews; refreshes the Dashboard note",
		handler: async (_args, ctx) => {
			const ws = getWorkspace() ?? setWorkspaceFromCwd(ctx.cwd);
			if (!ws) {
				ctx.ui.notify("Not inside a learning workspace. Run /learn-setup first.", "warning");
				return;
			}
			const state = loadState(ws);
			refreshGenerated(ws, state);
			const lines: string[] = [];
			const topics = Object.values(state.topics);
			for (const s of Object.values(state.subjects)) {
				const { done, total } = subjectProgress(state, s);
				const next = nextSubjectTopic(state, s);
				lines.push(
					`Subject ${s.name}: ${done}/${total} topics · ${s.status}${next ? ` · next: ${next.topic}` : ""}${examDue(state, s) ? " · final exam due (/exam)" : s.examPassed ? ` · exam passed ${s.examPassed}` : ""}`,
				);
			}
			if (topics.length === 0) lines.push("No topics yet — start with /new-subject <name> or /learn <topic>.");
			for (const t of topics.filter((x) => x.status !== "planned")) {
				const done = t.lessons.filter((l) => l.status === "done").length;
				const next = nextLesson(t);
				lines.push(`${t.subject} / ${t.topic}: ${done}/${t.lessons.length} lessons · ${t.status}${next ? ` · next: ${next.n}. ${next.title}` : ""}`);
			}
			const gaps = state.gaps.filter((g) => g.status === "open");
			lines.push(`Open gaps: ${gaps.length}${gaps.length ? ` (${gaps.slice(0, 5).map((g) => g.concept).join(", ")})` : ""}`);
			lines.push(`Reviews due today: ${dueItems(state.reviews, today()).length}`);
			const lp = learnerPaths(notesRoot(ws), ws.config.learnerFolder);
			lines.push(`Dashboard: ${toPosix(relative(notesRoot(ws), lp.dashboard))}`);
			pi.appendEntry("lc-progress", { lines });
			if (!ctx.hasUI) console.log(lines.join("\n"));
		},
	});
}
