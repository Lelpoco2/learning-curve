/**
 * Learning Curve MCP server for Claude Code (stdio, JSON-RPC 2.0, no dependencies).
 * Exposes the same tools as the pi extension plus Claude-only ones (setup, plugins, context).
 * Dialogs (quiz_ask) use MCP elicitation forms when the client supports them.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setMathRenderer } from "../extensions/lib/mathtext.ts";
import { toJsonSchema } from "../extensions/lib/schema.ts";
import { mathToPlain } from "../extensions/lib/texplain.ts";
import type { ToolDef, ToolEnv, UiPort } from "../extensions/lib/tool.ts";
import { setWorkspaceFromCwd } from "../extensions/runtime.ts";
import { codeTools } from "../extensions/tools/code.ts";
import { computeTools } from "../extensions/tools/compute.ts";
import { learnerTools } from "../extensions/tools/learner.ts";
import { noteCheckTools } from "../extensions/tools/notecheck.ts";
import { quizTools } from "../extensions/tools/quiz.ts";
import { sourceTools } from "../extensions/tools/sources.ts";
import { stateTools } from "../extensions/tools/state.ts";
import { claudeTools } from "./tools.ts";

const PACKAGE_ROOT = join(import.meta.dirname, "..");
const VERSION = (() => {
	try {
		return (JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string }).version;
	} catch {
		return "0.0.0";
	}
})();
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

/** Claude Code specifics appended to shared tool descriptions. */
const CLAUDE_NOTES: Record<string, string> = {
	quiz_ask:
		" In Claude Code each question is a small form that shows only its first one or two lines: in the same turn, first write the questions in full in chat (numbered, with options), then call quiz_ask. Write math in plain text or Unicode (x^2, √x, ≤), not LaTeX.",
};

export const TOOLS: ToolDef[] = [...stateTools, ...quizTools, ...learnerTools, ...computeTools, ...codeTools, ...sourceTools, ...noteCheckTools, ...claudeTools] as ToolDef[];

type Id = string | number;
interface Message {
	jsonrpc: "2.0";
	id?: Id;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
	error?: { code: number; message: string };
}

export interface ServerIO {
	send(message: object): void;
	log(text: string): void;
}

/** The protocol logic, independent of stdio (tests drive it directly). */
export class LearningCurveServer {
	private clientCanElicit = false;
	private nextId = 1;
	private pending = new Map<Id, (m: Message) => void>();
	private running = new Map<Id, AbortController>();
	private io: ServerIO;
	private projectDir: string;
	private tools: ToolDef[];

	constructor(io: ServerIO, projectDir: string, tools: ToolDef[] = TOOLS) {
		this.io = io;
		this.projectDir = projectDir;
		this.tools = tools;
		// Forms show raw text in every Claude Code client: LaTeX becomes readable plain text.
		setMathRenderer(mathToPlain);
	}

	async handle(m: Message): Promise<void> {
		// Response to one of our requests (elicitation).
		if (m.method === undefined && m.id !== undefined) {
			this.pending.get(m.id)?.(m);
			this.pending.delete(m.id);
			return;
		}
		if (m.method === "notifications/cancelled") {
			this.running.get((m.params?.requestId as Id) ?? "")?.abort();
			return;
		}
		if (m.id === undefined) return; // other notifications (initialized…)
		try {
			const result = await this.request(m.id, m.method ?? "", m.params ?? {});
			this.io.send({ jsonrpc: "2.0", id: m.id, result });
		} catch (error) {
			const err = error as { code?: number; message?: string };
			this.io.send({ jsonrpc: "2.0", id: m.id, error: { code: err.code ?? -32603, message: err.message ?? String(error) } });
		}
	}

	private async request(id: Id, method: string, params: Record<string, unknown>): Promise<unknown> {
		switch (method) {
			case "initialize": {
				const caps = (params.capabilities ?? {}) as Record<string, unknown>;
				this.clientCanElicit = caps.elicitation !== undefined;
				const requested = String(params.protocolVersion ?? "");
				return {
					protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : "2025-06-18",
					capabilities: { tools: { listChanged: false } },
					serverInfo: { name: "learning-curve", title: "Learning Curve", version: VERSION },
					instructions:
						"Learning Curve tutor tools: learning bookkeeping (subjects, topics, lessons, quizzes, gaps, spaced repetition), verification (math_check, code_run, source_lookup), visuals and note checks for an Obsidian learning vault. Active only inside a learning workspace (run workspace_setup to create one).",
				};
			}
			case "ping":
				return {};
			case "tools/list":
				return {
					tools: this.tools.map((t) => ({ name: t.name, title: t.label, description: t.description + (CLAUDE_NOTES[t.name] ?? ""), inputSchema: toJsonSchema(t.parameters) })),
				};
			case "tools/call":
				return this.callTool(id, params);
			default:
				throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
		}
	}

