import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContact, roleByName } from "../server/applicants.js";

test("an email or a 10-digit mobile is accepted", () => {
  assert.equal(normalizeContact("  Office@NK.com "), "office@nk.com");
  assert.equal(normalizeContact("9002102521"), "9002102521");
  assert.equal(normalizeContact("+91 90021 02521"), "9002102521");
  assert.equal(normalizeContact("12345"), "");
  assert.equal(normalizeContact("not-an-email"), "");
});

test("a security role asks for the gun licence", () => {
  assert.equal(roleByName("Gunman").gun, true);
  assert.equal(roleByName("Unskilled Worker").gun, false);
  assert.equal(roleByName("Cook"), null);
});
