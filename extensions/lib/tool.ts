/**
 * Platform-neutral tool definitions. Every Learning Curve tool is defined once here-style
 * (name, JSON schema, execute) and registered by an adapter: pi (extensions/pi-tools.ts) or the
 * MCP server for Claude Code (claude/mcp-server.ts). Dialogs go through UiPort: pi's dialogs, or
 * MCP elicitation forms.
 */

import type { Static, TSchema } from "./schema.ts";

export interface UiPort {
	/** Pick one option; undefined when cancelled. */
	select(title: string, options: string[]): Promise<string | undefined>;
	/**
	 * Free text (multi-line where the client supports it); undefined when cancelled. `field` is a
	 * short label for the input (forms show it next to the field even when the text is collapsed).
	 */
	editor(title: string, prefill?: string, field?: string): Promise<string | undefined>;
	confirm(title: string, message: string): Promise<boolean>;
}

export type Platform = "pi" | "claude-code";

export interface ToolEnv {
	signal?: AbortSignal;
	/** Interactive dialogs; undefined when the client has none. */
	ui?: UiPort;
	/** Progress text while the tool runs. */
	progress?: (text: string) => void;
	cwd: string;
	platform: Platform;
}

export interface ToolResult {
	content: { type: "text"; text: string }[];
	details?: unknown;
	isError?: boolean;
}

export interface ToolDef<S extends TSchema = TSchema> {
	name: string;
	label: string;
	description: string;
	parameters: S;
	/** pi: run alone (dialogs). */
	sequential?: boolean;
	execute(params: Static<S>, env: ToolEnv): Promise<ToolResult>;
}

export function defineTool<S extends TSchema>(def: ToolDef<S>): ToolDef<S> {
	return def;
}

/** Keep the last part of a long output (by lines and bytes). */
export function clipTail(text: string, maxLines = 400, maxBytes = 20 * 1024): string {
	const normalized = text.replace(/\r\n?/g, "\n");
	let lines = normalized.split("\n");
	let truncated = false;
	if (lines.length > maxLines) {
		lines = lines.slice(-maxLines);
		truncated = true;
	}
	let out = lines.join("\n");
	if (Buffer.byteLength(out, "utf8") > maxBytes) {
		const buf = Buffer.from(out, "utf8");
		out = buf.subarray(buf.length - maxBytes).toString("utf8").replace(/^[^\n]*\n/, "");
		truncated = true;
	}
	return truncated ? `[output truncated to the last ${out.split("\n").length} lines]\n${out}` : out;
}
