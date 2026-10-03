const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../schedule-core.js");

test("activeIn supports all, odd and even weeks", () => {
  assert.equal(core.activeIn({ weeks: [1, 10], parity: "all" }, 6), true);
  assert.equal(core.activeIn({ weeks: [1, 10], parity: "odd" }, 5), true);
  assert.equal(core.activeIn({ weeks: [1, 10], parity: "odd" }, 6), false);
  assert.equal(core.activeIn({ weeks: [1, 10], parity: "even" }, 6), true);
  assert.equal(core.activeIn({ weeks: [2, 4], parity: "all" }, 5), false);
});

test("sessionsOverlap detects shared day and section range", () => {
  const a = { day: 1, from: 1, to: 2 };
  const b = { day: 1, from: 2, to: 3 };
  const c = { day: 2, from: 1, to: 2 };
  assert.equal(core.sessionsOverlap(a, b), true);
  assert.equal(core.sessionsOverlap(a, c), false);
});

test("findConflicts ignores weeks that never overlap", () => {
  const sessions = [
    { id: "a", courseId: "c1", day: 1, from: 1, to: 2, weeks: [1, 3], parity: "all" },
    { id: "b", courseId: "c2", day: 1, from: 2, to: 3, weeks: [4, 6], parity: "all" },
    { id: "c", courseId: "c3", day: 1, from: 2, to: 2, weeks: [2, 2], parity: "all" }
  ];
  const conflicts = core.findConflicts(sessions);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].a.id, "a");
  assert.equal(conflicts[0].b.id, "c");
  assert.equal(conflicts[0].week, 2);
});

test("findConflicts respects odd and even parity", () => {
  const odd = { id: "odd", courseId: "c1", day: 2, from: 1, to: 2, weeks: [1, 8], parity: "odd" };
  const even = { id: "even", courseId: "c2", day: 2, from: 1, to: 2, weeks: [1, 8], parity: "even" };
  assert.equal(core.findConflicts([odd, even]).length, 0);
});

