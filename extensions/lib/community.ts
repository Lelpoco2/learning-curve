/** Official Obsidian community plugin catalog, fetched from GitHub and cached in the workspace. */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CommunityPlugin } from "./plugins.ts";

const BASE = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master";
const TTL_MS = 24 * 60 * 60 * 1000;

export interface Catalog {
	plugins: CommunityPlugin[];
	stats: Record<string, { downloads?: number }>;
}

async function cachedJson<T>(cacheDir: string, name: string, signal?: AbortSignal): Promise<T> {
	const file = join(cacheDir, name);
	const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < TTL_MS;
	if (!fresh) {
		try {
			const res = await fetch(`${BASE}/${name}`, { signal });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const text = await res.text();
			JSON.parse(text); // validate before caching
			mkdirSync(cacheDir, { recursive: true });
			writeFileSync(file, text, "utf8");
		} catch (error) {
			// Offline or GitHub down: fall back to a stale cache if there is one.
			if (!existsSync(file)) throw new Error(`Cannot download ${name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return JSON.parse(readFileSync(file, "utf8")) as T;
}

export async function loadCatalog(dataDir: string, signal?: AbortSignal): Promise<Catalog> {
	const cacheDir = join(dataDir, "cache");
	const [plugins, stats] = await Promise.all([
		cachedJson<CommunityPlugin[]>(cacheDir, "community-plugins.json", signal),
		cachedJson<Record<string, { downloads?: number }>>(cacheDir, "community-plugin-stats.json", signal),
	]);
	return { plugins, stats };
}
