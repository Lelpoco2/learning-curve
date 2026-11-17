import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { checklist } from "../extensions/ui/checklist.ts";

type Component = { render(w: number): string[]; handleInput(d: string): void };

function fakeCtx(keys: string[], width: number, seen: string[][]) {
	const theme = { fg: (_c: string, s: string) => s, bold: (s: string) => s };
	return {
		mode: "tui",
		ui: {
			custom: <T>(factory: (tui: unknown, theme: unknown, kb: unknown, done: (v: T) => void) => Component) =>
				new Promise<T>((resolve) => {
					const c = factory({ requestRender() {} }, theme, {}, resolve);
					seen.push(c.render(width));
					for (const k of keys) {
						c.handleInput(k);
						seen.push(c.render(width));
					}
				}),
		},
	} as never;
}

const items = [
	{ id: "a", label: "Latex Suite", description: "Type LaTeX fast: snippets, auto-fractions, matrix shortcuts, inline preview.", group: "math", checked: true },
	{ id: "b", label: "Desmos", description: "Interactive function graphs embedded in notes.", group: "graphs", checked: false },
	{ id: "c", label: "Dataview", group: "learning", checked: true },
];

test("checklist toggles with space and confirms with enter", async () => {
	const seen: string[][] = [];
	// down, space (check b), down, space (uncheck c), enter
	const result = await checklist(fakeCtx(["\x1b[B", " ", "\x1b[B", " ", "\r"], 60, seen), "Plugins", items);
	assert.deepEqual(result, ["a", "b"]);
});

test("checklist escape cancels; 'n' clears everything", async () => {
	assert.equal(await checklist(fakeCtx(["\x1b"], 60, []), "Plugins", items), undefined);
	assert.deepEqual(await checklist(fakeCtx(["n", "\r"], 60, []), "Plugins", items), []);
});

test("checklist lines never exceed the width", async () => {
	const seen: string[][] = [];
	await checklist(fakeCtx(["\r"], 24, seen), "Obsidian plugins to install (recommended ones are preselected)", items);
	for (const frame of seen) for (const line of frame) assert.ok(visibleWidth(line) <= 24, `too wide: "${line}"`);
});
