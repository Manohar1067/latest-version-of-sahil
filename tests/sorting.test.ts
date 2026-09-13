/**
 * Unit tests for memo-number ordering (numeric-suffix, strict descending).
 * Run with: node --experimental-strip-types tests/sorting.test.ts
 */
import assert from "node:assert/strict";
import { compareMemoNumberDesc, memoNumberValue } from "../src/lib/format.ts";

// --- numeric suffix extraction ----------------------------------------------
assert.equal(memoNumberValue("SRL-2026-000014"), 14);
assert.equal(memoNumberValue("SRL-2026-000001"), 1);
assert.equal(memoNumberValue("SRL-2026-000010"), 10);
assert.equal(Number.isNaN(memoNumberValue("Not A Memo")), true);
assert.equal(Number.isNaN(memoNumberValue(null)), true);

// --- the requirement's exact example ----------------------------------------
// input: 000003 000014 000007 000012  => display: 000014 000012 000007 000003
const example = ["SRL-2026-000003", "SRL-2026-000014", "SRL-2026-000007", "SRL-2026-000012"];
const expected = ["SRL-2026-000014", "SRL-2026-000012", "SRL-2026-000007", "SRL-2026-000003"];
assert.deepEqual([...example].sort(compareMemoNumberDesc), expected, "numeric-suffix descending");

// --- strict descending full sequence ----------------------------------------
const all = [
  "SRL-2026-000014", "SRL-2026-000013", "SRL-2026-000012", "SRL-2026-000011",
  "SRL-2026-000010", "SRL-2026-000009", "SRL-2026-000008", "SRL-2026-000007",
  "SRL-2026-000006", "SRL-2026-000005", "SRL-2026-000004", "SRL-2026-000003",
  "SRL-2026-000002", "SRL-2026-000001",
];
const shuffled = [...all].sort(() => Math.random() - 0.5);
const sorted = [...shuffled].sort(compareMemoNumberDesc);
for (let i = 0; i < sorted.length; i++) {
  assert.equal(memoNumberValue(sorted[i]), all.length - i, `position ${i}: ${sorted[i]}`);
}

// --- lexicographic pitfall: "000010" must come BEFORE "000003" ---------------
// Plain string sort would put 000003 before 000010; numeric sort must not.
assert.deepEqual(
  ["SRL-2026-000003", "SRL-2026-000010"].sort(compareMemoNumberDesc),
  ["SRL-2026-000010", "SRL-2026-000003"],
);

// --- non-conforming numbers fall to the bottom (any stable order among them) --
const mixed = ["CUSTOM", "SRL-2026-000014", "X-2", "SRL-2026-000010"];
const mixedSorted = [...mixed].sort(compareMemoNumberDesc);
assert.deepEqual(mixedSorted.slice(0, 2), ["SRL-2026-000014", "SRL-2026-000010"], "numeric rows first");
assert.deepEqual(
  [...mixedSorted.slice(2)].sort(),
  ["CUSTOM", "X-2"].sort(),
  "non-conforming rows last (any stable order)",
);

// --- same numeric suffix tie-break is deterministic --------------------------
const tieA = "SRL-2026-000001";
const tieB = "SRL-2025-000001";
const t1 = Math.sign(compareMemoNumberDesc(tieA, tieB));
const t2 = Math.sign(compareMemoNumberDesc(tieA, tieB));
assert.equal(t1, t2, "tie-break is deterministic");

// --- filter-then-sort pipeline (filter is applied BEFORE sorting) ------------
// Simulate: keep only entries whose suffix is even, then sort descending.
const filtered = example.filter((n) => memoNumberValue(n) % 2 === 0);
const filteredSorted = [...filtered].sort(compareMemoNumberDesc);
assert.deepEqual(filteredSorted, ["SRL-2026-000014", "SRL-2026-000012"], "even-only filter, then numeric desc");

console.log("sorting tests: all passed");