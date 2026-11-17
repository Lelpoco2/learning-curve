/** math_check (SymPy verification), plot_render (matplotlib) and manim_render (Manim). */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { StringEnum } from "../lib/schema.ts";
import { Type } from "../lib/schema.ts";
import { runProcess } from "../lib/exec.ts";
import { toPosix } from "../lib/paths.ts";
import { envWithLatex } from "../lib/python.ts";
import { notesRoot, type Workspace } from "../lib/workspace.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { requireWorkspace, resolveInVault, textResult } from "../runtime.ts";

const OUTPUT_LIMIT = { maxBytes: 20 * 1024, maxLines: 400 };

function requirePython(ws: Workspace, feature: "sympy" | "matplotlib" | "manim"): string {
	const py = ws.config.python;
	if (!py?.python) throw new Error("Python is not configured for this workspace. Run /learn-setup and enable the Python tools.");
	if (!py[feature]) throw new Error(`${feature} is not installed in the workspace Python. Run /learn-setup (Python step) to install it.`);
	return py.python;
}

function scratchDir(ws: Workspace, name: string): string {
	const dir = join(ws.dataDir, name);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function clip(text: string): string {
	return clipTail(text, OUTPUT_LIMIT.maxLines, OUTPUT_LIMIT.maxBytes);
}

function embed(ws: Workspace, file: string): string {
	return `![[${toPosix(relative(notesRoot(ws), file))}]]`;
}

function findFile(dir: string, name: string): string | undefined {
	if (!existsSync(dir)) return undefined;
	let best: { path: string; mtime: number } | undefined;
	const walk = (d: string) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name === name) {
				const mtime = statSync(p).mtimeMs;
				if (!best || mtime > best.mtime) best = { path: p, mtime };
			}
		}
	};
	walk(dir);
	return best?.path;
}

const MathParams = Type.Object({
	code: Type.String({
		description:
			"Complete Python script. Import what you need (e.g. `from sympy import *`). print() every value to verify; prefer exact arithmetic and assertions like `assert simplify(lhs - rhs) == 0`.",
	}),
	purpose: Type.Optional(Type.String({ description: "What is being verified (shown to the learner)" })),
	timeoutSec: Type.Optional(Type.Integer({ minimum: 5, maximum: 300 })),
});

const PlotParams = Type.Object({
	code: Type.String({
		description:
			"Matplotlib code drawing on the current figure using `plt` (already imported, Agg backend) and `np`. Do not call plt.show() or savefig: the tool saves the figure. Label axes, use LaTeX in labels ($...$).",
	}),
	path: Type.String({ description: "Target image path relative to the vault, inside the lesson media folder, ending in .png or .svg" }),
});

const ManimParams = Type.Object({
	code: Type.String({ description: "Complete Manim Community script (`from manim import *`) defining the scene class." }),
	scene: Type.String({ description: "Scene class name to render" }),
	path: Type.String({ description: "Target path relative to the vault, inside the lesson media folder, ending in .mp4 or .gif" }),
	quality: Type.Optional(StringEnum(["low", "medium", "high"] as const, { description: "Default medium (720p30)" })),
});

