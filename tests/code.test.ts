import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detect, findRunner, installText, RUNNERS, runnerForFile, runnerForLanguageName } from "../extensions/lib/runners.ts";
import { setWorkspaceFromCwd } from "../extensions/runtime.ts";
import { registerCodeTool } from "../extensions/pi-tools.ts";

type Exec = (id: string, p: Record<string, unknown>, signal?: AbortSignal) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function tool(): Exec {
	let exec: Exec | undefined;
	registerCodeTool({ registerTool: (t: { execute: Exec }) => (exec = t.execute) } as never);
	const root = mkdtempSync(join(tmpdir(), "lc-code-"));
	mkdirSync(join(root, ".learning-curve"), { recursive: true });
	writeFileSync(join(root, ".learning-curve", "config.json"), JSON.stringify({ version: 1, app: { id: "obsidian", name: "Obsidian" }, notesRoot: ".", notesLanguage: "English", passThreshold: 0.8, learnerFolder: "00 Learner", flashcards: false }));
	mkdirSync(join(root, "T", "code"), { recursive: true });
	writeFileSync(join(root, "T", "code", "sum.js"), "const [a, b] = process.argv.slice(2).map(Number);\nconsole.log(a + b);\n");
	setWorkspaceFromCwd(root);
	return exec!;
}
const text = (r: { content: { text: string }[] }) => r.content[0].text;

test("languages resolve by id and alias; every runner has an install hint", () => {
	for (const [alias, id] of [["py", "python"], ["JS", "javascript"], ["c++", "cpp"], ["C#", "csharp"], ["golang", "go"], ["sqlite", "sql"], ["sh", "bash"]]) {
		assert.equal(findRunner(alias)?.id, id, alias);
	}
	assert.equal(findRunner("cobol"), undefined);
	assert.equal(runnerForLanguageName("Python 3.12")?.id, "python");
	assert.equal(runnerForLanguageName("C++20")?.id, "cpp");
	assert.equal(runnerForLanguageName("C# 12")?.id, "csharp");
	assert.equal(runnerForLanguageName("Java 21")?.id, "java");
	assert.equal(runnerForFile("code/a.CPP")?.id, "cpp");
	assert.equal(runnerForFile("stats.R")?.id, "r");
	for (const r of RUNNERS) assert.match(installText(r), /Official: https?:\/\//, r.id);
});

test("runs JavaScript and TypeScript with stdin and args; reports failures with stderr", async () => {
	const run = tool();
	const js = await run("1", { language: "js", code: "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(s.trim().toUpperCase(), process.argv[2]))", stdin: "ciao", args: ["!"] });
	assert.match(text(js), /^OK · JavaScript/);
	assert.match(text(js), /stdout:\nCIAO !/);
	const ts = await run("2", { language: "ts", code: "const n: number = 6 * 7;\nconsole.log(`answer ${n}`);" });
	assert.match(text(ts), /stdout:\nanswer 42/);
	const bad = await run("3", { language: "javascript", code: "null.x" });
	assert.equal(bad.isError, true);
	assert.match(text(bad), /^FAILED/);
	assert.match(text(bad), /TypeError/);
	const file = await run("4", { path: "T/code/sum.js", args: ["2", "40"] }); // language from the extension
	assert.match(text(file), /stdout:\n42/);
});

test("runs Python and SQL on SQLite (tables printed, errors reported)", { skip: !(await detect(findRunner("python")!, {})) && "no Python" }, async () => {
	const run = tool();
	assert.match(text(await run("1", { language: "python", code: "print(sum(range(10)))" })), /stdout:\n45/);
	const sql = await run("2", { language: "sql", code: "CREATE TABLE t(name TEXT, n INT);\nINSERT INTO t VALUES ('a', 1), ('b', 2);\nSELECT name, n * 10 AS x FROM t ORDER BY n;" });
	assert.match(text(sql), /name \| x\s*\n-+\+-+\na\s+\| 10\nb\s+\| 20\n\(2 rows\)/);
	const err = await run("3", { language: "sql", code: "SELECT * FROM missing;" });
	assert.equal(err.isError, true);
	assert.match(text(err), /no such table: missing/);
});

test("a compiled language: compile errors are reported separately (Rust when installed)", { skip: !(await detect(findRunner("rust")!, {})) && "no rustc" }, async () => {
	const run = tool();
	const ok = await run("1", { language: "rust", code: 'fn main() { let v = vec![1, 2, 3]; println!("{}", v.iter().sum::<i32>()); }', timeoutSec: 120 });
	assert.match(text(ok), /stdout:\n6/);
	const bad = await run("2", { language: "rust", code: "fn main() { let x: i32 = \"no\"; }", timeoutSec: 120 });
	assert.match(text(bad), /^COMPILE FAILED/);
	assert.match(text(bad), /mismatched types/);
});

test("missing toolchains explain how to install; custom commands run anything", async () => {
	const run = tool();
	const check = await run("1", { action: "check", language: "haskell" });
	assert.match(text(check), /haskell/);
	const custom = await run("2", { command: `"${process.execPath}" {file}`, ext: ".mjs", code: "console.log(2 ** 10)" });
	assert.match(text(custom), /^OK · custom command/);
	assert.match(text(custom), /stdout:\n1024/);
	const unknown = await run("3", { language: "cobol", code: "x" });
	assert.equal(unknown.isError, true);
	assert.match(text(unknown), /custom `command`/);
});
