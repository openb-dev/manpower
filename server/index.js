import express from "express";
import pool from "./db.js";
import { registerOffice } from "./office.js";
import { registerAuth, requireAuth } from "./auth.js";
import { migrate } from "./data/migrate.js";
import { documentPath, loadApplication, saveApplication } from "./data/application.js";
import { personError } from "./data/required.js";
import { importNsg } from "./data/nsgImport.js";
import { renderAttendance } from "./attendanceExport.js";
import { monthKey, monthRange } from "./months.js";
import { attendanceDays, closeMonth } from "./monthClose.js";
import { registerMasters } from "./masters.js";
import { registerDeployment } from "./deployment.js";
import { registerFinish } from "./finish.js";
import { registerApplicants } from "./applicants.js";
import { companyIdFrom } from "./companyScope.js";
import { readFile } from "node:fs/promises";

await pool.query(`
  CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    salary DECIMAL(12,2) NOT NULL,
    divisor DECIMAL(8,2) NOT NULL DEFAULT 26
  )
`);

const [existing] = await pool.query("SELECT COUNT(*) AS n FROM employees");
if (Number(existing[0].n) === 0) {
  const seed = [
    ["Pritam Gantait", 14000],
    ["Bhabesh Das", 13500],
    ["Ranjit Prodhan", 13500],
    ["Sukhen Mondal", 15500],
    ["Sushanta Das", 19000],
  ];
  for (const [name, salary] of seed) {
    await pool.query("INSERT INTO employees (name, salary, divisor) VALUES (?, ?, 26)", [name, salary]);
  }
}

await pool.query("ALTER TABLE employees MODIFY salary DECIMAL(12,2) NULL");

for (const [column, definition] of [
  ["trade", "trade VARCHAR(255) NULL"],
  ["skill", "skill VARCHAR(40) NULL"],
  ["advance", "advance DECIMAL(12,2) NOT NULL DEFAULT 0"],
  ["attendance", "attendance DECIMAL(8,2) NULL"],
  ["deduct", "deduct DECIMAL(12,2) NOT NULL DEFAULT 0"],
  ["payment_done", "payment_done DECIMAL(12,2) NULL"],
  ["sl_no", "sl_no INT NULL"],
]) {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = ?`,
    [column],
  );
  if (Number(cols[0].n) === 0) await pool.query(`ALTER TABLE employees ADD COLUMN ${definition}`);
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS payroll_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sl_no INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    attendance DECIMAL(8,2) NOT NULL,
    advance DECIMAL(12,2) NOT NULL DEFAULT 0,
    salary DECIMAL(12,2) NOT NULL,
    divisor DECIMAL(8,2) NOT NULL,
    deduct DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_done DECIMAL(12,2) NULL
  )
`);
await pool.query(`
  CREATE TABLE IF NOT EXISTS payroll_close (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    sort_order INT NOT NULL
  )
`);

function divisorFor(salary, rate) {
  if (Math.round(salary / 26) === rate) return 26;
  if (Math.round(salary / 30) === rate) return 30;
  return 26;
}

const august = [
  [1, "Pritam Gantait", 26, 0, 14000, 538, 0, 14000],
  [2, "Bhabesh Das", 31, 0, 13500, 519, 0, 16100],
  [3, "Ranjit Prodhan", 26, 2000, 13500, 519, 2000, 11500],
  [4, "Abhijit Das", 26, 0, 13500, 519, 0, 13500],
  [5, "Biswajit Das", 0, 4000, 13000, 500, 0, 0],
  [6, "Tapas Sardar", 11, 0, 13000, 500, 0, 5500],
  [7, "Ranjit Gain", 25, 0, 13000, 500, 0, 12500],
  [8, "Ashit Urun", 29, 0, 12500, 481, 0, 13950],
  [9, "Prasanta Sarkar", 26, 0, 18000, 692, 0, 18000],
  [10, "Sukhen Mondal", 29.5, 0, 15500, 517, 0, 15250],
  [11, "Sankar Barui", 32.5, 21000, 15500, 517, 3000, 13800],
  [12, "Bapi Gain", 31, 4000, 15000, 500, 2000, 14500],
  [13, "Pabitra Sarkar", 27.5, 0, 14500, 483, 0, 19700],
  [14, "Sushanta Das", 8, 0, 19000, 633, 0, 14000],
  [15, "Parimal Bijuli", 30, 0, 15500, 517, 0, 15500],
  [16, "Ananta Sarder", 31, 0, 15500, 517, 0, 16050],
  [17, "Aparesh Mondal", 30.5, 0, 15500, 517, 0, 15760],
  [18, "Subhajit Paik", 31, 0, 14500, 483, 0, 15000],
  [19, "Satinath Majhi", 31, 0, 15500, 517, 0, 16050],
  [20, "Sumit Biswas", 31, 0, 15500, 517, 0, 16050],
  [21, "Sayak Paul", 31, 0, 15500, 517, 0, 16050],
  [22, "Emon Shil", 27.5, 0, 14500, 483, 0, 13300],
  [23, "Sasanka Khatya", 31.5, 18000, 14000, 467, 0, 14700],
  [24, "Dilip Dey", 30.5, 0, 15500, 517, 0, 23550],
  [25, "Sumanta Halder", 31.5, 0, 14000, 467, 0, 14700],
];

