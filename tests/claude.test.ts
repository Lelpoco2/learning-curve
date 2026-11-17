import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { postToolUse, sessionStart } from "../claude/hooks.ts";
import { compact, LearningCurveServer } from "../claude/mcp-server.ts";
import { chatMathRule } from "../claude/platform.ts";
import { ROUTES } from "../extensions/commands.ts";
import { mathToPlain } from "../extensions/lib/texplain.ts";

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "lc-claude-"));
	mkdirSync(join(root, ".learning-curve"), { recursive: true });
	writeFileSync(
		join(root, ".learning-curve", "config.json"),
		JSON.stringify({ version: 1, app: { id: "obsidian", name: "Obsidian" }, notesRoot: ".", notesLanguage: "Italiano", passThreshold: 0.8, learnerFolder: "00 Learner", flashcards: true, numberTopicFolders: true }),
	);
	return root;
}

/** A fake MCP client: collects messages and answers elicitation forms from a script. */
function client(dir: string, answers: Record<string, unknown>[] = [], elicitation = true) {
	const sent: Record<string, unknown>[] = [];
	const forms: string[] = [];
	const server: LearningCurveServer = new LearningCurveServer(
		{
			send: (m) => {
				const msg = m as { id?: string; method?: string; params?: { message: string } };
				sent.push(msg as Record<string, unknown>);
				if (msg.method === "elicitation/create") {
					forms.push(msg.params!.message);
					const content = answers.shift();
					queueMicrotask(() => void server.handle({ jsonrpc: "2.0", id: msg.id, result: content ? { action: "accept", content } : { action: "decline" } }));
				}
			},
			log: () => {},
		},
		dir,
	);
	let id = 0;
	const call = async (method: string, params: Record<string, unknown> = {}) => {
		const myId = ++id;
		await server.handle({ jsonrpc: "2.0", id: myId, method, params });
		return sent.find((m) => m.id === myId) as { result?: Record<string, unknown>; error?: { message: string } };
	};
	return { call, sent, forms, init: () => call("initialize", { protocolVersion: "2025-06-18", capabilities: elicitation ? { elicitation: {} } : {}, clientInfo: { name: "test", version: "1" } }) };
}

test("MCP: initialize, tools/list with plain JSON schemas, unknown methods", async () => {
	const c = client(workspace());
	const init = await c.init();
	assert.equal((init.result as { protocolVersion: string }).protocolVersion, "2025-06-18");
	const list = (await c.call("tools/list")).result as { tools: { name: string; description: string; inputSchema: Record<string, unknown> }[] };
	const names = list.tools.map((t) => t.name);
	for (const n of ["learning_state", "quiz_ask", "quiz_record", "math_check", "code_run", "note_check", "tutor_context", "workspace_setup", "obsidian_plugins"]) assert.ok(names.includes(n), n);
	const ls = list.tools.find((t) => t.name === "learning_state")!;
	assert.equal(ls.inputSchema.type, "object");
	assert.deepEqual(ls.inputSchema.required, ["action"]);
	assert.match(list.tools.find((t) => t.name === "quiz_ask")!.description, /first write the questions in full in chat/);
	assert.equal((await c.call("nope")).error?.message, "Method not found: nope");
});

test("MCP: tools run in the project's workspace; errors come back as tool errors", async () => {
	const dir = workspace();
	const c = client(dir);
	await c.init();
	const r = (await c.call("tools/call", { name: "code_run", arguments: { language: "javascript", code: "console.log(6*7)" } })).result as { content: { text: string }[] };
	assert.match(r.content[0].text, /stdout:\n42/);
	const ls = (await c.call("tools/call", { name: "learning_state", arguments: { action: "set_kind" } })).result as { content: { text: string }[] };
	assert.match(ls.content[0].text, /Lesson kinds available/);
	const bad = (await c.call("tools/call", { name: "learning_state", arguments: { action: "paths" } })).result as { isError?: boolean; content: { text: string }[] };
	assert.equal(bad.isError, true);
	const outside = client(mkdtempSync(join(tmpdir(), "lc-none-")));
	await outside.init();
	const o = (await outside.call("tools/call", { name: "learning_state", arguments: { action: "overview" } })).result as { isError?: boolean; content: { text: string }[] };
	assert.equal(o.isError, true);
	assert.match(o.content[0].text, /Not inside a learning workspace/);
});

