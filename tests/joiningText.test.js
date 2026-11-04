import assert from "node:assert/strict";
import test from "node:test";
import { DECLARATION, TERMS } from "../server/data/joiningText.js";

test("the applicant is shown the printed declaration and terms", () => {
  assert.equal(DECLARATION.points.length, 19);
  assert.equal(TERMS.points.length, 27);
  assert.match(DECLARATION.points[0], /true and correct/);
  assert.match(TERMS.points[26], /refundable/);
});
