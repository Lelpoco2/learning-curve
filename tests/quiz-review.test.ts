import assert from "node:assert/strict";
import { test } from "node:test";
import { setMathRenderer } from "../extensions/lib/mathtext.ts";
import { renderMathText } from "../extensions/math-display.ts";
import { formatQuizResult, mergeRevision, runQuiz } from "../extensions/tools/quiz.ts";

// As in pi: dialogs show math rendered as Unicode.
setMathRenderer((t) => renderMathText(t));

type Step = { method: "select" | "editor" | "confirm"; check?: (title: string, extra: unknown) => void; reply: string | boolean | undefined | ((title: string, extra: unknown) => string | boolean | undefined) };

/** A fake UI that plays a scripted learner and records every dialog. */
function scriptedCtx(steps: Step[]) {
	const seen: { method: string; title: string; extra: unknown }[] = [];
	const next = (method: string, title: string, extra: unknown) => {
		seen.push({ method, title, extra });
		const step = steps.shift();
		assert.ok(step, `unexpected ${method}: ${title.split("\n")[0]}`);
		assert.equal(step.method, method, `expected ${step.method}, got ${method}: ${title.split("\n")[0]}`);
		step.check?.(title, extra);
		return typeof step.reply === "function" ? step.reply(title, extra) : step.reply;
	};
	const ctx = {
		hasUI: true,
		mode: "tui",
		ui: {
			select: async (title: string, options: string[]) => next("select", title, options) as string | undefined,
			editor: async (title: string, prefill?: string) => next("editor", title, prefill) as string | undefined,
			confirm: async (title: string, message: string) => next("confirm", title, message) as boolean,
		},
	};
	return { ctx: ctx.ui as never, seen, remaining: steps };
}

const questions = [
	{ id: "q1", type: "mcq" as const, prompt: "Quanto vale $\\int_0^1 x^2\\,dx$?", options: ["$\\frac{1}{2}$", "$\\frac{1}{3}$"], askWhy: false },
	{ id: "q2", type: "numeric" as const, prompt: "Derivata di $x^3$ in $x=2$?", askWhy: true },
];
const pick = (label: string) => (_t: string, options: unknown) => (options as string[]).find((o) => o.startsWith(label));

test("answers can be reviewed and changed before submitting; the tutor sees the first answer", async () => {
	const { ctx, seen, remaining } = scriptedCtx([
		// First pass.
		{ method: "select", reply: pick("A)") },
		{ method: "editor", reply: "10" },
		{ method: "editor", reply: "3x^2 calcolato in 2" },
		// Review list: both questions, rendered math, then change q1.
		{
			method: "select",
			check: (title, options) => {
				assert.match(title, /Review your answers/);
				const o = options as string[];
				assert.equal(o.length, 3);
				assert.match(o[0], /^1\. Quanto vale ∫₀\^1 x\^2 dx\? → A\) 1\/2$/); // caret exponents (default)
				assert.match(o[1], /^2\. .* → 10$/);
				assert.equal(o[2], "✓ Submit answers");
			},
			reply: (_t, o) => (o as string[])[0],
		},
		// Re-asking q1 shows the current answer.
		{ method: "select", check: (title) => assert.match(title, /changing .*Current answer: A\) 1\/2/s), reply: pick("B)") },
		// Change q2: editors are pre-filled with the previous answer and why.
		{ method: "select", check: (_t, o) => assert.match((o as string[])[0], /→ B\) 1\/3  ✎$/), reply: (_t, o) => (o as string[])[1] },
		{ method: "editor", check: (_t, prefill) => assert.equal(prefill, "10"), reply: "12" },
		{ method: "editor", check: (_t, prefill) => assert.equal(prefill, "3x^2 calcolato in 2"), reply: "3x^2 calcolato in 2" },
		{ method: "select", reply: "✓ Submit answers" },
	]);
	const d = await runQuiz(ctx, { title: "Prova", questions });
	assert.equal(remaining.length, 0);
	assert.equal(d.cancelled, false);
	assert.deepEqual(
		d.answers.map((a) => [a.answer, a.changed, a.firstAnswer]),
		[
			["B) $\\frac{1}{3}$", true, "A) $\\frac{1}{2}$"],
			["12", true, "10"],
		],
	);
	const text = formatQuizResult(questions, d);
	assert.match(text, /q1 \[mcq\]: answer: B\) \$\\frac\{1\}\{3\}\$[\s\S]*changed during review — first answer: A\) \$\\frac\{1\}\{2\}\$/);
	assert.match(text, /q2 \[numeric\]: answer: 12[\s\S]*first answer: 10/);
	assert.doesNotMatch(text, /first why/, "the justification did not change");
	assert.match(text, /2 answer\(s\) changed during the review/);
	assert.ok(seen.length > 0);
});

test("Esc while changing keeps the answer; Esc on the review asks to confirm submission", async () => {
	const { ctx, remaining } = scriptedCtx([
		{ method: "select", reply: pick("B)") },
		{ method: "editor", reply: "12" },
		{ method: "editor", reply: "perché sì" },
		{ method: "select", reply: (_t, o) => (o as string[])[1] },
		{ method: "editor", reply: undefined }, // Esc: keep "12"
		{ method: "select", reply: undefined }, // Esc on the review
		{ method: "confirm", reply: false }, // back to the review
		{ method: "select", reply: undefined },
		{ method: "confirm", reply: true }, // submit
	]);
	const d = await runQuiz(ctx, { questions });
	assert.equal(remaining.length, 0);
	assert.deepEqual(d.answers.map((a) => [a.answer, a.changed]), [
		["B) $\\frac{1}{3}$", undefined],
		["12", undefined],
	]);
	assert.doesNotMatch(formatQuizResult(questions, d), /changed/);
});

test("a single question is submitted directly (no review step)", async () => {
	const { ctx, remaining } = scriptedCtx([{ method: "select", reply: pick("B)") }]);
	const d = await runQuiz(ctx, { questions: [questions[0]] });
	assert.equal(remaining.length, 0);
	assert.equal(d.answers[0].answer, "B) $\\frac{1}{3}$");
});

test("mergeRevision: changing back to the first answer is not a change; skips are tracked", () => {
	const first = { id: "q", answer: "A", why: "w", hintsUsed: 1, skipped: false, seconds: 5 };
	const changed = mergeRevision(first, { id: "q", answer: "B", why: "w", hintsUsed: 0, skipped: false, seconds: 3 });
	assert.deepEqual([changed.changed, changed.firstAnswer, changed.seconds, changed.hintsUsed], [true, "A", 8, 1]);
	const back = mergeRevision(changed, { id: "q", answer: "A", why: "w", hintsUsed: 1, skipped: false, seconds: 2 });
	assert.equal(back.changed, undefined);
	const skipped = mergeRevision(first, { id: "q", hintsUsed: 1, skipped: true, seconds: 1 });
	assert.deepEqual([skipped.changed, skipped.firstAnswer], [true, "A"]);
});