test("MCP: quiz_ask runs through elicitation forms (answer, why), LaTeX shown as plain text", async () => {
	const c = client(workspace(), [{ text: "4" }, { text: "perché 2+2=4" }]);
	await c.init();
	const r = (await c.call("tools/call", { name: "quiz_ask", arguments: { title: "Prova", questions: [{ id: "q1", type: "short", prompt: "Quanto vale $2^2$ in $\\mathbb{N}$?" }] } })).result as {
		content: { text: string }[];
	};
	assert.equal(c.forms.length, 2);
	assert.match(c.forms[0], /^Prova · Question 1\/1\nQuanto vale 2\^2 in ℕ\?/);
	assert.ok(!c.forms[0].includes("\n\n"), "no blank lines: the client shows only the first lines");
	const fields = c.sent.filter((m) => m.method === "elicitation/create").map((m) => (m.params as { requestedSchema: { properties: { text: { title: string } } } }).requestedSchema.properties.text.title);
	assert.match(fields[0], /^Answer — empty to skip$/);
	assert.equal(fields[1], "Why? Explain your reasoning");
	assert.match(r.content[0].text, /4/);
	assert.match(r.content[0].text, /perché 2\+2=4/);
	// A client without forms: the tutor is told to ask in chat.
	const plain = client(workspace(), [], false);
	await plain.init();
	const p = (await plain.call("tools/call", { name: "quiz_ask", arguments: { questions: [{ id: "q1", type: "short", prompt: "x?" }] } })).result as { content: { text: string }[] };
	assert.match(p.content[0].text, /No interactive UI available/);
});

test("compact() drops blank lines; LaTeX → plain text for forms", () => {
	assert.equal(compact("A\n\n  \nB  \n\nC"), "A\nB\nC");
	assert.equal(mathToPlain("Sia $f(x)=x^3-3x$ su $\\mathbb{R}$ e $\\frac{a}{b+1} \\le \\sqrt{2}$"), "Sia f(x)=x^3-3x su ℝ e a/(b+1) ≤ √2");
	assert.equal(mathToPlain("$e^{i\\pi}+1=0$, $90^\\circ$, $x_{n+1}$"), "e^(iπ)+1=0, 90°, x_(n+1)");
	assert.equal(mathToPlain("Costa \\$5"), "Costa \\$5");
});

test("hooks: session start injects persona + context only inside a workspace; post-edit check reports errors", () => {
	assert.equal(sessionStart({ cwd: mkdtempSync(join(tmpdir(), "lc-none-")) }), undefined);
	const dir = workspace();
	const s = sessionStart({ cwd: dir, source: "startup" }) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
	assert.equal(s.hookSpecificOutput.hookEventName, "SessionStart");
	assert.match(s.hookSpecificOutput.additionalContext, /running inside Claude Code/);
	assert.match(s.hookSpecificOutput.additionalContext, /<platform>[\s\S]*<\/platform>/);
	assert.match(s.hookSpecificOutput.additionalContext, /<learning_context>[\s\S]*Workspace:/);
	assert.ok(existsSync(join(dir, "00 Learner", "Dashboard.md")), "learner notes scaffolded");

	writeFileSync(join(dir, "Bad.md"), "Formula: $x^2 $\n");
	const bad = postToolUse({ tool_name: "Write", tool_input: { file_path: join(dir, "Bad.md") }, cwd: dir }) as { decision: string; reason: string };
	assert.equal(bad.decision, "block");
	assert.match(bad.reason, /space next to `\$`/);
	writeFileSync(join(dir, "Good.md"), "# Good\n\nFormula: $x^2$\n");
	assert.equal(postToolUse({ tool_name: "Edit", tool_input: { file_path: join(dir, "Good.md") }, cwd: dir }), undefined);
	assert.equal(postToolUse({ tool_name: "Bash", tool_input: { command: "ls" }, cwd: dir }), undefined);
	assert.equal(postToolUse({ tool_name: "Write", tool_input: { file_path: join(dir, "script.py") }, cwd: dir }), undefined);
});

test("chat math rule follows the client", () => {
	assert.match(chatMathRule("cli"), /Unicode/);
	assert.match(chatMathRule("claude-vscode"), /KaTeX/);
	assert.match(chatMathRule("claude-desktop"), /double dollars/);
});

test("plugin packaging: a command for every pi route, manifest version = package version", () => {
	const root = join(import.meta.dirname, "..");
	for (const r of ROUTES) {
		const md = readFileSync(join(root, "commands", `${r.name}.md`), "utf8");
		assert.match(md, /^---\ndescription: "Learning Curve:/, r.name);
		assert.ok(md.includes(`learning-curve:${r.skill}`), `${r.name} → ${r.skill}`);
		assert.ok(md.includes("$ARGUMENTS"), r.name);
	}
	for (const extra of ["progress", "check-notes", "learn-setup", "learn-plugins"]) assert.ok(existsSync(join(root, "commands", `${extra}.md`)), extra);
	const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const plugin = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
	assert.equal(plugin.version, pkg.version);
	const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
	assert.deepEqual(mcp.mcpServers["learning-curve"].args, ["${CLAUDE_PLUGIN_ROOT}/claude/run.mjs", "mcp"]);
});