const [filled] = await pool.query("SELECT COUNT(*) AS n FROM employees WHERE attendance IS NOT NULL");
if (Number(filled[0].n) === 0) {
  for (const [sl, name, attendance, advance, salary, rate, deduct, payment] of august) {
    const divisor = divisorFor(salary, rate);
    const [found] = await pool.query("SELECT id FROM employees WHERE name = ?", [name]);
    if (found.length) {
      await pool.query(
        `UPDATE employees
         SET sl_no = ?, attendance = ?, advance = ?, salary = ?, divisor = ?, deduct = ?, payment_done = ?
         WHERE id = ?`,
        [sl, attendance, advance, salary, divisor, deduct, payment, found[0].id],
      );
    } else {
      await pool.query(
        `INSERT INTO employees (sl_no, name, attendance, advance, salary, divisor, deduct, payment_done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sl, name, attendance, advance, salary, divisor, deduct, payment],
      );
    }
  }
}

const [claimCount] = await pool.query("SELECT COUNT(*) AS n FROM payroll_claims");
if (Number(claimCount[0].n) === 0) {
  const claims = [
    [1, "Emon Shil", 0, 0, 14500, 483, 0, 0],
    [2, "Biswajit Das", 0, 0, 13000, 500, 0, 0],
    [3, "Dilip Dey", 15, 0, 15500, 517, 0, null],
    [4, "Sushanta Das", 22, 0, 19000, 633, 0, null],
    [5, "Sumit Biswas", 0, 0, 15500, 517, 0, 0],
    [6, "Aparesh Mondal", 0, 0, 15500, 517, 0, 0],
    [7, "Bapi Gain", 2, 0, 15000, 500, 0, null],
    [8, "Ranjit Prodhan", 0, 0, 13500, 519, 0, 0],
    [9, "Ashit Urun", 0, 0, 12500, 481, 0, 0],
    [10, "Rabi Roy", 27, 0, 17000, 654, 0, 17654],
    [11, "Ajay Mali", 0, 0, 12500, 481, 0, 0],
    [12, "Pabitra Sarkar", 3, 0, 14000, 467, 0, null],
    [13, "Parimal Bijuli", 3, 0, 15500, 517, 0, null],
    [14, "Smart", 0, 0, 13000, 433, 0, 0],
  ];
  for (const [sl, name, attendance, advance, salary, rate, deduct, payment] of claims) {
    await pool.query(
      `INSERT INTO payroll_claims (sl_no, name, attendance, advance, salary, divisor, deduct, payment_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sl, name, attendance, advance, salary, divisorFor(salary, rate), deduct, payment],
    );
  }
}

const [closeCount] = await pool.query("SELECT COUNT(*) AS n FROM payroll_close");
if (Number(closeCount[0].n) === 0) {
  const close = [
    ["Actual total", 376662, 1],
    ["Dilip", 1000, 2],
    ["IIFT Travel allowance", 1050, 3],
  ];
  for (const [label, amount, order] of close) {
    await pool.query("INSERT INTO payroll_close (label, amount, sort_order) VALUES (?, ?, ?)", [label, amount, order]);
  }
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS attendance_sheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sheet_name VARCHAR(120) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    work_name TEXT NOT NULL,
    work_order_no VARCHAR(80) NOT NULL,
    work_order_date DATE NULL,
    period_from DATE NULL,
    period_to DATE NULL,
    period_note VARCHAR(20) NULL,
    bill_tab VARCHAR(80) NULL
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS attendance_rows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sheet_id INT NOT NULL,
    sort_order INT NOT NULL,
    row_kind VARCHAR(20) NOT NULL,
    bill_sl_no VARCHAR(20) NULL,
    sl_no VARCHAR(20) NULL,
    trade VARCHAR(255) NULL,
    workman_name VARCHAR(255) NULL,
    total_days DECIMAL(8,2) NULL,
    marks JSON NULL,
    FOREIGN KEY (sheet_id) REFERENCES attendance_sheets(id)
  )
`);

const [sheetCount] = await pool.query("SELECT COUNT(*) AS n FROM attendance_sheets");
if (Number(sheetCount[0].n) === 0) {
  const header = {
    company_name: "M/s. N.K. Enterprise",
    work_name: "ARMO of residential and non residential buildings at 29 SCG NSG Kolkata 2024-25 (SH. Providing of Labour Services).",
    work_order_no: "GEMC-511687725998138",
    work_order_date: "2025-11-15",
    period_from: "2026-02-01",
    period_to: "2026-02-28",
    period_note: "Act",
    bill_tab: "Bill CB-7-19.07.2016",
  };
  const tabs = ["Attendance Sheet(Actual)", "Attendance Sheet(Adj)", "Calculation sheet", "Extra payment chart"];
  for (const sheetName of tabs) {
    const [created] = await pool.query(
      `INSERT INTO attendance_sheets
        (sheet_name, company_name, work_name, work_order_no, work_order_date, period_from, period_to, period_note, bill_tab)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sheetName, header.company_name, header.work_name, header.work_order_no, header.work_order_date, header.period_from, header.period_to, header.period_note, header.bill_tab],
    );
    if (sheetName !== "Attendance Sheet(Actual)") continue;
    const rows = [
      ["workman", "1", "1", "Plumber", "Sukhen Mondal", 22],
      ["workman", "1", "i", "Plumber", "Sankar Barui", 3],
      ["workman", "1", "ii", "Plumber", "Bapi Gain", 3],
      ["bill_total", "1", null, "Plumber", null, 28],
      ["workman", null, "1", "Pump Operator and helper of Plumber", "Bapi Gain", 19.5],
      ["workman", null, "i", "Pump Operator and helper of Plumber", "Sukhen Mondal", 4.5],
      ["workman", null, "ii", "Pump Operator and helper of Plumber", "Sankar Barui", 4],
      ["group_total", null, null, "Pump Operator and helper of Plumber", null, 28],
      ["workman", null, "2", null, "Sankar Barui", 24],
      ["workman", null, "i", null, "Sukhen Mondal", 2],
      ["workman", null, "ii", null, "Bapi Gain", 2],
      ["workman", null, "4", null, "Ananta Sarder", null],
      ["workman", null, "5", null, "Aparesh Mo", null],
    ];
    let order = 1;
    for (const row of rows) {
      await pool.query(
        `INSERT INTO attendance_rows
          (sheet_id, sort_order, row_kind, bill_sl_no, sl_no, trade, workman_name, total_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [created.insertId, order, ...row],
      );
      order += 1;
    }
  }
  for (const name of ["Sukhen Mondal", "Sankar Barui", "Bapi Gain", "Ananta Sarder", "Aparesh Mo"]) {
    const [found] = await pool.query("SELECT id FROM employees WHERE name = ?", [name]);
    if (!found.length) {
      await pool.query("INSERT INTO employees (name, salary, divisor) VALUES (?, NULL, 26)", [name]);
    }
  }
}

await importNsg(pool);

await pool.query(`
  CREATE TABLE IF NOT EXISTS payroll_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    month_key CHAR(7) NOT NULL,
    sl_no INT NULL,
    attendance DECIMAL(8,2) NULL,
    advance DECIMAL(12,2) NOT NULL DEFAULT 0,
    salary DECIMAL(12,2) NULL,
    divisor DECIMAL(8,2) NOT NULL DEFAULT 26,
    deduct DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_done DECIMAL(12,2) NULL,
    UNIQUE KEY employee_month (employee_id, month_key)
  )
`);

for (const [table, column, definition] of [
  ["payroll_claims", "month_key", "month_key CHAR(7) NULL"],
  ["payroll_close", "month_key", "month_key CHAR(7) NULL"],
  ["attendance_sheets", "month_key", "month_key CHAR(7) NULL"],
]) {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (Number(cols[0].n) === 0) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

await pool.query("UPDATE payroll_claims SET month_key = '2026-08' WHERE month_key IS NULL");
await pool.query("UPDATE payroll_close SET month_key = '2026-08' WHERE month_key IS NULL");
await pool.query("UPDATE attendance_sheets SET month_key = DATE_FORMAT(period_from, '%Y-%m') WHERE month_key IS NULL AND period_from IS NOT NULL");
await pool.query(`
  INSERT INTO payroll_lines (employee_id, month_key, sl_no, attendance, advance, salary, divisor, deduct, payment_done)
  SELECT e.id, '2026-08', e.sl_no, e.attendance, e.advance, e.salary, e.divisor, e.deduct, e.payment_done
  FROM employees e
  LEFT JOIN payroll_lines p ON p.employee_id = e.id AND p.month_key = '2026-08'
  WHERE e.attendance IS NOT NULL AND p.id IS NULL
`);

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/api", requireAuth(pool));
app.use("/api", (req, res, next) => {
  if (!["POST", "PUT", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.auth) return;
    const entity = req.originalUrl.split("?")[0].slice(0, 80);
    pool.query(
      "INSERT INTO audit_log (company_id, user_id, entity_name, action_name) VALUES (1, ?, ?, ?)",
      [req.auth.userId, entity, req.method],
    ).catch(() => {});
  });
  next();
});

function money(value) {
  const cleaned = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function readPerson(body) {
  const name = String(body.name ?? "").trim();
  const trade = String(body.trade ?? "").trim();
  const skill = String(body.skill ?? "").trim();
  const salary = money(body.salary);
  const divisor = body.divisor === undefined || body.divisor === "" ? 26 : money(body.divisor);
  const advance = body.advance === undefined || body.advance === "" ? 0 : money(body.advance);
  const attendance = body.attendance === undefined || body.attendance === "" ? null : money(body.attendance);
  const deduct = body.deduct === undefined || body.deduct === "" ? 0 : money(body.deduct);
  const paymentDone = body.paymentDone === undefined || body.paymentDone === "" ? null : money(body.paymentDone);
  const gap = personError(body);
  if (gap) return { error: gap };
  if (!Number.isFinite(salary) || salary <= 0) return { error: "Enter the original monthly salary." };
  if (!Number.isFinite(divisor) || divisor <= 0) return { error: "The wage divisor must be greater than zero. The meeting rule is 26." };
  if (!Number.isFinite(advance) || advance < 0) return { error: "Advance payment cannot be negative." };
  if (attendance === null || !Number.isFinite(attendance) || attendance < 0) return { error: "Enter attendance as a number. Half days are allowed." };
  if (!Number.isFinite(deduct) || deduct < 0) return { error: "The loan or salary advance deducted this month cannot be negative." };
  if (paymentDone === null || !Number.isFinite(paymentDone)) return { error: "Enter the payment done." };
  return { name, trade, skill, salary, divisor, advance, attendance, deduct, paymentDone };
}

function asPerson(row) {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade || "",
    skill: row.skill || "",
    salary: row.salary === null ? null : Number(row.salary),
    divisor: Number(row.divisor),
    advance: Number(row.advance || 0),
    attendance: row.attendance === null || row.attendance === undefined ? null : Number(row.attendance),
    deduct: Number(row.deduct || 0),
    paymentDone: row.payment_done === null || row.payment_done === undefined ? null : Number(row.payment_done),
    slNo: row.sl_no,
  };
}

app.get("/api/employees/:id/document/:kind", async (req, res) => {
  const id = Number(req.params.id);
  const kind = String(req.params.kind);
  const [docs] = await pool.query(
    "SELECT stored_path FROM employee_document WHERE employee_id = ? AND document_kind = ?",
    [id, kind],
  );
  if (!docs.length) return res.status(404).json({ error: "That document is not stored." });
  const file = await readFile(documentPath(docs[0].stored_path));
  const ext = docs[0].stored_path.split(".").pop();
  res.type(ext === "pdf" ? "application/pdf" : `image/${ext === "png" ? "png" : "jpeg"}`);
  res.send(file);
});

async function payrollMonth(requested) {
  const chosen = monthKey(requested);
  if (chosen) return chosen;
  const [rows] = await pool.query("SELECT month_key FROM payroll_lines ORDER BY month_key DESC LIMIT 1");
  return rows[0]?.month_key || "2026-08";
}

async function peopleForMonth(month, companyId) {
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.trade, e.skill,
            COALESCE(p.salary, e.salary) AS salary,
            COALESCE(p.divisor, e.divisor) AS divisor,
            COALESCE(p.advance, 0) AS advance,
            p.attendance,
            COALESCE(p.deduct, 0) AS deduct,
            p.payment_done,
            COALESCE(p.sl_no, e.sl_no) AS sl_no
     FROM employees e
     LEFT JOIN payroll_lines p ON p.employee_id = e.id AND p.month_key = ?
     WHERE e.company_id = ?
     ORDER BY COALESCE(p.sl_no, e.sl_no) IS NULL, COALESCE(p.sl_no, e.sl_no), e.name`,
    [month, companyId],
  );
  return rows.map(asPerson);
}

