/** pi adapter: registers the platform-neutral tool definitions with pi (plus pi-only renderers). */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { ToolDef, ToolEnv } from "./lib/tool.ts";
import { codeTools } from "./tools/code.ts";
import { computeTools } from "./tools/compute.ts";
import { learnerTools } from "./tools/learner.ts";
import { noteCheckTools } from "./tools/notecheck.ts";
import { type AskDetails, quizTools } from "./tools/quiz.ts";
import { sourceTools } from "./tools/sources.ts";
import { stateTools } from "./tools/state.ts";

type Theme = { fg(color: string, text: string): string; bold(text: string): string };
type Renderers = {
	renderCall?: (args: Record<string, unknown>, theme: Theme) => Text;
	renderResult?: (result: { details?: unknown }, opts: unknown, theme: Theme) => Text;
};

const RENDERERS: Record<string, Renderers> = {
	quiz_ask: {
		renderCall(args, theme) {
			const n = Array.isArray(args.questions) ? args.questions.length : 0;
			return new Text(`${theme.fg("toolTitle", theme.bold("quiz "))}${theme.fg("muted", `${(args.title as string) ?? ""} ${n} question${n === 1 ? "" : "s"}${args.mode === "guided" ? " · guided" : ""}`)}`, 0, 0);
		},
		renderResult(result, _opts, theme) {
			const d = result.details as AskDetails | undefined;
			if (!d?.answers) return new Text("", 0, 0);
			const answered = d.answers.filter((a) => !a.skipped).length;
			const changed = d.answers.filter((a) => a.changed).length;
			const text = `${theme.fg("success", "✓ ")}${answered}/${d.answers.length} answered${changed ? theme.fg("muted", ` · ${changed} changed in review`) : ""}${d.cancelled ? theme.fg("warning", " · stopped") : ""}`;
			return new Text(text, 0, 0);
		},
	},
};

function envFrom(ctx: ExtensionContext | undefined, signal: AbortSignal | undefined, onUpdate: ((u: unknown) => void) | undefined): ToolEnv {
	return {
		signal,
		ui: ctx?.hasUI
			? {
					select: (title, options) => ctx.ui.select(title, options),
					editor: (title, prefill) => ctx.ui.editor(title, prefill),
					confirm: (title, message) => ctx.ui.confirm(title, message),
				}
			: undefined,
		progress: onUpdate ? (text) => onUpdate({ content: [{ type: "text", text }], details: {} }) : undefined,
		cwd: ctx?.cwd ?? process.cwd(),
		platform: "pi",
	};
}

export function registerPiTools(pi: ExtensionAPI, defs: ToolDef[]): void {
	for (const d of defs) {
		pi.registerTool({
			name: d.name,
			label: d.label,
			description: d.description,
			// Plain JSON Schema: pi validates any JSON Schema.
			parameters: d.parameters as never,
			// Activated at session start inside a learning workspace only.
			defaultActive: false,
			...(d.sequential ? { executionMode: "sequential" as const } : {}),
			async execute(_id: string, params: unknown, signal?: AbortSignal, onUpdate?: (u: unknown) => void, ctx?: ExtensionContext) {
				return (await d.execute(params as never, envFrom(ctx, signal, onUpdate))) as never;
			},
			...(RENDERERS[d.name] as object),
		} as never);
	}
}

export const ALL_TOOLS: ToolDef[] = [...stateTools, ...quizTools, ...learnerTools, ...computeTools, ...codeTools, ...sourceTools, ...noteCheckTools] as ToolDef[];

export const registerStateTool = (pi: ExtensionAPI) => registerPiTools(pi, stateTools as ToolDef[]);
export const registerQuizTools = (pi: ExtensionAPI) => registerPiTools(pi, quizTools as ToolDef[]);
export const registerLearnerTools = (pi: ExtensionAPI) => registerPiTools(pi, learnerTools as ToolDef[]);
export const registerComputeTools = (pi: ExtensionAPI) => registerPiTools(pi, computeTools as ToolDef[]);
export const registerCodeTool = (pi: ExtensionAPI) => registerPiTools(pi, codeTools as ToolDef[]);
export const registerSourceTool = (pi: ExtensionAPI) => registerPiTools(pi, sourceTools as ToolDef[]);
export const registerNoteCheckTool = (pi: ExtensionAPI) => registerPiTools(pi, noteCheckTools as ToolDef[]);
