/** What changes for the tutor when it runs in Claude Code instead of pi. */

import { TUTOR_PREAMBLE } from "../extensions/lib/persona.ts";

export type Entrypoint = "cli" | "claude-vscode" | "claude-desktop" | string;

export function entrypoint(): Entrypoint {
	return process.env.CLAUDE_CODE_ENTRYPOINT ?? "cli";
}

/** How the client shows math in chat (checked in the clients' renderers). */
export function chatMathRule(ep: Entrypoint): string {
	if (ep === "claude-vscode") {
		return "This client (VS Code) renders LaTeX in chat with KaTeX: write chat math as standard LaTeX, $…$ inline and $$…$$ for display. KaTeX does not know the vault macros (\\vb, \\R, \\pdv…): expand them in chat (\\mathbf{v}, \\mathbb{R}, \\frac{\\partial f}{\\partial x}).";
	}
	if (ep === "claude-desktop") {
		return "This client (Claude desktop app) renders LaTeX in chat only between double dollars: write ALL chat math as $$…$$ (also inline), never single $…$. No vault macros in chat: expand them (\\mathbf{v}, \\mathbb{R}).";
	}
	return "This client is a terminal: LaTeX is NOT rendered in chat. Write chat math in readable Unicode (x², x³, xⁿ, √x, ∫₀¹ f(x) dx, a/b, ≤ ≥ ≠ ≈, →, ∞, π, θ, ∈ ℝ, Σ), with ^ for complicated exponents (e^(i·π)). Do the same in quiz_ask prompts and options.";
}

/** The persona for Claude Code: pi's, plus what differs here (it overrides pi-specific details). */
export function claudeTutorPrompt(ep: Entrypoint = entrypoint()): string {
	const notes = `<platform>
You run inside Claude Code (client: ${ep}), with the Learning Curve plugin. This overrides pi-specific details above:
- Tools: the Learning Curve tools come from its MCP server (learning_state, quiz_ask, quiz_record, learner_profile, review_queue, math_check, plot_render, manim_render, code_run, source_lookup, note_check, tutor_context, workspace_setup, obsidian_plugins; in the tool list their names carry an mcp__ prefix). For files use Read, Write, Edit, Glob, Grep and Bash.
- Notes in the vault are checked automatically after every Write/Edit (hook): fix the errors it reports right away.
- quiz_ask shows forms (MCP elicitation) at the bottom of the screen. A form shows only the first one or two lines of a question, so in Claude Code principle 13 is reversed for quizzes: in the same turn, write the questions in full in chat FIRST (numbered, with their options; short feedback on the previous answer may go before them), then call quiz_ask with the same questions. The text above the small form stays visible. If quiz_ask answers that no interactive UI is available, ask the questions in chat one at a time (AskUserQuestion for multiple choice), with hints on request.
- Math in chat: ${chatMathRule(ep)} Notes always use LaTeX ($…$, $$…$$) and the vault macros, as described above.
- Commands of the plugin: /learning-curve:learn, :lesson, :quiz, :exercises, :test, :exam, :grade, :reformulate, :remember, :review, :style, :new-subject, :progress, :check-notes, :learn-setup, :learn-plugins (also without the prefix when no other plugin uses the name).
- There is no /reload: after workspace_setup, call tutor_context to load the learning context.
</platform>`;
	return `${TUTOR_PREAMBLE.replace("running inside pi", "running inside Claude Code")}\n\n${notes}`;
}