async function savePayLine(employeeId, month, person, slNo) {
  await pool.query(
    `INSERT INTO payroll_lines (employee_id, month_key, sl_no, attendance, advance, salary, divisor, deduct, payment_done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sl_no = VALUES(sl_no), attendance = VALUES(attendance), advance = VALUES(advance),
       salary = VALUES(salary), divisor = VALUES(divisor), deduct = VALUES(deduct), payment_done = VALUES(payment_done)`,
    [employeeId, month, slNo, person.attendance, person.advance, person.salary, person.divisor, person.deduct, person.paymentDone],
  );
}

app.get("/api/payroll-months", async (req, res) => {
  const companyId = companyIdFrom(req);
  const [rows] = companyId === 1
    ? await pool.query(
      `SELECT month_key FROM (
         SELECT month_key FROM payroll_lines
         UNION SELECT month_key FROM payroll_claims
         UNION SELECT month_key FROM payroll_close
       ) months WHERE month_key IS NOT NULL ORDER BY month_key DESC`,
    )
    : await pool.query(
      `SELECT DISTINCT p.month_key FROM payroll_lines p
       JOIN employees e ON e.id = p.employee_id
       WHERE e.company_id = ? AND p.month_key IS NOT NULL
       ORDER BY p.month_key DESC`,
      [companyId],
    );
  res.json(rows.map((row) => row.month_key));
});

