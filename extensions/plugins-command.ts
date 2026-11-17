/**
 * /learn-plugins — manage Obsidian plugins of the workspace vault after setup:
 * install from the recommended list or from the whole community catalog, update,
 * disable, remove. Keeps config.plugins in sync so the tutor knows what it can use.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { loadCatalog } from "./lib/community.ts";
import { disablePlugins, enablePlugins, ensureVault, installPlugin, type InstallResult, isObsidianVault, listInstalledPlugins, removePlugins } from "./lib/obsidian.ts";
import { formatDownloads, PLUGIN_CATALOG, type PluginInfo, searchCatalog, toPluginInfo } from "./lib/plugins.ts";
import { notesRoot, saveConfig, type Workspace } from "./lib/workspace.ts";
import { getWorkspace, setWorkspaceFromCwd } from "./runtime.ts";
import { seedPluginSettings, syncPluginConfig } from "./lib/setup.ts";

export { syncPluginConfig };
import { checklist } from "./ui/checklist.ts";

const MENU = {
	recommended: "➕ Install from the recommended list",
	search: "🔎 Search all community plugins",
	update: "⟳ Update installed plugins",
	disable: "⏸ Disable plugins (keep files and settings)",
	remove: "🗑 Remove plugins",
	show: "📋 Show installed plugins",
	done: "✓ Done",
} as const;


async function install(ctx: ExtensionCommandContext, ws: Workspace, infos: PluginInfo[], report: string[]): Promise<void> {
	const vault = notesRoot(ws);
	const results: InstallResult[] = [];
	for (const [i, info] of infos.entries()) {
		ctx.ui.setWidget("lc-plugins", [`Obsidian plugins`, `… downloading ${info.name} (${i + 1}/${infos.length})`]);
		results.push(await installPlugin(vault, info));
	}
	ctx.ui.setWidget("lc-plugins", undefined);
	const ok = results.filter((r) => r.ok);
	enablePlugins(vault, ok.map((r) => r.id));
	seedPluginSettings(vault, ws.config, ok.map((r) => r.id));
	for (const r of results) report.push(r.ok ? `✓ ${r.name} ${r.version ?? ""}`.trim() : `✗ ${r.name}: ${r.error}`);
}

export function registerPluginsCommand(pi: ExtensionAPI): void {
	pi.registerEntryRenderer("lc-plugins-report", (entry, _opts, theme) => {
		const data = entry.data as { lines: string[] };
		return new Text(`${theme.fg("accent", theme.bold("Obsidian plugins"))}\n${data.lines.join("\n")}`, 1, 0);
	});

	pi.registerCommand("learn-plugins", {
		description: "Learning Curve: install, update, disable or remove Obsidian plugins in the vault",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/learn-plugins needs the interactive UI.", "error");
				return;
			}
			const ws = getWorkspace() ?? setWorkspaceFromCwd(ctx.cwd);
			if (!ws) {
				ctx.ui.notify("Not inside a learning workspace. Run /learn-setup first.", "warning");
				return;
			}
			if (ws.config.app.id !== "obsidian") {
				ctx.ui.notify(`This workspace uses ${ws.config.app.name}: plugin management is for Obsidian vaults.`, "warning");
				return;
			}
			const vault = notesRoot(ws);
			if (!isObsidianVault(vault)) {
				if (!(await ctx.ui.confirm("No .obsidian folder", `Create the Obsidian configuration folder in ${vault}?`))) return;
				ensureVault(vault);
			}

			const report: string[] = [];
			let changed = false;
			try {
				for (;;) {
					const installed = listInstalledPlugins(vault);
					const enabledCount = installed.filter((p) => p.enabled).length;
					const choice = await ctx.ui.select(`Obsidian plugins — ${installed.length} installed, ${enabledCount} enabled`, Object.values(MENU));
					if (!choice || choice === MENU.done) break;
					const installedIds = new Set(installed.map((p) => p.id));

					if (choice === MENU.show) {
						report.push(
							...(installed.length
								? installed.map((p) => `${p.enabled ? "●" : "○"} ${p.name} ${p.version ?? ""} (${p.id})${p.enabled ? "" : " — disabled"}`)
								: ["No community plugins installed."]),
						);
						pi.appendEntry("lc-plugins-report", { lines: report.splice(0) });
						continue;
					}

					if (choice === MENU.recommended) {
						const missing = PLUGIN_CATALOG.filter((p) => !installedIds.has(p.id));
						if (missing.length === 0) {
							ctx.ui.notify("Every plugin of the recommended list is already installed.", "info");
							continue;
						}
						const picked = await checklist(
							ctx,
							"Recommended plugins not installed yet",
							missing.map((p) => ({ id: p.id, label: p.name, description: p.why, group: p.category, checked: p.recommended })),
						);
						if (!picked?.length) continue;
						await install(ctx, ws, missing.filter((p) => picked.includes(p.id)), report);
						changed = true;
						continue;
					}

					if (choice === MENU.search) {
						const query = await ctx.ui.input("Search community plugins (name, id or keywords)", "e.g. mathlive, chemistry, pdf");
						if (!query?.trim()) continue;
						ctx.ui.setWidget("lc-plugins", ["Obsidian plugins", "… loading the community catalog"]);
						const catalog = await loadCatalog(ws.dataDir);
						ctx.ui.setWidget("lc-plugins", undefined);
						const hits = searchCatalog(catalog.plugins, catalog.stats, query);
						if (hits.length === 0) {
							ctx.ui.notify(`No community plugin matches "${query}".`, "warning");
							continue;
						}
						const picked = await checklist(
							ctx,
							`Results for "${query}" (most downloaded first)`,
							hits.map((h) => ({
								id: h.id,
								label: `${h.name} · ${formatDownloads(h.downloads)} downloads${installedIds.has(h.id) ? " · installed" : ""}`,
								description: `${h.description}${h.author ? ` — by ${h.author}` : ""} (${h.id})`,
								checked: false,
							})),
						);
						if (!picked?.length) continue;
						await install(ctx, ws, hits.filter((h) => picked.includes(h.id)).map(toPluginInfo), report);
						changed = true;
						continue;
					}

					if (choice === MENU.update) {
						if (installed.length === 0) {
							ctx.ui.notify("No plugins installed.", "info");
							continue;
						}
						const picked = await checklist(
							ctx,
							"Update to the latest release",
							installed.map((p) => ({ id: p.id, label: `${p.name} ${p.version ?? ""}`.trim(), checked: true })),
						);
						if (!picked?.length) continue;
						ctx.ui.setWidget("lc-plugins", ["Obsidian plugins", "… loading the community catalog"]);
						const catalog = await loadCatalog(ws.dataDir);
						const infos: PluginInfo[] = [];
						for (const id of picked) {
							const entry = catalog.plugins.find((p) => p.id === id);
							if (entry) infos.push(toPluginInfo(entry));
							else report.push(`– ${id}: not in the community catalog (installed manually or via BRAT), skipped`);
						}
						await install(ctx, ws, infos, report);
						changed = true;
						continue;
					}

					if (choice === MENU.disable) {
						const enabled = installed.filter((p) => p.enabled);
						if (enabled.length === 0) {
							ctx.ui.notify("No enabled plugins.", "info");
							continue;
						}
						const picked = await checklist(ctx, "Disable (files and settings are kept)", enabled.map((p) => ({ id: p.id, label: p.name, checked: false })));
						if (!picked?.length) continue;
						disablePlugins(vault, picked);
						report.push(...picked.map((id) => `⏸ disabled ${installed.find((p) => p.id === id)?.name ?? id}`));
						changed = true;
						continue;
					}

					if (choice === MENU.remove) {
						if (installed.length === 0) {
							ctx.ui.notify("No plugins installed.", "info");
							continue;
						}
						const picked = await checklist(ctx, "Remove (deletes the plugin and its settings)", installed.map((p) => ({ id: p.id, label: p.name, checked: false })));
						if (!picked?.length) continue;
						const names = picked.map((id) => installed.find((p) => p.id === id)?.name ?? id);
						if (!(await ctx.ui.confirm("Remove plugins?", `Delete ${names.join(", ")} including their settings?`))) continue;
						removePlugins(vault, picked);
						report.push(...names.map((n) => `🗑 removed ${n}`));
						changed = true;
					}
				}
			} catch (error) {
				ctx.ui.setWidget("lc-plugins", undefined);
				ctx.ui.notify(`Plugin management failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			}

			syncPluginConfig(ws);
			if (changed) {
				report.push("→ Reload Obsidian to apply (Ctrl/Cmd+P → “Reload app without saving”, or restart it). Restricted mode must be off.");
				pi.appendEntry("lc-plugins-report", { lines: report });
			}
		},
	});
}
