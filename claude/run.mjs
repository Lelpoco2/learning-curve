#!/usr/bin/env node
// Launcher for the Claude Code side (MCP server, hooks, status line): checks that Node.js can run
// TypeScript files directly (type stripping, Node 22.18+ / 23.6+), then runs the script.
// Usage: node run.mjs <mcp|hook|statusline> [args]
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [major, minor] = process.versions.node.split(".").map(Number);
const ok = major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
if (!ok) {
	process.stderr.write(
		`Learning Curve needs Node.js 22.18 or newer (found ${process.versions.node}). Install the current LTS from https://nodejs.org/ (Windows: winget install --id OpenJS.NodeJS.LTS -e), then restart Claude Code.\n`,
	);
	process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const target = { mcp: "mcp-server.ts", hook: "hooks.ts", statusline: "statusline.ts" }[process.argv[2] ?? ""];
if (!target) {
	process.stderr.write("usage: node run.mjs <mcp|hook|statusline> [args]\n");
	process.exit(2);
}
const mod = await import(pathToFileURL(join(here, target)).href);
await mod.main?.(process.argv.slice(3));