app.get("/api/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const month = await payrollMonth(req.query.month);
  const people = await peopleForMonth(month, companyIdFrom(req));
  const person = people.find((item) => item.id === id);
  if (!person) return res.status(404).json({ error: "That person is not in the employee book." });
  res.json({ ...person, month, application: await loadApplication(pool, id) });
});

app.get("/api/employees", async (req, res) => {
  const month = await payrollMonth(req.query.month);
  res.json(await peopleForMonth(month, companyIdFrom(req)));
});

app.post("/api/employees", async (req, res) => {
  const month = monthKey(req.body.month);
  if (!month) return res.status(400).json({ error: "Choose the month." });
  const person = readPerson(req.body);
  if (person.error) return res.status(400).json(person);
  const [result] = await pool.query(
    "INSERT INTO employees (name, trade, skill, salary, divisor, company_id) VALUES (?, ?, ?, ?, ?, ?)",
    [person.name, person.trade, person.skill, person.salary, person.divisor, companyIdFrom(req)],
  );
  await savePayLine(result.insertId, month, person, null);
  const saved = await saveApplication(pool, result.insertId, req.body.application || {});
  if (saved.error) return res.status(400).json(saved);
  res.status(201).json({ id: result.insertId, month, ...person });
});

app.put("/api/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const month = monthKey(req.body.month);
  if (!month) return res.status(400).json({ error: "Choose the month." });
  const [found] = await pool.query("SELECT id, sl_no FROM employees WHERE id = ?", [id]);
  if (!found.length) return res.status(404).json({ error: "That person is not in the employee book." });
  const person = readPerson(req.body);
  if (person.error) return res.status(400).json(person);
  await pool.query(
    "UPDATE employees SET name = ?, trade = ?, skill = ?, salary = ?, divisor = ? WHERE id = ?",
    [person.name, person.trade, person.skill, person.salary, person.divisor, id],
  );
  await savePayLine(id, month, person, found[0].sl_no);
  const saved = await saveApplication(pool, id, req.body.application || {});
  if (saved.error) return res.status(400).json(saved);
  res.json({ id, month, ...person, slNo: found[0].sl_no });
});

