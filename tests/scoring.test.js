import { test } from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/scoring.js";
const perfect = { scenery: 5, cleanliness: 5, access: 5, facilities: 5 };
test("empty and sparse reviews cannot enter ranking", () => {
  assert.equal(score([]).average, null);
  assert.equal(score([perfect]).rank, null);
});
test("five reviews are eligible and corrected towards neutral prior", () => {
  assert.deepEqual(score(Array(5).fill(perfect)), {
    count: 5,
    average: 5,
    rank: 4.25,
  });
});
test("invalid scores never affect ranking", () => {
  assert.equal(score([{ ...perfect, access: 8 }]).count, 0);
});
test("weighted composite and independent dimensions differ", () => {
  const rows = Array(5).fill({ ...perfect, scenery: 1 });
  assert.equal(score(rows).average, 3.4);
  assert.equal(score(rows, "cleanliness").average, 5);
});
