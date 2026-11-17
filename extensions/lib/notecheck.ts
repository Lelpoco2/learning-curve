/** Checking notes in a vault (shared by pi, the MCP server and Claude Code hooks). */

import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { buildVaultIndex, formatIssues, type Issue, lintNote, type VaultIndex } from "./lint.ts";
import { toPosix } from "./paths.ts";
import { listVaultFiles } from "./vault-files.ts";
import { notesRoot, type Workspace } from "./workspace.ts";

const MAX_LINES = 300;

export interface FileReport {
	file: string;
	issues: Issue[];
}

export function checkFiles(vault: string, files: string[], index: VaultIndex): FileReport[] {
	const reports: FileReport[] = [];
	for (const rel of files) {
		// Template folders legitimately contain {{placeholders}}.
		if (/(^|\/)templates?\//i.test(rel)) continue;
		const issues = lintNote(readFileSync(join(vault, rel), "utf8"), { index });
		if (issues.length) reports.push({ file: rel, issues });
	}
	return reports;
}

/** Check a note or folder (vault-relative or absolute); the whole vault when omitted. */
export function checkScope(ws: Workspace, scope?: string): { reports: FileReport[]; checked: number } {
	const vault = notesRoot(ws);
	const all = listVaultFiles(vault);
	const index = buildVaultIndex(all);
	let files = all.filter((f) => f.toLowerCase().endsWith(".md"));
	if (scope?.trim()) {
		const abs = resolve(vault, scope.trim().replace(/^@/, ""));
		const rel = toPosix(relative(vault, abs));
		if (rel.startsWith("..")) throw new Error(`Path must be inside the vault: ${scope}`);
		const isDir = existsSync(abs) && statSync(abs).isDirectory();
		files = files.filter((f) => (isDir ? rel === "" || f.startsWith(`${rel}/`) : f === rel || f === `${rel}.md`));
		if (files.length === 0) throw new Error(`No notes found at ${scope}`);
	}
	return { reports: checkFiles(vault, files, index), checked: files.length };
}

export function summarize(reports: FileReport[], checked: number): { text: string; errors: number; warnings: number } {
	const errors = reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === "error").length, 0);
	const warnings = reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === "warning").length, 0);
	const lines = reports.flatMap((r) => formatIssues(r.file, r.issues).split("\n"));
	const shown = lines.slice(0, MAX_LINES);
	const head = `Checked ${checked} note(s): ${errors} error(s), ${warnings} warning(s) in ${reports.length} note(s).`;
	return { text: [head, ...shown, ...(lines.length > MAX_LINES ? [`… ${lines.length - MAX_LINES} more`] : [])].join("\n"), errors, warnings };
}

/**
 * Check a note right after the agent wrote or edited it. Returns undefined when the file is not
 * a vault note or has no problems; otherwise a report for the agent and the error count.
 */
export function checkWrittenNote(ws: Workspace, path: string, cwd: string): { report: string; errors: number } | undefined {
	const p = path.replace(/^@/, "");
	if (!p.toLowerCase().endsWith(".md")) return undefined;
	const vault = notesRoot(ws);
	const abs = isAbsolute(p) ? p : resolve(cwd, p);
	const rel = toPosix(relative(vault, abs));
	if (rel.startsWith("..") || rel.startsWith(".") || isAbsolute(rel) || !existsSync(abs)) return undefined;
	const issues = lintNote(readFileSync(abs, "utf8"), { index: buildVaultIndex(listVaultFiles(vault)) });
	if (issues.length === 0) return undefined;
	const errors = issues.filter((i) => i.severity === "error").length;
	const report = [
		`Note check — ${rel}: ${errors} error(s), ${issues.length - errors} warning(s).`,
		formatIssues(rel, issues.slice(0, 40)),
		errors ? "Fix every error now (Obsidian would render them wrong); fix warnings that are real mistakes." : "Fix the warnings that are real mistakes.",
	].join("\n");
	return { report, errors };
}
