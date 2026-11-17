/**
 * Running code in the language the learner chose. A registry of common languages (how to detect
 * the toolchain, compile and run a file, and how to install it), plus custom commands for any
 * other language. Installing is never automatic: the tutor asks the learner first.
 */

import { runProcess } from "./exec.ts";
import { IS_WINDOWS } from "./python.ts";

export interface Candidate {
	cmd: string;
	/** Arguments placed before everything else (e.g. `py -3`). */
	pre?: string[];
	version: string[];
}

export interface Step {
	cmd: string;
	args: string[];
	/** The step that runs the program (gets stdin and the program arguments). */
	run?: boolean;
}

export interface InstallHint {
	winget?: string;
	brew?: string;
	apt?: string;
	url: string;
	note?: string;
}

export interface Runner {
	id: string;
	label: string;
	aliases: string[];
	ext: string;
	/** File name for inline code (default main.<ext>). */
	fileName?: string;
	candidates: (ctx: RunnerContext) => Candidate[];
	steps: (tool: Candidate, file: string, exe: string) => Step[];
	install: InstallHint;
}

export interface RunnerContext {
	/** Workspace venv Python, when configured. */
	python?: string;
}

const EXE = IS_WINDOWS ? ".exe" : "";
const run = (cmd: string, args: string[]): Step => ({ cmd, args, run: true });
const tool = (t: Candidate, ...args: string[]): Step => ({ cmd: t.cmd, args: [...(t.pre ?? []), ...args] });
const runTool = (t: Candidate, ...args: string[]): Step => ({ ...tool(t, ...args), run: true });
const simple = (...cmds: string[]) => () => cmds.map((cmd) => ({ cmd, version: ["--version"] }));

/** SQL runs on SQLite through Python's standard library (no install needed). */
export const SQLITE_RUNNER_PY = `import sqlite3, sys
db = sqlite3.connect(sys.argv[2] if len(sys.argv) > 2 else ":memory:")
buf = ""
for line in open(sys.argv[1], encoding="utf-8"):
    buf += line
    if not sqlite3.complete_statement(buf):
        continue
    stmt, buf = buf.strip(), ""
    if not stmt:
        continue
    try:
        cur = db.execute(stmt)
    except sqlite3.Error as e:
        print(f"ERROR in: {stmt.splitlines()[0][:70]}\\n  {e}", file=sys.stderr)
        sys.exit(1)
    if cur.description:
        cols = [d[0] for d in cur.description]
        rows = [["NULL" if v is None else str(v) for v in r] for r in cur.fetchall()]
        w = [max([len(c)] + [len(r[i]) for r in rows]) for i, c in enumerate(cols)]
        print(" | ".join(c.ljust(w[i]) for i, c in enumerate(cols)))
        print("-+-".join("-" * x for x in w))
        for r in rows:
            print(" | ".join(v.ljust(w[i]) for i, v in enumerate(r)))
        print(f"({len(rows)} row{'s' if len(rows) != 1 else ''})\\n")
db.commit()
if buf.strip():
    print("ERROR: incomplete statement at the end (missing ;?)", file=sys.stderr)
    sys.exit(1)
`;

const pythonCandidates = (ctx: RunnerContext): Candidate[] => [
	...(ctx.python ? [{ cmd: ctx.python, version: ["--version"] }] : []),
	{ cmd: "python3", version: ["--version"] },
	{ cmd: "python", version: ["--version"] },
	...(IS_WINDOWS ? [{ cmd: "py", pre: ["-3"], version: ["--version"] }] : []),
];

