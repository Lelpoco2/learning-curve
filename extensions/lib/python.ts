/** Python environment (SymPy, matplotlib, Manim) and LaTeX detection/installation. */

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { PythonConfig } from "./types.ts";

export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed?: boolean;
}

export type Exec = (
	command: string,
	args: string[],
	options?: { cwd?: string; timeout?: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv; input?: string; shell?: boolean },
) => Promise<ExecResult>;

export const IS_WINDOWS = process.platform === "win32";
export const PY_PACKAGES = ["sympy", "numpy", "scipy", "matplotlib", "manim", "pypdf"];
/** Manim wheels lag behind the newest CPython; pin a well-supported version for the venv. */
export const VENV_PYTHON_VERSION = "3.12";

export function venvPython(venv: string): string {
	return IS_WINDOWS ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
}

export async function which(exec: Exec, name: string): Promise<boolean> {
	try {
		const r = await exec(IS_WINDOWS ? "where" : "which", [name], { timeout: 10_000 });
		return r.code === 0 && r.stdout.trim().length > 0;
	} catch {
		return false;
	}
}

/** Known MiKTeX / TeX Live binary folders that may not be on PATH yet (e.g. right after install). */
export function latexCandidateDirs(): string[] {
	const dirs: string[] = [];
	if (IS_WINDOWS) {
		const local = process.env.LOCALAPPDATA;
		const pf = process.env.ProgramFiles ?? "C:\\Program Files";
		if (local) dirs.push(join(local, "Programs", "MiKTeX", "miktex", "bin", "x64"));
		dirs.push(join(pf, "MiKTeX", "miktex", "bin", "x64"));
		for (const year of ["2027", "2026", "2025", "2024"]) dirs.push(join("C:\\texlive", year, "bin", "windows"));
	} else {
		dirs.push("/Library/TeX/texbin", "/usr/local/texlive/2026/bin/x86_64-linux", "/usr/bin");
	}
	return dirs;
}

export function findLatexBin(): string | undefined {
	const exe = IS_WINDOWS ? "latex.exe" : "latex";
	return latexCandidateDirs().find((d) => existsSync(join(d, exe)));
}

export async function detectLatex(exec: Exec): Promise<{ available: boolean; bin?: string }> {
	if (await which(exec, "latex")) return { available: true };
	const bin = findLatexBin();
	return bin ? { available: true, bin } : { available: false };
}

export function envWithLatex(bin?: string): NodeJS.ProcessEnv {
	if (!bin) return { ...process.env };
	const key = Object.keys(process.env).find((k) => k.toLowerCase() === "path") ?? "PATH";
	return { ...process.env, [key]: `${bin}${delimiter}${process.env[key] ?? ""}` };
}

/** Check which Python modules import successfully with the given interpreter. */
export async function probeModules(exec: Exec, python: string, modules: string[]): Promise<Record<string, boolean>> {
	const code = `import importlib.util,json;print(json.dumps({m: importlib.util.find_spec(m) is not None for m in ${JSON.stringify(modules)}}))`;
	try {
		const r = await exec(python, ["-c", code], { timeout: 60_000 });
		if (r.code !== 0) return Object.fromEntries(modules.map((m) => [m, false]));
		return JSON.parse(r.stdout.trim().split(/\r?\n/).pop() ?? "{}");
	} catch {
		return Object.fromEntries(modules.map((m) => [m, false]));
	}
}

export interface SetupStep {
	step: string;
	ok: boolean;
	output?: string;
}

/** Create the venv with uv (preferred) or the system Python, then install packages. */
export async function createVenv(
	exec: Exec,
	venv: string,
	packages: string[],
	onStep: (msg: string) => void,
	signal?: AbortSignal,
): Promise<{ python?: string; steps: SetupStep[] }> {
	const steps: SetupStep[] = [];
	const hasUv = await which(exec, "uv");
	const python = venvPython(venv);
	const tail = (r: ExecResult) => `${r.stdout}\n${r.stderr}`.trim().split(/\r?\n/).slice(-15).join("\n");

	if (!existsSync(python)) {
		onStep(hasUv ? `Creating venv with uv (Python ${VENV_PYTHON_VERSION})…` : "Creating venv with the system Python…");
		const r = hasUv
			? await exec("uv", ["venv", "--python", VENV_PYTHON_VERSION, venv], { timeout: 600_000, signal })
			: await exec(IS_WINDOWS ? "python" : "python3", ["-m", "venv", venv], { timeout: 600_000, signal });
		steps.push({ step: "venv", ok: r.code === 0, output: tail(r) });
		if (r.code !== 0) return { steps };
	}

	onStep(`Installing ${packages.join(", ")} (this can take a few minutes)…`);
	const r = hasUv
		? await exec("uv", ["pip", "install", "--python", python, ...packages], { timeout: 1_800_000, signal })
		: await exec(python, ["-m", "pip", "install", ...packages], { timeout: 1_800_000, signal });
	steps.push({ step: "packages", ok: r.code === 0, output: tail(r) });
	return { python, steps };
}

/** Install MiKTeX with winget and enable on-the-fly package installation (Windows only). */
export async function installMiktex(exec: Exec, onStep: (msg: string) => void, signal?: AbortSignal): Promise<SetupStep[]> {
	const steps: SetupStep[] = [];
	if (!IS_WINDOWS) {
		steps.push({ step: "miktex", ok: false, output: "Automatic install is Windows-only. Install TeX Live or MacTeX manually." });
		return steps;
	}
	onStep("Installing MiKTeX with winget (≈1 GB, may ask for confirmation)…");
	const r = await exec(
		"winget",
		["install", "--id", "MiKTeX.MiKTeX", "-e", "--accept-package-agreements", "--accept-source-agreements", "--silent"],
		{ timeout: 3_600_000, signal },
	);
	steps.push({ step: "miktex", ok: r.code === 0, output: `${r.stdout}\n${r.stderr}`.trim().split(/\r?\n/).slice(-10).join("\n") });
	const bin = findLatexBin();
	if (bin) {
		const initexmf = join(bin, IS_WINDOWS ? "initexmf.exe" : "initexmf");
		const auto = await exec(initexmf, ["--set-config-value=[MPM]AutoInstall=1"], { timeout: 60_000 });
		steps.push({ step: "miktex-autoinstall", ok: auto.code === 0 });
	}
	return steps;
}

/** Build a PythonConfig by probing the interpreter. */
export async function probePython(exec: Exec, python: string, venv?: string): Promise<PythonConfig> {
	const mods = await probeModules(exec, python, ["sympy", "matplotlib", "manim"]);
	const latex = await detectLatex(exec);
	return {
		python,
		venv,
		sympy: !!mods.sympy,
		matplotlib: !!mods.matplotlib,
		manim: !!mods.manim,
		latex: latex.available,
		latexBin: latex.bin,
	};
}
