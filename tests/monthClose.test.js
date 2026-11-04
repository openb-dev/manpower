import assert from "node:assert/strict";
import test, { after } from "node:test";
import pool from "../server/db.js";
import { attendanceDays, closeMonth, closeSourceRef } from "../server/monthClose.js";

after(async () => {
  await pool.end();
});

test("August keeps its ledger reference", () => {
  assert.equal(closeSourceRef("2026-08"), "AUG-2026");
  assert.equal(closeSourceRef("2026-10"), "PAY-2026-10");
});

test("attendance days prefer the actual sheet and count marks", () => {
  const found = attendanceDays([
    { sheetName: "Attendance Sheet(Adj)", totalDays: 26, marks: {} },
    { sheetName: "Attendance Sheet(Actual)", totalDays: null, marks: { 1: "P", 2: "L", 3: "1/2", 4: "-" } },
  ]);
  assert.equal(found.days, 1.5);
  assert.equal(found.sheetName, "Attendance Sheet(Actual)");
});

test("closing a new month stores payment done and leaves August", async () => {
  const [people] = await pool.query("SELECT id FROM employees ORDER BY id LIMIT 1");
  const id = people[0].id;
  await pool.query("DELETE FROM payroll_lines WHERE employee_id = ? AND month_key = '2099-01'", [id]);
  await pool.query("DELETE FROM payroll_close WHERE month_key = '2099-01'");
  await pool.query("DELETE FROM ledger_entries WHERE source_ref = 'PAY-2099-01'");
  const [before] = await pool.query(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM payroll_close WHERE month_key = '2026-08'",
  );
  await pool.query(
    "INSERT INTO payroll_lines (employee_id, month_key, attendance, payment_done) VALUES (?, '2099-01', 10, 1000)",
    [id],
  );
  const result = await closeMonth(pool, "2099-01");
  assert.equal(result.amount, 1000);
  assert.equal(result.kept, false);
  const [afterClose] = await pool.query(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM payroll_close WHERE month_key = '2026-08'",
  );
  assert.equal(Number(afterClose[0].n), Number(before[0].n));
  assert.equal(Number(afterClose[0].total), Number(before[0].total));
  const kept = await closeMonth(pool, "2026-08");
  assert.equal(kept.kept, true);
  assert.equal(kept.amount, Number(before[0].total));
  const [ledger] = await pool.query("SELECT amount FROM ledger_entries WHERE source_ref = 'AUG-2026'");
  assert.equal(Number(ledger[0].amount), Number(before[0].total));
  const [opened] = await pool.query("SELECT amount FROM ledger_entries WHERE source_ref = 'PAY-2099-01'");
  assert.equal(Number(opened[0].amount), 1000);
  await pool.query("DELETE FROM payroll_lines WHERE employee_id = ? AND month_key = '2099-01'", [id]);
  await pool.query("DELETE FROM payroll_close WHERE month_key = '2099-01'");
  await pool.query("DELETE FROM ledger_entries WHERE source_ref = 'PAY-2099-01'");
});