app.delete("/api/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [result] = await pool.query("DELETE FROM employees WHERE id = ?", [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: "That person is not in the employee book." });
  res.status(204).end();
});

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

app.post("/api/payroll/close", async (req, res) => {
  const month = monthKey(req.body.month);
  if (!month) return res.status(400).json({ error: "Choose the month." });
  const result = await closeMonth(pool, month);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get("/api/attendance-days", async (req, res) => {
  const month = monthKey(req.query.month);
  const name = String(req.query.name ?? "").trim();
  if (!month) return res.status(400).json({ error: "Choose the month." });
  if (!name) return res.status(400).json({ error: "Enter the name." });
  const [rows] = await pool.query(
    `SELECT s.sheet_name, r.total_days, r.marks
     FROM attendance_rows r
     JOIN attendance_sheets s ON s.id = r.sheet_id
     WHERE s.month_key = ? AND r.row_kind = 'workman' AND r.workman_name = ?`,
    [month, name],
  );
  const found = attendanceDays(rows.map((row) => ({
    sheetName: row.sheet_name,
    totalDays: row.total_days === null ? null : Number(row.total_days),
    marks: typeof row.marks === "string" ? JSON.parse(row.marks) : (row.marks || {}),
  })));
  if (!found) return res.status(404).json({ error: "That name has no attendance total in this month." });
  res.json(found);
});

app.get("/api/payroll-extra", async (req, res) => {
  const month = await payrollMonth(req.query.month);
  if (companyIdFrom(req) !== 1) return res.json({ claims: [], close: [] });
  const [claims] = await pool.query("SELECT sl_no, name, attendance, advance, salary, divisor, deduct, payment_done FROM payroll_claims WHERE month_key = ? ORDER BY sl_no", [month]);
  const [close] = await pool.query("SELECT label, amount FROM payroll_close WHERE month_key = ? ORDER BY sort_order", [month]);
  res.json({
    claims: claims.map((row) => ({
      slNo: row.sl_no,
      name: row.name,
      attendance: Number(row.attendance),
      advance: Number(row.advance),
      salary: Number(row.salary),
      divisor: Number(row.divisor),
      deduct: Number(row.deduct),
      paymentDone: row.payment_done === null ? null : Number(row.payment_done),
    })),
    close: close.map((row) => ({ label: row.label, amount: Number(row.amount) })),
  });
});

function asMoney(value) {
  return value === null || value === undefined ? null : Number(value);
}

function asWage(row) {
  return {
    ...row,
    days_worked: asMoney(row.days_worked),
    daily_rate: asMoney(row.daily_rate),
    basic: asMoney(row.basic),
    da: asMoney(row.da),
    gross: asMoney(row.gross),
    pf: asMoney(row.pf),
    esic: asMoney(row.esic),
    professional_tax: asMoney(row.professional_tax),
    other_deduction: asMoney(row.other_deduction),
    net_amount: asMoney(row.net_amount),
    employer_pf: asMoney(row.employer_pf),
    employer_esi: asMoney(row.employer_esi),
    employer_total: asMoney(row.employer_total),
  };
}

function asSheet(sheet, rows) {
  return {
    ...sheet,
    work_order_date: asDate(sheet.work_order_date),
    period_from: asDate(sheet.period_from),
    period_to: asDate(sheet.period_to),
    rows: rows.map((row) => ({
      ...row,
      total_days: row.total_days === null ? null : Number(row.total_days),
      marks: typeof row.marks === "string" ? JSON.parse(row.marks) : (row.marks || {}),
    })),
  };
}

function readDate(value, label) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `Enter ${label} as a date.` };
  return text;
}