export const computeTools = [
	defineTool({
		name: "math_check",
		label: "Math check",
		description:
			"Verify mathematics with Python (SymPy, NumPy, SciPy) in the workspace environment: computations, simplifications, derivatives/integrals, equation solving, numeric answers, unit sanity checks. Use it before writing or grading any computed result.",
		parameters: MathParams,
		async execute(p, env) {
			const ws = requireWorkspace();
			const python = requirePython(ws, "sympy");
			const dir = scratchDir(ws, "tmp");
			const file = join(dir, `check_${Date.now().toString(36)}.py`);
			writeFileSync(file, p.code, "utf8");
			const r = await runProcess(python, ["-X", "utf8", file], { cwd: dir, timeout: (p.timeoutSec ?? 60) * 1000, signal: env.signal, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
			const out = [r.stdout.trim() && `stdout:\n${clip(r.stdout.trim())}`, r.stderr.trim() && `stderr:\n${clip(r.stderr.trim())}`].filter(Boolean).join("\n\n");
			const status = r.killed ? "TIMEOUT" : r.code === 0 ? "OK" : `FAILED (exit ${r.code})`;
			return { ...textResult(`${status}${p.purpose ? ` — ${p.purpose}` : ""}\n${out || "(no output: print the values you want to check)"}`, { ok: r.code === 0, code: r.code }), isError: r.code !== 0 };
		},
	}),

	defineTool({
		name: "plot_render",
		label: "Plot",
		description: "Render a static matplotlib figure (function graphs, vector fields, data) into a lesson media folder and return the embed link.",
		parameters: PlotParams,
		async execute(p, env) {
			const ws = requireWorkspace();
			const python = requirePython(ws, "matplotlib");
			const target = resolveInVault(ws, p.path);
			const ext = extname(target).toLowerCase();
			if (ext !== ".png" && ext !== ".svg") throw new Error("path must end in .png or .svg");
			mkdirSync(join(target, ".."), { recursive: true });
			const dir = scratchDir(ws, "tmp");
			const file = join(dir, `plot_${Date.now().toString(36)}.py`);
			const script = [
				"import matplotlib",
				'matplotlib.use("Agg")',
				"import matplotlib.pyplot as plt",
				"import numpy as np",
				'plt.rcParams.update({"figure.figsize": (7, 4.5), "figure.dpi": 150, "axes.grid": True, "grid.alpha": 0.3})',
				p.code,
				`plt.savefig(${JSON.stringify(target)}, bbox_inches="tight")`,
				"print('saved')",
			].join("\n");
			writeFileSync(file, script, "utf8");
			const r = await runProcess(python, ["-X", "utf8", file], { cwd: dir, timeout: 120_000, signal: env.signal });
			if (r.code !== 0 || !existsSync(target)) {
				return { ...textResult(`Plot failed:\n${clip(`${r.stdout}\n${r.stderr}`.trim())}`, { ok: false }), isError: true };
			}
			return textResult(`Saved ${toPosix(relative(notesRoot(ws), target))}. Embed with: ${embed(ws, target)}`, { ok: true });
		},
	}),

	defineTool({
		name: "manim_render",
		label: "Manim",
		description:
			"Render a Manim Community animation (geometric constructions, transformations, motion, limits, vector fields) into a lesson media folder and return the embed link. Keep scenes short (5–30 s) and focused on one idea.",
		parameters: ManimParams,
		async execute(p, env) {
			const ws = requireWorkspace();
			const python = requirePython(ws, "manim");
			const target = resolveInVault(ws, p.path);
			const ext = extname(target).toLowerCase();
			if (ext !== ".mp4" && ext !== ".gif") throw new Error("path must end in .mp4 or .gif");
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.scene)) throw new Error("scene must be a Python class name");
			const scenes = scratchDir(ws, "scenes");
			const media = scratchDir(ws, "manim-media");
			const stem = basename(target, ext).replace(/[^A-Za-z0-9_-]+/g, "_") || "scene";
			const file = join(scenes, `${stem}.py`);
			writeFileSync(file, p.code, "utf8");
			const q = { low: "l", medium: "m", high: "h" }[p.quality ?? "medium"];
			env.progress?.(`Rendering ${p.scene} (${p.quality ?? "medium"})…`);
			const args = ["-X", "utf8", "-m", "manim", "render", `-q${q}`, "--media_dir", media, "-o", stem, "--format", ext.slice(1), file, p.scene];
			const r = await runProcess(python, args, { cwd: scenes, timeout: 900_000, signal: env.signal, env: envWithLatex(ws.config.python?.latexBin) });
			const produced = findFile(media, `${stem}${ext}`);
			if (r.code !== 0 || !produced) {
				const hint = /latex|MathTex|Tex\(/i.test(`${r.stderr}${p.code}`) && !ws.config.python?.latex ? "\nHint: LaTeX is not available; use Text instead of MathTex/Tex, or install MiKTeX via /learn-setup." : "";
				return { ...textResult(`Manim failed (exit ${r.code}):\n${clip(`${r.stdout}\n${r.stderr}`.trim())}${hint}`, { ok: false }), isError: true };
			}
			mkdirSync(join(target, ".."), { recursive: true });
			copyFileSync(produced, target);
			return textResult(`Saved ${toPosix(relative(notesRoot(ws), target))} (source: .learning-curve/scenes/${stem}.py). Embed with: ${embed(ws, target)}`, { ok: true });
		},
	}),
];
