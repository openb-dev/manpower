import assert from "node:assert/strict";
import test from "node:test";
import { accessFor, moduleAllows } from "../server/core/access.js";
import { decryptText, encryptText, last4 } from "../server/core/secrets.js";

test("super admin opens every module", () => {
  const access = accessFor("super_admin");
  assert.deepEqual(access.modules, ["hrm", "crm", "accounts", "finance", "procurement", "masters"]);
  assert.equal(access.canWrite, true);
});

test("admin opens all company modules", () => {
  assert.deepEqual(accessFor("admin").modules, ["hrm", "crm", "accounts", "finance", "procurement", "masters"]);
  assert.equal(accessFor("admin").canWrite, true);
});

test("admin and hr can access and write to applicants", () => {
  assert.equal(moduleAllows("/api/applicants", "GET", accessFor("admin").modules), true);
  assert.equal(moduleAllows("/api/applicants", "POST", accessFor("admin").modules), true);
  assert.equal(moduleAllows("/api/applicants", "GET", accessFor("hr").modules), true);
  assert.equal(moduleAllows("/api/applicants", "POST", accessFor("hr").modules), true);
  assert.equal(accessFor("admin").canWrite, true);
  assert.equal(accessFor("super_admin").canWrite, true);
});

test("accounts opens accounts and finance", () => {
  assert.deepEqual(accessFor("accounts").modules, ["accounts", "finance"]);
});

test("hr opens only hrm", () => {
  assert.deepEqual(accessFor("hr").modules, ["hrm"]);
});

test("aadhaar is stored encrypted and shown by the last four digits", () => {
  process.env.APP_DATA_KEY = process.env.APP_DATA_KEY || "test-key-for-round-trip";
  assert.equal(decryptText(encryptText("123412341234")), "123412341234");
  assert.equal(last4("123412341234"), "1234");
});

test("viewer can read and cannot write", () => {
  const access = accessFor("viewer");
  assert.equal(access.canWrite, false);
  assert.ok(access.modules.includes("hrm"));
  assert.equal(access.modules.includes("masters"), false);
});

test("hr cannot open purchases and crm can read sites", () => {
  assert.equal(moduleAllows("/api/purchases", "GET", ["hrm"]), false);
  assert.equal(moduleAllows("/api/invoices", "GET", ["accounts", "finance"]), true);
  assert.equal(moduleAllows("/api/sites", "GET", ["crm"]), true);
  assert.equal(moduleAllows("/api/sites", "POST", ["crm"]), false);
});

test("session and logout routes are open to any authenticated user", () => {
  assert.equal(moduleAllows("/api/session", "GET", []), true);
  assert.equal(moduleAllows("/api/logout", "POST", []), true);
});