function readSheet(body) {
  const companyName = String(body.companyName ?? "").trim();
  const workName = String(body.workName ?? "").trim();
  const workOrderNo = String(body.workOrderNo ?? "").trim();
  const periodNote = String(body.periodNote ?? "").trim();
  const billTab = String(body.billTab ?? "").trim();
  const workOrderDate = readDate(body.workOrderDate, "the work order date");
  const periodFrom = readDate(body.periodFrom, "the working period start");
  const periodTo = readDate(body.periodTo, "the working period end");
  if (!companyName) return { error: "Enter the company name." };
  if (!workName) return { error: "Enter the name of work." };
  if (!workOrderNo) return { error: "Enter the work order number." };
  if (workOrderDate?.error) return workOrderDate;
  if (periodFrom?.error) return periodFrom;
  if (periodTo?.error) return periodTo;
  return { companyName, workName, workOrderNo, workOrderDate, periodFrom, periodTo, periodNote, billTab };
}

function readRow(body) {
  const rowKind = String(body.rowKind ?? "").trim();
  if (!["workman", "trade", "bill_total", "group_total"].includes(rowKind)) return { error: "Choose the row type." };
  const billSl = String(body.billSl ?? "").trim();
  const slNo = String(body.slNo ?? "").trim();
  const trade = String(body.trade ?? "").trim();
  const workmanName = String(body.workmanName ?? "").trim();
  if (rowKind === "workman" && !workmanName) return { error: "Enter the name of the workman." };
  if (rowKind === "trade" && !trade && !workmanName) return { error: "Enter the trade." };
  const totalDays = body.totalDays === undefined || body.totalDays === "" || body.totalDays === null ? null : money(body.totalDays);
  if (totalDays !== null && (!Number.isFinite(totalDays) || totalDays < 0)) return { error: "Enter total days as a number. Half days are allowed." };
  const marks = {};
  const source = body.marks && typeof body.marks === "object" ? body.marks : {};
  for (let day = 1; day <= 31; day += 1) {
    const raw = source[day] ?? source[String(day)];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const text = String(raw).trim();
    if (text.length > 8) return { error: `The mark for day ${day} is too long.` };
    marks[String(day)] = text;
  }
  return {
    rowKind,
    billSl: billSl || null,
    slNo: slNo || null,
    trade: trade || null,
    workmanName: workmanName || null,
    totalDays,
    marks,
  };
}

