/** Multi-select checklist (TUI). Falls back to one confirm per item without a TUI. */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

export interface ChecklistItem {
	id: string;
	label: string;
	description?: string;
	group?: string;
	checked: boolean;
}

/** Returns the selected ids, or undefined when cancelled. */
export async function checklist(ctx: ExtensionContext, title: string, items: ChecklistItem[]): Promise<string[] | undefined> {
	if (ctx.mode !== "tui") {
		const selected: string[] = [];
		for (const item of items) {
			if (await ctx.ui.confirm(`${title}: ${item.label}?`, item.description ?? "")) selected.push(item.id);
		}
		return selected;
	}

	const state = items.map((i) => ({ ...i }));
	return ctx.ui.custom<string[] | undefined>((tui, theme, _kb, done) => {
		let cursor = 0;
		let cache: string[] | undefined;
		const refresh = () => {
			cache = undefined;
			tui.requestRender();
		};
		return {
			render(width: number): string[] {
				if (cache) return cache;
				const w = Math.max(20, width);
				const lines: string[] = [theme.fg("accent", "─".repeat(w)), ...wrapTextWithAnsi(` ${theme.bold(title)}`, w), ""];
				let group: string | undefined;
				state.forEach((item, i) => {
					if (item.group && item.group !== group) {
						group = item.group;
						lines.push(truncateToWidth(` ${theme.fg("muted", group.toUpperCase())}`, w));
					}
					const box = item.checked ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
					const pointer = i === cursor ? theme.fg("accent", "›") : " ";
					const label = i === cursor ? theme.fg("accent", item.label) : item.label;
					lines.push(truncateToWidth(` ${pointer} ${box} ${label}`, w));
					if (i === cursor && item.description) {
						for (const l of wrapTextWithAnsi(theme.fg("muted", item.description), w - 8)) lines.push(`        ${l}`);
					}
				});
				const count = state.filter((s) => s.checked).length;
				lines.push("", ...wrapTextWithAnsi(` ${theme.fg("dim", `↑↓ move · Space toggle · a all · n none · Enter confirm (${count} selected) · Esc cancel`)}`, w));
				lines.push(theme.fg("accent", "─".repeat(w)));
				cache = lines;
				return lines;
			},
			handleInput(data: string) {
				if (matchesKey(data, Key.up)) cursor = (cursor - 1 + state.length) % state.length;
				else if (matchesKey(data, Key.down)) cursor = (cursor + 1) % state.length;
				else if (matchesKey(data, Key.space)) state[cursor].checked = !state[cursor].checked;
				else if (data === "a") state.forEach((s) => (s.checked = true));
				else if (data === "n") state.forEach((s) => (s.checked = false));
				else if (matchesKey(data, Key.enter)) return done(state.filter((s) => s.checked).map((s) => s.id));
				else if (matchesKey(data, Key.escape)) return done(undefined);
				else return;
				refresh();
			},
			invalidate() {
				cache = undefined;
			},
		};
	});
}
