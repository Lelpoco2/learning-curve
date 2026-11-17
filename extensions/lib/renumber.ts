/**
 * Topic folders numbered in syllabus order ("01 - Richiami di algebra"), like lessons.
 * Computes each topic's order from its home subject's syllabus, renames folders and index
 * notes when the number changes, and rewrites every reference: wikilinks/embeds in all notes,
 * quoted folder paths (Dataview FROM "…"), and paths stored in the state.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { safeName, topicFolder } from "./paths.ts";
import type { LcState, Topic } from "./types.ts";
import { listVaultFiles } from "./vault-files.ts";

export interface FolderMove {
	subject: string;
	from: string;
	to: string;
}

export interface RenumberResult {
	/** Folders renamed on disk. */
	moved: FolderMove[];
	/** Topics whose number changed without a folder on disk yet. */
	assigned: number;
	/** Renames skipped because the target already exists. */
	conflicts: FolderMove[];
	/** Notes whose links were updated. */
	filesUpdated: number;
}

/** Desired order of every topic homed in a subject: syllabus order first, then the others. */
export function desiredOrder(state: LcState, subject: string): Map<string, number> {
	const name = safeName(subject);
	const homed = Object.entries(state.topics).filter(([, t]) => t.subject === name);
	const syllabus = state.subjects[name]?.syllabus.map((i) => i.topicKey) ?? [];
	const inSyllabus = syllabus.filter((k) => homed.some(([key]) => key === k));
	const rest = homed
		.map(([key, t]) => ({ key, t }))
		.filter(({ key }) => !inSyllabus.includes(key))
		.sort((a, b) => (a.t.order ?? 999) - (b.t.order ?? 999) || a.t.topic.localeCompare(b.t.topic))
		.map(({ key }) => key);
	return new Map([...inSyllabus, ...rest].map((k, i) => [k, i + 1]));
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rewrite one wikilink target for the given folder moves (pure). */
export function rewriteTarget(target: string, moves: FolderMove[]): string {
	const segs = target.split("/");
	for (const m of moves) {
		if (segs.length >= 2 && segs[0] === m.subject && segs[1] === m.from) {
			segs[1] = m.to;
			if (segs.length === 3 && (segs[2] === m.from || segs[2] === `${m.from}.md`)) segs[2] = segs[2].replace(m.from, m.to);
			return segs.join("/");
		}
		if (segs.length === 1 && (target === m.from || target === `${m.from}.md`)) return target.replace(m.from, m.to);
	}
	return target;
}

/** Rewrite references in a note's text (pure). */
export function rewriteReferences(content: string, moves: FolderMove[]): string {
	// The target ends at ], | or # — excluding the backslash of an escaped table pipe (\|).
	let out = content.replace(/(!?\[\[)([^\]|#\n]*?)(?=\\?[\]|#])/g, (_m, open: string, target: string) => open + rewriteTarget(target, moves));
	for (const m of moves) {
		out = out.replace(new RegExp(`"${escapeRe(m.subject)}/${escapeRe(m.from)}(?=["/])`, "g"), `"${m.subject}/${m.to}`);
	}
	return out;
}

function rewriteStatePaths(state: LcState, moves: FolderMove[]): void {
	const fix = (p?: string) => {
		if (!p) return p;
		for (const m of moves) {
			const prefix = `${m.subject}/${m.from}/`;
			if (p.startsWith(prefix)) return `${m.subject}/${m.to}/${p.slice(prefix.length)}`;
		}
		return p;
	};
	for (const g of state.gaps) g.reinforcement = fix(g.reinforcement);
	for (const a of state.attempts) a.note = fix(a.note);
	for (const r of state.reviews) r.note = fix(r.note);
}

/** Topics that would change folder name (for the migration prompt). */
export function pendingRenames(state: LcState, vault: string, subjects?: string[]): FolderMove[] {
	const out: FolderMove[] = [];
	const names = subjects ?? [...new Set(Object.values(state.topics).map((t) => t.subject))];
	for (const subject of names) {
		for (const [key, order] of desiredOrder(state, subject)) {
			const t = state.topics[key];
			const from = topicFolder(t);
			const to = topicFolder({ topic: t.topic, order });
			if (from !== to && existsSync(join(vault, t.subject, from))) out.push({ subject: t.subject, from, to });
		}
	}
	return out;
}

/**
 * Number the topic folders of the given subjects (all when omitted) in syllabus order.
 * Mutates `state` (orders and stored paths) and the vault (folders, index notes, links).
 */
export function renumberTopics(state: LcState, vault: string, subjects?: string[]): RenumberResult {
	const result: RenumberResult = { moved: [], assigned: 0, conflicts: [], filesUpdated: 0 };
	const names = subjects?.map(safeName) ?? [...new Set(Object.values(state.topics).map((t) => t.subject))];
	for (const subject of names) {
		for (const [key, order] of desiredOrder(state, subject)) {
			const t: Topic | undefined = state.topics[key];
			if (!t || t.order === order) continue;
			const from = topicFolder(t);
			const to = topicFolder({ topic: t.topic, order });
			const fromDir = join(vault, t.subject, from);
			const toDir = join(vault, t.subject, to);
			if (from === to || !existsSync(fromDir)) {
				t.order = order;
				result.assigned++;
				continue;
			}
			if (existsSync(toDir)) {
				result.conflicts.push({ subject: t.subject, from, to });
				continue;
			}
			try {
				renameSync(fromDir, toDir);
			} catch {
				result.conflicts.push({ subject: t.subject, from, to });
				continue;
			}
			const oldIndex = join(toDir, `${from}.md`);
			const newIndex = join(toDir, `${to}.md`);
			if (existsSync(oldIndex) && !existsSync(newIndex)) renameSync(oldIndex, newIndex);
			t.order = order;
			result.moved.push({ subject: t.subject, from, to });
		}
	}
	if (result.moved.length) {
		for (const rel of listVaultFiles(vault)) {
			if (!rel.toLowerCase().endsWith(".md")) continue;
			const file = join(vault, rel);
			const before = readFileSync(file, "utf8");
			const after = rewriteReferences(before, result.moved);
			if (after !== before) {
				writeFileSync(file, after, "utf8");
				result.filesUpdated++;
			}
		}
		rewriteStatePaths(state, result.moved);
	}
	return result;
}