async function loadAttendance(month, companyId) {
  const filters = ["company_id = ?"];
  const params = [companyId];
  if (month) {
    filters.push("month_key = ?");
    params.push(month);
  }
  const [sheets] = await pool.query(
    `SELECT id, sheet_name, company_name, work_name, work_order_no, work_order_date,
            period_from, period_to, period_note, bill_tab, month_key
     FROM attendance_sheets WHERE ${filters.join(" AND ")} ORDER BY id`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT id, sheet_id, sort_order, row_kind, bill_sl_no, sl_no, trade, workman_name, total_days, marks
     FROM attendance_rows ORDER BY sort_order`,
  );
  const [wages] = await pool.query(
    `SELECT id, sheet_id, sort_order, row_kind, sl_no, employee_name, epfo_no, esic_no, designation,
            days_worked, daily_rate, basic, da, gross, pf, esic, professional_tax, other_deduction,
            net_amount, employer_pf, employer_esi, admin_charge, employer_total
     FROM wage_lines ORDER BY sort_order`,
  );
  const [notes] = await pool.query(
    "SELECT id, sheet_id, sort_order, note, month_label, amount FROM wage_notes ORDER BY sort_order",
  );
  const [extra] = await pool.query(
    `SELECT id, sheet_id, sort_order, row_kind, sl_no, employee_name, days_worked, daily_rate, amount
     FROM extra_payments ORDER BY sort_order`,
  );
  return sheets.map((sheet) => ({
    ...asSheet(sheet, rows.filter((row) => row.sheet_id === sheet.id)),
    wageLines: wages.filter((row) => row.sheet_id === sheet.id).map(asWage),
    wageNotes: notes.filter((row) => row.sheet_id === sheet.id).map((row) => ({
      ...row,
      amount: row.amount === null ? null : Number(row.amount),
    })),
    extraPayments: extra.filter((row) => row.sheet_id === sheet.id).map((row) => ({
      ...row,
      days_worked: row.days_worked === null ? null : Number(row.days_worked),
      daily_rate: row.daily_rate === null ? null : Number(row.daily_rate),
      amount: row.amount === null ? null : Number(row.amount),
    })),
  }));
}

app.get("/api/attendance-months", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT DISTINCT month_key FROM attendance_sheets WHERE company_id = ? AND month_key IS NOT NULL ORDER BY month_key DESC",
    [companyIdFrom(req)],
  );
  res.json(rows.map((row) => row.month_key));
});

app.get("/api/attendance", async (req, res) => {
  const month = monthKey(req.query.month);
  res.json(await loadAttendance(month, companyIdFrom(req)));
});

app.post("/api/attendance/open", async (req, res) => {
  const month = monthKey(req.body.month);
  if (!month) return res.status(400).json({ error: "Choose the month." });
  const companyId = companyIdFrom(req);
  const [existing] = await pool.query("SELECT id FROM attendance_sheets WHERE month_key = ? AND company_id = ?", [month, companyId]);
  if (existing.length) return res.json({ month, created: false });
  const [latest] = await pool.query(
    "SELECT company_name, work_name, work_order_no, work_order_date FROM attendance_sheets ORDER BY period_from DESC, id DESC LIMIT 1",
  );
  const sample = latest[0] || {
    company_name: "M/s. N.K. Enterprise",
    work_name: "",
    work_order_no: "",
    work_order_date: null,
  };
  const range = monthRange(month);
  const tabs = [
    ["Attendance Sheet(Actual)", "Act"],
    ["Attendance Sheet(Adj)", "Adj"],
    ["Calculation sheet", month],
    ["Extra payment chart", ""],
  ];
  for (const [name, note] of tabs) {
    await pool.query(
      `INSERT INTO attendance_sheets
        (sheet_name, company_name, work_name, work_order_no, work_order_date, period_from, period_to, period_note, month_key, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sample.company_name, sample.work_name || " ", sample.work_order_no || "-", sample.work_order_date, range.from, range.to, note || null, month, companyId],
    );
  }
  res.status(201).json({ month, created: true });
});

