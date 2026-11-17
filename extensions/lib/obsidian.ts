/** Obsidian vault helpers: plugin installation from GitHub releases. */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeEnabledPlugins, type PluginInfo } from "./plugins.ts";

export interface InstallResult {
	id: string;
	name: string;
	ok: boolean;
	version?: string;
	error?: string;
}

const RELEASE = (repo: string, file: string) => `https://github.com/${repo}/releases/latest/download/${file}`;

async function download(url: string, signal?: AbortSignal): Promise<Buffer | undefined> {
	const res = await fetch(url, { redirect: "follow", signal });
	if (res.status === 404) return undefined;
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return Buffer.from(await res.arrayBuffer());
}

export function isObsidianVault(dir: string): boolean {
	return existsSync(join(dir, ".obsidian"));
}

/** Download main.js, manifest.json and styles.css (optional) of the latest release into the vault. */
export async function installPlugin(vault: string, plugin: PluginInfo, signal?: AbortSignal): Promise<InstallResult> {
	try {
		const manifestBuf = await download(RELEASE(plugin.repo, "manifest.json"), signal);
		const mainBuf = await download(RELEASE(plugin.repo, "main.js"), signal);
		if (!manifestBuf || !mainBuf) throw new Error("release assets main.js/manifest.json not found");
		const manifest = JSON.parse(manifestBuf.toString("utf8")) as { id?: string; version?: string };
		const id = manifest.id ?? plugin.id;
		const dir = join(vault, ".obsidian", "plugins", id);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "manifest.json"), manifestBuf);
		writeFileSync(join(dir, "main.js"), mainBuf);
		const styles = await download(RELEASE(plugin.repo, "styles.css"), signal);
		if (styles) writeFileSync(join(dir, "styles.css"), styles);
		return { id, name: plugin.name, ok: true, version: manifest.version };
	} catch (error) {
		return { id: plugin.id, name: plugin.name, ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Mark plugins as enabled in `.obsidian/community-plugins.json`. */
export function enablePlugins(vault: string, ids: string[]): void {
	const file = join(vault, ".obsidian", "community-plugins.json");
	mkdirSync(join(vault, ".obsidian"), { recursive: true });
	const existing = existsSync(file) ? readFileSync(file, "utf8") : undefined;
	writeFileSync(file, mergeEnabledPlugins(existing, ids), "utf8");
}

export interface InstalledPlugin {
	id: string;
	name: string;
	version?: string;
	enabled: boolean;
}

function enabledFile(vault: string): string {
	return join(vault, ".obsidian", "community-plugins.json");
}

/** Ids listed in `.obsidian/community-plugins.json`. */
export function readEnabledPlugins(vault: string): string[] {
	try {
		const parsed = JSON.parse(readFileSync(enabledFile(vault), "utf8"));
		return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
	} catch {
		return [];
	}
}

/** Community plugins present in `.obsidian/plugins/` (with a valid manifest), sorted by name. */
export function listInstalledPlugins(vault: string): InstalledPlugin[] {
	const dir = join(vault, ".obsidian", "plugins");
	if (!existsSync(dir)) return [];
	const enabled = new Set(readEnabledPlugins(vault));
	const out: InstalledPlugin[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		try {
			const manifest = JSON.parse(readFileSync(join(dir, entry.name, "manifest.json"), "utf8")) as { id?: string; name?: string; version?: string };
			const id = manifest.id ?? entry.name;
			out.push({ id, name: manifest.name ?? id, version: manifest.version, enabled: enabled.has(id) });
		} catch {
			// Not a plugin folder (no/invalid manifest).
		}
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Remove ids from the enabled list; files and settings stay (re-enable from Obsidian). */
export function disablePlugins(vault: string, ids: string[]): void {
	if (!existsSync(enabledFile(vault))) return;
	const remaining = readEnabledPlugins(vault).filter((id) => !ids.includes(id));
	writeFileSync(enabledFile(vault), `${JSON.stringify(remaining, null, 2)}\n`, "utf8");
}

/** Disable and delete plugin folders (settings included). */
export function removePlugins(vault: string, ids: string[]): void {
	disablePlugins(vault, ids);
	for (const id of ids) {
		if (!/^[A-Za-z0-9._-]+$/.test(id)) continue; // never build odd paths from ids
		rmSync(join(vault, ".obsidian", "plugins", id), { recursive: true, force: true });
	}
}

/** Write plugin settings only when the plugin has none yet (never overwrite user settings). */
export function seedPluginData(vault: string, id: string, data: unknown): boolean {
	const file = join(vault, ".obsidian", "plugins", id, "data.json");
	if (existsSync(file)) return false;
	mkdirSync(join(vault, ".obsidian", "plugins", id), { recursive: true });
	writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	return true;
}

/** Ensure the vault exists as an Obsidian vault (creates `.obsidian/` if missing). */
export function ensureVault(vault: string): void {
	mkdirSync(join(vault, ".obsidian"), { recursive: true });
}
