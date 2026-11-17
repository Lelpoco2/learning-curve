/** code_run: run and check code in the language the learner chose (lessons, exercises, grading). */

import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Type } from "../lib/schema.ts";
import { runProcess } from "../lib/exec.ts";
import { topicKind } from "../lib/kinds.ts";
import { detect, exePath, findRunner, installText, RUNNERS, runnerForFile, runnerForLanguageName, SQLITE_RUNNER_PY } from "../lib/runners.ts";
import { StringEnum } from "../lib/schema.ts";
import { clipTail, defineTool } from "../lib/tool.ts";
import { readState, requireWorkspace, resolveInVault, textResult } from "../runtime.ts";

const OUTPUT_LIMIT = { maxBytes: 20 * 1024, maxLines: 300 };

function clip(text: string): string {
	return clipTail(text, OUTPUT_LIMIT.maxLines, OUTPUT_LIMIT.maxBytes);
}

function quote(p: string): string {
	return /[\s"&|<>^]/.test(p) ? `"${p.replace(/"/g, '\\"')}"` : p;
}

const Params = Type.Object({
	action: Type.Optional(
		StringEnum(["run", "check"] as const, {
			description: "run (default): run code. check: is the language's toolchain installed (version, or how to install it)? check without language lists every known language.",
		}),
	),
	language: Type.Optional(
		Type.String({
			description: `Language: ${RUNNERS.map((r) => r.id).join(", ")} (aliases like js, ts, c++, c#, sh work). Any other language: give \`command\`.`,
		}),
	),
	code: Type.Optional(Type.String({ description: "Source code to run (written to a temporary file). Give code or path." })),
	path: Type.Optional(Type.String({ description: "Vault-relative file to run instead of code, e.g. a program in the lesson's code/ folder (runs in its folder)." })),
	stdin: Type.Optional(Type.String({ description: "Text sent to the program's standard input." })),
	args: Type.Optional(Type.Array(Type.String(), { description: "Command-line arguments for the program." })),
	command: Type.Optional(
		Type.String({
			description:
				"Custom shell command for languages or setups not built in, with placeholders {file} (source file), {dir} (its folder), {exe} (a path for a compiled program). E.g. 'kotlinc {file} -include-runtime -d {dir}/a.jar && java -jar {dir}/a.jar'.",
		}),
	),
	ext: Type.Optional(Type.String({ description: "File extension for inline code with a custom command, e.g. '.kt'." })),
	timeoutSec: Type.Optional(Type.Integer({ minimum: 5, maximum: 300, description: "Default 60 (compiling included)." })),
	purpose: Type.Optional(Type.String({ description: "What is being run or verified (shown to the learner)." })),
});

export const codeTools = [
	defineTool({
		name: "code_run",
		label: "Run code",
		description:
			"Run code in the learner's chosen language (Python, JavaScript/TypeScript, SQL on SQLite, Bash, PowerShell, C, C++, Java, Go, Rust, C#, Ruby, PHP, R, Julia, Lua, Perl, Haskell, Kotlin, or any language via a custom command) and return stdout, stderr and exit code. Use it for every snippet before writing it in a note, to produce real outputs and error messages, and to run the learner's exercise code against tests. action check tells whether a toolchain is installed and how to install it (ask the learner before installing anything).",
		parameters: Params,
		async execute(p, env) {
			const ws = requireWorkspace();
			const ctx = { python: ws.config.python?.python };

			if (p.action === "check") {
				const list = p.language ? [runnerForLanguageName(p.language)] : RUNNERS;
				if (p.language && !list[0]) {
					return textResult(`"${p.language}" is not a built-in language. Run it with a custom \`command\` (e.g. the compiler/interpreter on {file}); check that command exists with \`<cmd> --version\`.`, { ok: false });
				}
				const results = await Promise.all(list.map(async (r) => ({ r: r!, d: await detect(r!, ctx) })));
				const lines = results.map(({ r, d }) =>
					d ? `✓ ${r.id} — ${r.label}: ${d.version} (${d.tool.cmd})` : `✗ ${r.id} — ${r.label}: not installed.${p.language ? `\n${installText(r)}` : ""}`,
				);
				const missing = results.some((x) => !x.d);
				return textResult(
					`${lines.join("\n")}${missing ? "\n\nInstalling: explain what will be installed and ask the learner first; then install (e.g. the winget command with bash) and run check again — PATH changes are picked up without restarting." : ""}`,
					{ ok: !missing },
				);
			}

			if (!p.code && !p.path) throw new Error("Give code (inline source) or path (a vault file).");
			// Language: given, else the file's extension, else the active subject's language.
			let runner = p.language ? runnerForLanguageName(p.language) : undefined;
			if (!p.language && !p.command) {
				runner = p.path ? runnerForFile(p.path) : undefined;
				if (!runner) {
					const state = readState();
					const t = state.active?.topicKey ? state.topics[state.active.topicKey] : undefined;
					const lang = t ? topicKind(state, t).language : undefined;
					runner = lang ? runnerForLanguageName(lang) : undefined;
				}
				if (!runner) throw new Error("Give language (or a custom command): it could not be inferred from the file or the subject.");
			}
			if (!runner && !p.command) {
				return { ...textResult(`"${p.language}" is not a built-in language: give a custom \`command\` with {file}.`, { ok: false }), isError: true };
			}

			const work = join(ws.dataDir, "tmp", `code-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
			mkdirSync(work, { recursive: true });
			try {
				let file: string;
				let cwd: string;
				if (p.path) {
					file = resolveInVault(ws, p.path);
					if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`No such file: ${p.path}`);
					cwd = dirname(file);
				} else {
					file = join(work, runner?.fileName ?? `main${p.ext ?? runner?.ext ?? ".txt"}`);
					writeFileSync(file, p.code ?? "", "utf8");
					cwd = work;
				}
				const exe = exePath(work);
				const timeout = (p.timeoutSec ?? 60) * 1000;
				const procEnv = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
				const head = (status: string, what: string) => `${status}${p.purpose ? ` — ${p.purpose}` : ""} · ${what}`;
				const report = (r: { stdout: string; stderr: string; code: number }) =>
					[r.stdout.trim() && `stdout:\n${clip(r.stdout.trimEnd())}`, r.stderr.trim() && `stderr:\n${clip(r.stderr.trimEnd())}`, `exit code: ${r.code}`].filter(Boolean).join("\n\n");

				if (p.command) {
					const cmdline = p.command.replaceAll("{file}", quote(file)).replaceAll("{dir}", quote(work)).replaceAll("{exe}", quote(exe));
					const r = await runProcess(cmdline, p.args ?? [], { cwd, timeout, signal: env.signal, env: procEnv, input: p.stdin, shell: true });
					const status = r.killed ? "TIMEOUT" : r.code === 0 ? "OK" : "FAILED";
					return { ...textResult(`${head(status, `custom command: ${cmdline}`)}\n${report(r)}`, { ok: r.code === 0, code: r.code }), isError: r.code !== 0 };
				}

				const det = await detect(runner!, ctx);
				if (!det) {
					return {
						...textResult(`${runner!.label} is not installed (no ${runner!.candidates(ctx).map((c) => c.cmd).join(" / ")} found).\n${installText(runner!)}\nAsk the learner before installing; then run code_run check.`, { ok: false }),
						isError: true,
					};
				}
				const helper = join(work, "sqlite_runner.py");
				if (runner!.id === "sql") writeFileSync(helper, SQLITE_RUNNER_PY, "utf8");
				const what = `${runner!.label} (${det.version})`;
				let last = { stdout: "", stderr: "", code: 0 };
				for (const step of runner!.steps(det.tool, file, exe)) {
					const args = step.args.map((a) => (a === "{sqlite_runner}" ? helper : a));
					const r = await runProcess(step.cmd, step.run ? [...args, ...(p.args ?? [])] : args, { cwd, timeout, signal: env.signal, env: procEnv, input: step.run ? p.stdin : undefined });
					if (r.killed) return { ...textResult(`${head("TIMEOUT", what)} after ${timeout / 1000}s\n${report(r)}`, { ok: false }), isError: true };
					if (!step.run && r.code !== 0) {
						return { ...textResult(`${head("COMPILE FAILED", what)}\n${report(r)}`, { ok: false, code: r.code }), isError: true };
					}
					// Compiler warnings are worth showing next to the program output.
					last = step.run ? { ...r, stderr: [last.stderr, r.stderr].filter((s) => s.trim()).join("\n") } : { stdout: "", stderr: r.stderr, code: 0 };
				}
				const status = last.code === 0 ? "OK" : "FAILED";
				return { ...textResult(`${head(status, what)}\n${report(last)}`, { ok: last.code === 0, code: last.code }), isError: last.code !== 0 };
			} finally {
				try {
					rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
				} catch {
					// a compiled program may still be locked on Windows; the tmp folder is reused
				}
			}
		},
	}),
];
