import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, createReviewItem, dueItems, gradeFromResult, schedule } from "../extensions/lib/srs.ts";

test("addDays crosses month and year boundaries", () => {
	assert.equal(addDays("2026-01-31", 1), "2026-02-01");
	assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("new items are due the next day", () => {
	const item = createReviewItem("eigenvalue", { date: "2026-11-08" });
	assert.equal(item.due, "2026-11-09");
	assert.equal(item.reps, 0);
});

test("good reviews grow the interval: 1, 4, then × ease", () => {
	let item = createReviewItem("x", { date: "2026-11-08" });
	item = schedule(item, "good", "2026-11-09");
	assert.equal(item.interval, 1);
	item = schedule(item, "good", "2026-11-10");
	assert.equal(item.interval, 4);
	const ease = item.ease;
	item = schedule(item, "good", "2026-11-14");
	assert.equal(item.interval, Math.round(4 * ease));
	assert.equal(item.due, addDays("2026-11-14", item.interval));
});

test("again resets reps, counts a lapse and lowers ease (min 1.3)", () => {
	let item = createReviewItem("x", { date: "2026-11-08" });
	item = schedule(item, "good", "2026-11-09");
	item = schedule(item, "good", "2026-11-10");
	const before = item.ease;
	item = schedule(item, "again", "2026-11-14");
	assert.equal(item.reps, 0);
	assert.equal(item.lapses, 1);
	assert.equal(item.interval, 1);
	assert.ok(item.ease < before);
	for (let i = 0; i < 20; i++) item = schedule(item, "again", "2026-11-14");
	assert.equal(item.ease, 1.3);
});

test("easy gives a longer interval than good", () => {
	const base = schedule(schedule(createReviewItem("x"), "good"), "good");
	assert.ok(schedule(base, "easy").interval > schedule(base, "good").interval);
});

test("dueItems filters and sorts by due date", () => {
	const a = { ...createReviewItem("a"), due: "2026-11-01" };
	const b = { ...createReviewItem("b"), due: "2026-11-20" };
	const c = { ...createReviewItem("c"), due: "2026-10-01" };
	assert.deepEqual(
		dueItems([a, b, c], "2026-11-08").map((i) => i.concept),
		["c", "a"],
	);
});

test("gradeFromResult maps outcome and reasoning", () => {
	assert.equal(gradeFromResult("yes", "sound"), "good");
	assert.equal(gradeFromResult("yes", "flawed"), "again");
	assert.equal(gradeFromResult("yes", "missing"), "hard");
	assert.equal(gradeFromResult("partial"), "hard");
	assert.equal(gradeFromResult("no"), "again");
});
