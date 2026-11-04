import assert from "node:assert/strict";
import test, { after } from "node:test";
import pool from "../server/db.js";
import { migrate } from "../server/data/migrate.js";

const REQUIRED = [
  "company",
  "users",
  "role",
  "user_role",
  "session",
  "audit_log",
  "site",
  "designation",
  "wage_rate",
  "vendor",
  "employee_wage",
  "work_register",
  "deployment",
  "payroll_line",
  "licence",
];

after(async () => {
  await pool.end();
});

test("phase 1 tables exist", async () => {
  await migrate(pool);
  const [rows] = await pool.query("SHOW TABLES");
  const names = rows.map((row) => Object.values(row)[0]);
  for (const table of REQUIRED) {
    assert.ok(names.includes(table), `${table} is missing`);
  }
  const [company] = await pool.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'company_id'");
  assert.equal(Number(company[0].n), 1);
});
