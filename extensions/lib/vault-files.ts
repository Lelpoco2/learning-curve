/** Listing the files of a vault (hidden folders such as .obsidian and .learning-curve excluded). */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { toPosix } from "./paths.ts";

function skipDir(name: string): boolean {
	return name.startsWith(".") || name === "node_modules";
}

/** Every file of the vault, vault-relative with forward slashes. */
export function listVaultFiles(vault: string): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (e.isDirectory()) {
				if (!skipDir(e.name)) walk(join(dir, e.name));
			} else out.push(toPosix(relative(vault, join(dir, e.name))));
		}
	};
	if (existsSync(vault)) walk(vault);
	return out;
}
