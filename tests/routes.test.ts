import assert from "node:assert/strict";
import { test } from "node:test";
import { routeInput } from "../extensions/commands.ts";

test("routeInput rewrites learning commands into skill commands", () => {
	assert.equal(routeInput("/learn Linear Algebra"), "/skill:learn-topic Topic: Linear Algebra");
	assert.equal(routeInput("/learn"), "/skill:learn-topic");
	assert.equal(routeInput("/lesson"), "/skill:lesson-writing next");
	assert.equal(routeInput("/lesson 3"), "/skill:lesson-writing Lesson: 3");
	assert.equal(routeInput("/review"), "/skill:spaced-review");
	assert.equal(routeInput("/new-subject Calculus 1"), "/skill:subject-plan New subject: Calculus 1");
	assert.equal(routeInput("/new-subject"), "/skill:subject-plan");
	assert.equal(routeInput("/exam"), "/skill:quiz-and-exercises Final exam of the active subject");
	assert.equal(routeInput("/remember derivata di tan x"), "/skill:memory-aids Give me tips to remember: derivata di tan x");
	assert.equal(routeInput("/remember"), "/skill:memory-aids Give me tips to remember the key results of the current lesson");
	assert.equal(routeInput("/exam Physics 1"), "/skill:quiz-and-exercises Final exam of subject: Physics 1");
	assert.equal(routeInput("/grade Math/Quizzes/Quiz - L1 - 1.md"), "/skill:quiz-and-exercises Grade the answers written in note: Math/Quizzes/Quiz - L1 - 1.md");
});

test("routeInput ignores other input", () => {
	assert.equal(routeInput("/plan something"), undefined);
	assert.equal(routeInput("/learning"), undefined);
	assert.equal(routeInput("learn calculus"), undefined);
	assert.equal(routeInput("/skill:learn-topic x"), undefined);
});