	private async callTool(id: Id, params: Record<string, unknown>): Promise<unknown> {
		const tool = this.tools.find((t) => t.name === params.name);
		if (!tool) throw Object.assign(new Error(`Unknown tool: ${String(params.name)}`), { code: -32602 });
		const abort = new AbortController();
		this.running.set(id, abort);
		const progressToken = (params._meta as { progressToken?: string | number } | undefined)?.progressToken;
		let step = 0;
		const env: ToolEnv = {
			signal: abort.signal,
			ui: this.clientCanElicit ? this.elicitationUi() : undefined,
			progress:
				progressToken !== undefined
					? (message) => this.io.send({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken, progress: ++step, message } })
					: undefined,
			cwd: this.projectDir,
			platform: "claude-code",
		};
		// The workspace may have been created or reconfigured since the last call.
		setWorkspaceFromCwd(this.projectDir);
		try {
			const r = await tool.execute((params.arguments ?? {}) as never, env);
			return { content: r.content, ...(r.isError ? { isError: true } : {}) };
		} catch (error) {
			return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
		} finally {
			this.running.delete(id);
		}
	}

	/** Ask the client to show a form; resolves with the accepted content or undefined. */
	private elicit(message: string, properties: Record<string, unknown>, required: string[]): Promise<Record<string, unknown> | undefined> {
		const id = `lc-${this.nextId++}`;
		return new Promise((resolve) => {
			this.pending.set(id, (m) => {
				const r = m.result as { action?: string; content?: Record<string, unknown> } | undefined;
				resolve(!m.error && r?.action === "accept" ? (r.content ?? {}) : undefined);
			});
			this.io.send({ jsonrpc: "2.0", id, method: "elicitation/create", params: { message, requestedSchema: { type: "object", properties, required } } });
		});
	}

	private elicitationUi(): UiPort {
		return {
			select: async (title, options) => {
				const r = await this.elicit(compact(title), { choice: { type: "string", title: "Choice", enum: options } }, ["choice"]);
				return typeof r?.choice === "string" ? r.choice : undefined;
			},
			editor: async (title, prefill, field) => {
				const r = await this.elicit(compact(title), { text: { type: "string", title: field ?? "Answer", ...(prefill ? { default: prefill } : {}) } }, []);
				return r === undefined ? undefined : typeof r.text === "string" ? r.text : "";
			},
			confirm: async (title, message) => {
				const r = await this.elicit(`${title}\n\n${message}`, { ok: { type: "boolean", title: "Yes", default: true } }, ["ok"]);
				return r?.ok === true;
			},
		};
	}
}

/**
 * Claude Code shows only the first lines of a form's message: drop blank lines so the question
 * itself stays visible (the input's own label carries the instruction).
 */
export function compact(text: string): string {
	return text
		.split(/\r?\n/)
		.map((l) => l.trimEnd())
		.filter((l) => l.trim() !== "")
		.join("\n");
}

/** stdio transport: one JSON-RPC message per line. */
export function serveStdio(projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()): void {
	const server = new LearningCurveServer(
		{
			send: (m) => process.stdout.write(`${JSON.stringify(m)}\n`),
			log: (t) => process.stderr.write(`${t}\n`),
		},
		projectDir,
	);
	const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
	const inFlight = new Set<Promise<void>>();
	rl.on("line", (line) => {
		if (!line.trim()) return;
		let m: Message;
		try {
			m = JSON.parse(line) as Message;
		} catch {
			process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
			return;
		}
		const job = server.handle(m).finally(() => inFlight.delete(job));
		inFlight.add(job);
	});
	// Input closed (client gone or end of a scripted session): finish running calls, then exit.
	rl.on("close", () => {
		void Promise.allSettled([...inFlight]).then(() => process.exit(0));
	});
}

/** Entry point (claude/run.mjs mcp). */
export async function main(): Promise<void> {
	serveStdio();
}

if (process.argv[1] && /mcp-server\.ts$/.test(process.argv[1])) serveStdio();