export const RUNNERS: Runner[] = [
	{
		id: "python",
		label: "Python",
		aliases: ["py", "python3"],
		ext: ".py",
		candidates: pythonCandidates,
		steps: (t, file) => [runTool(t, "-X", "utf8", file)],
		install: { winget: "Python.Python.3.12", brew: "python", apt: "python3", url: "https://www.python.org/downloads/", note: "The workspace venv (/learn-setup) is used when present." },
	},
	{
		id: "javascript",
		label: "JavaScript (Node.js)",
		aliases: ["js", "node", "nodejs"],
		ext: ".js",
		candidates: () => [{ cmd: process.execPath, version: ["--version"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "OpenJS.NodeJS.LTS", brew: "node", apt: "nodejs", url: "https://nodejs.org/" },
	},
	{
		id: "typescript",
		label: "TypeScript (Node.js type stripping)",
		aliases: ["ts"],
		ext: ".ts",
		candidates: () => [{ cmd: process.execPath, version: ["--version"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "OpenJS.NodeJS.LTS", brew: "node", apt: "nodejs", url: "https://nodejs.org/", note: "Node.js 22.18+ runs .ts files directly (types are stripped, not checked)." },
	},
	{
		id: "sql",
		label: "SQL (SQLite)",
		aliases: ["sqlite", "sqlite3"],
		ext: ".sql",
		candidates: pythonCandidates,
		steps: (t, file) => [runTool(t, "-X", "utf8", "{sqlite_runner}", file)],
		install: { url: "https://www.sqlite.org/", note: "Runs on SQLite through Python (no extra install). Other databases (PostgreSQL, MySQL): use a custom command." },
	},
	{
		id: "bash",
		label: "Bash",
		aliases: ["sh", "shell"],
		ext: ".sh",
		candidates: () => [{ cmd: "bash", version: ["--version"] }, { cmd: "sh", version: ["--version"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "Git.Git", url: "https://git-scm.com/", note: "On Windows, Git for Windows includes Git Bash." },
	},
	{
		id: "powershell",
		label: "PowerShell",
		aliases: ["pwsh", "ps", "ps1"],
		ext: ".ps1",
		candidates: () => [{ cmd: "pwsh", version: ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"] }, { cmd: "powershell", version: ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"] }],
		steps: (t, file) => [runTool(t, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file)],
		install: { winget: "Microsoft.PowerShell", brew: "powershell", url: "https://learn.microsoft.com/powershell/" },
	},
	{
		id: "c",
		label: "C",
		aliases: [],
		ext: ".c",
		candidates: simple("gcc", "clang", "cc"),
		steps: (t, file, exe) => [tool(t, "-std=c17", "-Wall", "-Wextra", file, "-o", exe, "-lm"), run(exe, [])],
		install: { winget: "BrechtSanders.WinLibs.POSIX.UCRT", brew: "gcc", apt: "build-essential", url: "https://winlibs.com/", note: "WinLibs = GCC (MinGW-w64) for Windows." },
	},
	{
		id: "cpp",
		label: "C++",
		aliases: ["c++", "cxx", "cc"],
		ext: ".cpp",
		candidates: simple("g++", "clang++", "c++"),
		steps: (t, file, exe) => [tool(t, "-std=c++20", "-Wall", "-Wextra", file, "-o", exe), run(exe, [])],
		install: { winget: "BrechtSanders.WinLibs.POSIX.UCRT", brew: "gcc", apt: "build-essential", url: "https://winlibs.com/" },
	},
	{
		id: "java",
		label: "Java",
		aliases: [],
		ext: ".java",
		fileName: "Main.java",
		candidates: () => [{ cmd: "java", version: ["--version"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "EclipseAdoptium.Temurin.21.JDK", brew: "openjdk", apt: "default-jdk", url: "https://adoptium.net/", note: "Java 11+ runs a single .java file directly." },
	},
	{
		id: "go",
		label: "Go",
		aliases: ["golang"],
		ext: ".go",
		candidates: () => [{ cmd: "go", version: ["version"] }],
		steps: (t, file) => [runTool(t, "run", file)],
		install: { winget: "GoLang.Go", brew: "go", apt: "golang", url: "https://go.dev/dl/" },
	},
	{
		id: "rust",
		label: "Rust",
		aliases: ["rs"],
		ext: ".rs",
		candidates: () => [{ cmd: "rustc", version: ["--version"] }],
		steps: (t, file, exe) => [tool(t, "--edition", "2021", file, "-o", exe), run(exe, [])],
		install: { winget: "Rustlang.Rustup", brew: "rustup", url: "https://rustup.rs/", note: "On Windows rustup may also ask for the Visual Studio C++ Build Tools." },
	},
	{
		id: "csharp",
		label: "C#",
		aliases: ["c#", "cs", "dotnet"],
		ext: ".cs",
		candidates: () => [{ cmd: "dotnet", version: ["--version"] }],
		steps: (t, file) => [runTool(t, "run", file)],
		install: { winget: "Microsoft.DotNet.SDK.10", brew: "dotnet-sdk", url: "https://dotnet.microsoft.com/download", note: "Running a single .cs file needs the .NET 10 SDK or newer." },
	},
	{
		id: "ruby",
		label: "Ruby",
		aliases: ["rb"],
		ext: ".rb",
		candidates: simple("ruby"),
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "RubyInstallerTeam.RubyWithDevKit.3.3", brew: "ruby", apt: "ruby", url: "https://www.ruby-lang.org/" },
	},
	{
		id: "php",
		label: "PHP",
		aliases: [],
		ext: ".php",
		candidates: simple("php"),
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "PHP.PHP.8.4", brew: "php", apt: "php-cli", url: "https://www.php.net/" },
	},
	{
		id: "r",
		label: "R",
		aliases: ["rscript"],
		ext: ".R",
		candidates: simple("Rscript"),
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "RProject.R", brew: "r", apt: "r-base", url: "https://cran.r-project.org/" },
	},
	{
		id: "julia",
		label: "Julia",
		aliases: ["jl"],
		ext: ".jl",
		candidates: simple("julia"),
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "Julialang.Julia", brew: "julia", url: "https://julialang.org/downloads/" },
	},
	{
		id: "lua",
		label: "Lua",
		aliases: [],
		ext: ".lua",
		candidates: () => ["lua", "lua5.4", "lua54"].map((cmd) => ({ cmd, version: ["-v"] })),
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "DEVCOM.Lua", brew: "lua", apt: "lua5.4", url: "https://www.lua.org/" },
	},
	{
		id: "perl",
		label: "Perl",
		aliases: ["pl"],
		ext: ".pl",
		candidates: () => [{ cmd: "perl", version: ["-v"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { winget: "StrawberryPerl.StrawberryPerl", brew: "perl", apt: "perl", url: "https://www.perl.org/" },
	},
	{
		id: "haskell",
		label: "Haskell",
		aliases: ["hs", "ghc"],
		ext: ".hs",
		candidates: () => [{ cmd: "runghc", version: ["--version"] }],
		steps: (t, file) => [runTool(t, file)],
		install: { brew: "ghc", apt: "ghc", url: "https://www.haskell.org/ghcup/", note: "Install GHCup from the official page (no winget package)." },
	},
	{
		id: "kotlin",
		label: "Kotlin (script)",
		aliases: ["kt", "kts"],
		ext: ".kts",
		candidates: () => [{ cmd: "kotlinc", version: ["-version"] }],
		steps: (t, file) => [runTool(t, "-script", file)],
		install: { brew: "kotlin", url: "https://kotlinlang.org/docs/command-line.html", note: "Needs a JDK too; install the compiler from the official page (no winget package)." },
	},
];

export function findRunner(language: string): Runner | undefined {
	const l = language.trim().toLowerCase();
	return RUNNERS.find((r) => r.id === l || r.aliases.includes(l) || r.label.toLowerCase() === l);
}

/** Runner for a source file, from its extension. */
export function runnerForFile(path: string): Runner | undefined {
	const ext = path.match(/\.[^./\\]+$/)?.[0]?.toLowerCase();
	return ext ? RUNNERS.find((r) => r.ext.toLowerCase() === ext) : undefined;
}

/** Runner for a language as the learner names it: "Python 3.12" → python, "C++20" → cpp, "C# 12" → csharp. */
export function runnerForLanguageName(name: string): Runner | undefined {
	return findRunner(name) ?? findRunner(name.trim().replace(/\s*v?\d[\w.]*\s*$/i, ""));
}

export function installText(r: Runner): string {
	const h = r.install;
	const lines = [
		h.winget ? `Windows: winget install --id ${h.winget} -e` : "",
		h.brew ? `macOS: brew install ${h.brew}` : "",
		h.apt ? `Debian/Ubuntu: sudo apt install ${h.apt}` : "",
		`Official: ${h.url}`,
		h.note ?? "",
	];
	return lines.filter(Boolean).join("\n");
}

export interface Detected {
	tool: Candidate;
	version: string;
}

/** On Windows, pick up PATH changes made by installers after pi started (registry values). */
export async function refreshWindowsPath(): Promise<boolean> {
	if (!IS_WINDOWS) return false;
	const r = await runProcess("powershell", ["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"], { timeout: 15_000 });
	if (r.code !== 0 || !r.stdout.trim()) return false;
	const key = Object.keys(process.env).find((k) => k.toLowerCase() === "path") ?? "Path";
	const current = (process.env[key] ?? "").split(";").filter(Boolean);
	const fresh = r.stdout.trim().split(";").filter(Boolean);
	const merged = [...current, ...fresh.filter((p) => !current.some((c) => c.toLowerCase() === p.toLowerCase()))];
	if (merged.length === current.length) return false;
	process.env[key] = merged.join(";");
	return true;
}

/** First available toolchain of a language, with its version string. */
export async function detect(r: Runner, ctx: RunnerContext): Promise<Detected | undefined> {
	const tryAll = async () => {
		for (const c of r.candidates(ctx)) {
			const res = await runProcess(c.cmd, [...(c.pre ?? []), ...c.version], { timeout: 20_000 });
			if (res.code === 0) {
				const version = `${res.stdout}\n${res.stderr}`.trim().split(/\r?\n/)[0]?.trim() ?? "";
				return { tool: c, version };
			}
		}
		return undefined;
	};
	return (await tryAll()) ?? ((await refreshWindowsPath()) ? await tryAll() : undefined);
}

export function exePath(dir: string): string {
	return `${dir}${IS_WINDOWS ? "\\" : "/"}program${EXE}`;
}