app.get("/api/attendance/:id/export", async (req, res) => {
  const format = String(req.query.format || "").toLowerCase();
  if (!["pdf", "word", "excel"].includes(format)) {
    return res.status(400).json({ error: "Choose PDF, Word, or Excel." });
  }
  const sheets = await loadAttendance(null, companyIdFrom(req));
  const sheet = sheets.find((item) => item.id === Number(req.params.id));
  if (!sheet) return res.status(404).json({ error: "That attendance sheet is not stored." });
  const file = await renderAttendance(sheet, format);
  const name = sheet.month_key ? file.name.replace(/(\.[^.]+)$/, `-${sheet.month_key}$1`) : file.name;
  res.setHeader("Content-Type", file.type);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(file.buffer);
});

app.put("/api/attendance/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [found] = await pool.query("SELECT id FROM attendance_sheets WHERE id = ?", [id]);
  if (!found.length) return res.status(404).json({ error: "That attendance sheet is not stored." });
  const sheet = readSheet(req.body);
  if (sheet.error) return res.status(400).json(sheet);
  await pool.query(
    `UPDATE attendance_sheets
        SET company_name = ?, work_name = ?, work_order_no = ?, work_order_date = ?,
            period_from = ?, period_to = ?, period_note = ?, bill_tab = ?, month_key = ?
      WHERE id = ?`,
    [sheet.companyName, sheet.workName, sheet.workOrderNo, sheet.workOrderDate, sheet.periodFrom, sheet.periodTo, sheet.periodNote || null, sheet.billTab || null, sheet.periodFrom ? sheet.periodFrom.slice(0, 7) : null, id],
  );
  res.json({ id, ...sheet });
});

app.post("/api/attendance/:id/rows", async (req, res) => {
  const sheetId = Number(req.params.id);
  const [found] = await pool.query("SELECT id FROM attendance_sheets WHERE id = ?", [sheetId]);
  if (!found.length) return res.status(404).json({ error: "That attendance sheet is not stored." });
  const row = readRow(req.body);
  if (row.error) return res.status(400).json(row);
  const [order] = await pool.query("SELECT COALESCE(MAX(sort_order), 0) AS n FROM attendance_rows WHERE sheet_id = ?", [sheetId]);
  const [result] = await pool.query(
    `INSERT INTO attendance_rows
      (sheet_id, sort_order, row_kind, bill_sl_no, sl_no, trade, workman_name, total_days, marks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sheetId, Number(order[0].n) + 1, row.rowKind, row.billSl, row.slNo, row.trade, row.workmanName, row.totalDays, JSON.stringify(row.marks)],
  );
  if (row.rowKind === "workman" && row.workmanName) {
    const [person] = await pool.query("SELECT id FROM employees WHERE name = ?", [row.workmanName]);
    if (!person.length) await pool.query("INSERT INTO employees (name, salary, divisor) VALUES (?, NULL, 26)", [row.workmanName]);
  }
  res.status(201).json({ id: result.insertId, ...row });
});

app.put("/api/attendance/rows/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [found] = await pool.query("SELECT id FROM attendance_rows WHERE id = ?", [id]);
  if (!found.length) return res.status(404).json({ error: "That attendance row is not stored." });
  const row = readRow(req.body);
  if (row.error) return res.status(400).json(row);
  await pool.query(
    `UPDATE attendance_rows
        SET row_kind = ?, bill_sl_no = ?, sl_no = ?, trade = ?, workman_name = ?, total_days = ?, marks = ?
      WHERE id = ?`,
    [row.rowKind, row.billSl, row.slNo, row.trade, row.workmanName, row.totalDays, JSON.stringify(row.marks), id],
  );
  res.json({ id, ...row });
});

app.delete("/api/attendance/rows/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [result] = await pool.query("DELETE FROM attendance_rows WHERE id = ?", [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: "That attendance row is not stored." });
  res.status(204).end();
});

await registerAuth(app, pool);
await migrate(pool);
await registerOffice(app, pool);
await registerMasters(app, pool);
await registerDeployment(app, pool);
await registerFinish(app, pool);
await registerApplicants(app, pool);

const port = 3001;
app.listen(port, () => {
  console.log(`Employee book API on http://localhost:${port}`);
});
