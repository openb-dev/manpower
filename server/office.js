import { renderDocument } from "./attendanceExport.js";
import { invoiceDocument } from "./invoiceExport.js";
import { companyIdFrom } from "./companyScope.js";

function money(value) {
  const cleaned = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function optionalMoney(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const amount = money(value);
  if (!Number.isFinite(amount)) return { error: `Enter ${label} as a number.` };
  return amount;
}

function optionalDate(value, label) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `Enter ${label} as a date.` };
  return text;
}

function companyCode(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function companyRecord(row) {
  return {
    id: row.id,
    legalName: row.legal_name,
    shortName: row.short_name || row.legal_name,
    code: row.code || "",
    gstin: row.gstin || "",
    stateName: row.state_name || "",
    stateCode: row.state_code || "",
    sac: row.sac || "",
    people: Number(row.people || 0),
  };
}

function text(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const MONEY_FIELDS = [
  ["tenderAmount", "tender_amount", "the tender amount"],
  ["estimateCost", "estimate_cost", "the estimate cost"],
  ["grossAmount", "gross_amount", "the gross amount"],
  ["netAmount", "net_amount", "the net amount"],
  ["earnestMoney", "earnest_money", "earnest money"],
  ["performanceGuarantee", "performance_guarantee", "the performance guarantee"],
  ["securityDeposit", "security_deposit", "the security deposit"],
  ["incomeTax", "income_tax", "income tax"],
  ["gstRecovery", "gst_recovery", "GST"],
  ["educationCess", "education_cess", "education cess"],
  ["labourWelfareCess", "labour_welfare_cess", "labour welfare cess"],
  ["waterCharge", "water_charge", "the water charge"],
  ["withheld", "withheld", "the withheld amount"],
  ["otherRecovery", "other_recovery", "the other recovery"],
  ["esiAmount", "esi_amount", "ESI"],
  ["pfAmount", "pf_amount", "PF"],
];

const DATE_FIELDS = [
  ["tenderOpening", "tender_opening", "the tender opening"],
  ["startAgreement", "start_agreement", "the agreement start"],
  ["startActual", "start_actual", "the actual start"],
  ["completionAgreement", "completion_agreement", "the agreement completion"],
  ["completionActual", "completion_actual", "the actual completion"],
  ["bankReceivedDate", "bank_received_date", "the bank received date"],
  ["reimburseDate", "reimburse_date", "the reimburse date"],
];

function readContract(body) {
  const clientName = String(body.clientName ?? "").trim();
  const departmentName = String(body.departmentName ?? "").trim();
  const contractType = String(body.contractType ?? "").trim().toUpperCase();
  const workName = String(body.workName ?? "").trim();
  const agreementNo = String(body.agreementNo ?? "").trim();
  if (!clientName) return { error: "Enter the client." };
  if (!departmentName) return { error: "Enter the department. A bill is addressed to a department." };
  if (!["A", "B", "C"].includes(contractType)) return { error: "Choose contract type A, B, or C." };
  if (!workName) return { error: "Enter the work name." };
  if (!agreementNo) return { error: "Enter the agreement or work-order number." };
  const record = {
    clientName,
    departmentName,
    contractType,
    workName,
    agreementNo,
    measurementBookNo: text(body.measurementBookNo),
    billNumber: text(body.billNumber),
    voucherNumber: text(body.voucherNumber),
    remarks: text(body.remarks),
  };
  for (const [key, , label] of MONEY_FIELDS) {
    const amount = optionalMoney(body[key], label);
    if (amount?.error) return amount;
    record[key] = amount;
  }
  for (const [key, , label] of DATE_FIELDS) {
    const date = optionalDate(body[key], label);
    if (date?.error) return date;
    record[key] = date;
  }
  return record;
}

function contractValues(record) {
  return [
    record.contractType,
    record.workName,
    record.agreementNo,
    record.measurementBookNo,
    record.tenderOpening,
    record.tenderAmount,
    record.estimateCost,
    record.startAgreement,
    record.startActual,
    record.completionAgreement,
    record.completionActual,
    record.billNumber,
    record.grossAmount,
    record.netAmount,
    record.voucherNumber,
    record.earnestMoney,
    record.performanceGuarantee,
    record.securityDeposit,
    record.incomeTax,
    record.gstRecovery,
    record.educationCess,
    record.labourWelfareCess,
    record.waterCharge,
    record.withheld,
    record.otherRecovery,
    record.esiAmount,
    record.pfAmount,
    record.bankReceivedDate,
    record.reimburseDate,
    record.remarks,
  ];
}

const CONTRACT_COLUMNS = `
  contract_type, work_name, agreement_no, measurement_book_no,
  tender_opening, tender_amount, estimate_cost,
  start_agreement, start_actual, completion_agreement, completion_actual,
  bill_number, gross_amount, net_amount, voucher_number,
  earnest_money, performance_guarantee, security_deposit, income_tax, gst_recovery,
  education_cess, labour_welfare_cess, water_charge, withheld, other_recovery,
  esi_amount, pf_amount, bank_received_date, reimburse_date, remarks
`;

function mapContract(row) {
  const record = {
    id: row.id,
    clientName: row.party_name,
    departmentName: row.department_name,
    contractType: row.contract_type,
    workName: row.work_name,
    agreementNo: row.agreement_no,
    measurementBookNo: row.measurement_book_no || "",
    billNumber: row.bill_number || "",
    voucherNumber: row.voucher_number || "",
    remarks: row.remarks || "",
  };
  for (const [key, column] of MONEY_FIELDS) record[key] = row[column] === null ? null : Number(row[column]);
  for (const [key, column] of DATE_FIELDS) record[key] = asDate(row[column]) || "";
  return record;
}

async function ensureParty(pool, clientName, departmentName) {
  const [clients] = await pool.query("SELECT id FROM clients WHERE party_name = ?", [clientName]);
  const clientId = clients.length
    ? clients[0].id
    : (await pool.query("INSERT INTO clients (party_name) VALUES (?)", [clientName]))[0].insertId;
  const [departments] = await pool.query(
    "SELECT id FROM departments WHERE client_id = ? AND name = ?",
    [clientId, departmentName],
  );
  const departmentId = departments.length
    ? departments[0].id
    : (await pool.query("INSERT INTO departments (client_id, name) VALUES (?, ?)", [clientId, departmentName]))[0].insertId;
  return { clientId, departmentId };
}

export async function registerOffice(app, pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company (
      id INT PRIMARY KEY,
      legal_name VARCHAR(255) NOT NULL,
      gstin VARCHAR(20) NULL,
      state_name VARCHAR(80) NULL,
      state_code VARCHAR(8) NULL,
      sac VARCHAR(20) NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      party_name VARCHAR(255) NOT NULL UNIQUE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      department_id INT NOT NULL,
      contract_type CHAR(1) NOT NULL,
      work_name TEXT NOT NULL,
      agreement_no VARCHAR(80) NOT NULL UNIQUE,
      measurement_book_no VARCHAR(80) NULL,
      tender_opening DATE NULL,
      tender_amount DECIMAL(14,2) NULL,
      estimate_cost DECIMAL(14,2) NULL,
      start_agreement DATE NULL,
      start_actual DATE NULL,
      completion_agreement DATE NULL,
      completion_actual DATE NULL,
      bill_number VARCHAR(80) NULL,
      gross_amount DECIMAL(14,2) NULL,
      net_amount DECIMAL(14,2) NULL,
      voucher_number VARCHAR(80) NULL,
      earnest_money DECIMAL(14,2) NULL,
      performance_guarantee DECIMAL(14,2) NULL,
      security_deposit DECIMAL(14,2) NULL,
      income_tax DECIMAL(14,2) NULL,
      gst_recovery DECIMAL(14,2) NULL,
      education_cess DECIMAL(14,2) NULL,
      labour_welfare_cess DECIMAL(14,2) NULL,
      water_charge DECIMAL(14,2) NULL,
      withheld DECIMAL(14,2) NULL,
      other_recovery DECIMAL(14,2) NULL,
      esi_amount DECIMAL(14,2) NULL,
      pf_amount DECIMAL(14,2) NULL,
      bank_received_date DATE NULL,
      reimburse_date DATE NULL,
      remarks TEXT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_card (
      id INT AUTO_INCREMENT PRIMARY KEY,
      skill VARCHAR(40) NOT NULL UNIQUE,
      trades VARCHAR(255) NOT NULL,
      gross_daily_rate DECIMAL(12,2) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contract_id INT NOT NULL,
      invoice_no VARCHAR(80) NOT NULL UNIQUE,
      period_from DATE NULL,
      period_to DATE NULL,
      buyer_name VARCHAR(255) NULL,
      man_days DECIMAL(10,2) NULL,
      line_total DECIMAL(14,2) NULL,
      basic_amount DECIMAL(14,2) NULL,
      cgst DECIMAL(14,2) NULL,
      sgst DECIMAL(14,2) NULL,
      round_off DECIMAL(10,2) NULL,
      say_total DECIMAL(14,2) NULL,
      tds_gst DECIMAL(14,2) NULL,
      tds_income_tax DECIMAL(14,2) NULL,
      FOREIGN KEY (contract_id) REFERENCES contract_orders(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      trade VARCHAR(120) NOT NULL,
      skill VARCHAR(40) NOT NULL,
      man_days DECIMAL(10,2) NOT NULL,
      rate DECIMAL(12,2) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(255) NOT NULL,
      vendor_name VARCHAR(255) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      contract_id INT NULL,
      FOREIGN KEY (contract_id) REFERENCES contract_orders(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entry_kind VARCHAR(40) NOT NULL,
      source_ref VARCHAR(80) NOT NULL,
      narration VARCHAR(255) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      UNIQUE KEY ledger_source (entry_kind, source_ref)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS statutory_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      effective_from DATE NOT NULL,
      pf_percent DECIMAL(6,2) NOT NULL,
      pf_ceiling DECIMAL(12,2) NOT NULL,
      esi_employee_percent DECIMAL(6,2) NOT NULL,
      esi_wage_limit DECIMAL(12,2) NOT NULL
    )
  `);

  const [companyCount] = await pool.query("SELECT COUNT(*) AS n FROM company");
  if (Number(companyCount[0].n) === 0) {
    await pool.query(
      "INSERT INTO company (id, legal_name, sac) VALUES (1, ?, ?)",
      ["M/s. N.K. Enterprise", "998519"],
    );
  }
  for (const [column, definition] of [["short_name", "VARCHAR(80) NULL"], ["code", "VARCHAR(40) NULL"]]) {
    const [found] = await pool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company' AND COLUMN_NAME = ?`,
      [column],
    );
    if (Number(found[0].n) === 0) await pool.query(`ALTER TABLE company ADD COLUMN ${column} ${definition}`);
  }
  await pool.query(
    "UPDATE company SET short_name = 'N.K. Enterprise' WHERE id = 1 AND (short_name IS NULL OR short_name = '')",
  );
  await pool.query("UPDATE company SET code = 'nk' WHERE id = 1 AND (code IS NULL OR code = '')");
  const firms = [
    [2, "Origin", "Origin", "origin"],
    [3, "OSS", "OSS", "oss"],
    [4, "T.M.", "T.M.", "tm"],
  ];
  for (const [id, legalName, shortName, code] of firms) {
    await pool.query(
      "INSERT IGNORE INTO company (id, legal_name, short_name, code) VALUES (?, ?, ?, ?)",
      [id, legalName, shortName, code],
    );
  }

  const [rateCount] = await pool.query("SELECT COUNT(*) AS n FROM rate_card");
  if (Number(rateCount[0].n) === 0) {
    const rates = [
      ["Skilled", "Plumber, pump operator, electrician, fire fighting operator, STP operator, carpenter", 1311.9],
      ["Semi-skilled", "Sewer man", 1203.6],
      ["Unskilled", "Helper, sweeper. Allowance 1 is dress allowance. Allowance 2 is labour cess.", 1127.49],
    ];
    for (const rate of rates) {
      await pool.query("INSERT INTO rate_card (skill, trades, gross_daily_rate) VALUES (?, ?, ?)", rate);
    }
  }

  const [orderCount] = await pool.query("SELECT COUNT(*) AS n FROM contract_orders");
  if (Number(orderCount[0].n) === 0) {
    const party = await ensureParty(pool, "29 SCG, NSG, New Town", "Team Commander (Civil)");
    await pool.query(
      `INSERT INTO contract_orders
        (client_id, department_id, contract_type, work_name, agreement_no, bill_number, gross_amount, start_actual, completion_actual)
       VALUES (?, ?, 'A', ?, ?, ?, ?, ?, ?)`,
      [
        party.clientId,
        party.departmentId,
        "ARMO of residential and non residential buildings at 29 SCG NSG Kolkata 2024-25 (SH. Providing of Labour Services).",
        "GEMC-511687725998138",
        "CB/NK/25-26/211",
        763705.24,
        "2026-02-01",
        "2026-02-28",
      ],
    );
  }

  const [invoiceCount] = await pool.query("SELECT COUNT(*) AS n FROM invoices");
  if (Number(invoiceCount[0].n) === 0) {
    const [orders] = await pool.query("SELECT id FROM contract_orders WHERE agreement_no = ?", ["GEMC-511687725998138"]);
    if (orders.length) {
      await pool.query(
        `INSERT INTO invoices
          (contract_id, invoice_no, period_from, period_to, buyer_name, man_days, line_total, basic_amount, cgst, sgst, round_off, say_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orders[0].id, "CB/NK/25-26/211", "2026-02-01", "2026-02-28", "Team Commander (Civil)", 612, 763705.24, 647207.83, 58248.7, 58248.7, -0.23, 763705],
      );
    }
  }

  const [rateRows] = await pool.query("SELECT COUNT(*) AS n FROM statutory_rates");
  if (Number(rateRows[0].n) === 0) {
    await pool.query(
      `INSERT INTO statutory_rates (effective_from, pf_percent, pf_ceiling, esi_employee_percent, esi_wage_limit)
       VALUES ('2026-01-01', 12, 15000, 0.75, 21000)`,
    );
  }

  const [close] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payroll_close WHERE month_key = '2026-08'");
  const augustPay = Number(close[0].total);
  if (augustPay) {
    await pool.query(
      `INSERT INTO ledger_entries (entry_kind, source_ref, narration, amount)
       VALUES ('disbursement', 'AUG-2026', 'August pay close: actual total, Dilip, and IIFT travel allowance', ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), narration = VALUES(narration)`,
      [augustPay],
    );
  }
  const [bills] = await pool.query("SELECT invoice_no, say_total FROM invoices WHERE say_total IS NOT NULL");
  for (const bill of bills) {
    await pool.query(
      `INSERT INTO ledger_entries (entry_kind, source_ref, narration, amount)
       VALUES ('client_bill', ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), narration = VALUES(narration)`,
      [bill.invoice_no, `Client bill ${bill.invoice_no}`, Number(bill.say_total)],
    );
  }

  const contractSql = `
    SELECT o.*, c.party_name, d.name AS department_name
    FROM contract_orders o
    JOIN clients c ON c.id = o.client_id
    JOIN departments d ON d.id = o.department_id
  `;

  app.get("/api/companies", async (req, res) => {
    if (req.auth?.role !== "super_admin") {
      return res.status(403).json({ error: "Only the super admin can view all companies." });
    }
    const [rows] = await pool.query(
      `SELECT c.id, c.legal_name, c.short_name, c.code, c.gstin, c.state_name, c.state_code, c.sac,
              (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) AS people
       FROM company c
       ORDER BY IF(FIELD(c.code, 'origin', 'nk', 'oss', 'tm') = 0, 99, FIELD(c.code, 'origin', 'nk', 'oss', 'tm')), c.id`,
    );
    res.json(rows.map(companyRecord));
  });

  app.post("/api/companies", async (req, res) => {
    if (req.auth?.role !== "super_admin") {
      return res.status(403).json({ error: "Only the super admin can register a company." });
    }
    const legalName = String(req.body.legalName || "").trim();
    const shortName = String(req.body.shortName || "").trim();
    if (!legalName || !shortName) return res.status(400).json({ error: "Enter the legal name and the short name." });
    const code = companyCode(shortName);
    if (!code) return res.status(400).json({ error: "Enter a short name." });
    const [dup] = await pool.query("SELECT id FROM company WHERE code = ?", [code]);
    if (dup.length) return res.status(400).json({ error: "That company is already registered." });
    const [max] = await pool.query("SELECT COALESCE(MAX(id), 0) AS n FROM company");
    const id = Number(max[0].n) + 1;
    await pool.query(
      `INSERT INTO company (id, legal_name, short_name, code, gstin, state_name, state_code, sac)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, legalName, shortName, code, text(req.body.gstin), text(req.body.stateName), text(req.body.stateCode), text(req.body.sac)],
    );
    res.status(201).json({
      id,
      legalName,
      shortName,
      code,
      gstin: text(req.body.gstin) || "",
      stateName: text(req.body.stateName) || "",
      stateCode: text(req.body.stateCode) || "",
      sac: text(req.body.sac) || "",
      people: 0,
    });
  });

  app.get("/api/home", async (req, res) => {
    const companyId = companyIdFrom(req);
    const [company] = await pool.query("SELECT legal_name, short_name, gstin, state_name, state_code, sac FROM company WHERE id = ?", [companyId]);
    const [people] = await pool.query("SELECT COUNT(*) AS n FROM employees WHERE company_id = ?", [companyId]);
    const [ledger] = await pool.query("SELECT entry_kind, amount FROM ledger_entries WHERE company_id = ?", [companyId]);
    const [orders] = await pool.query(`${contractSql} WHERE o.company_id = ? ORDER BY o.id`, [companyId]);
    const [closes] = companyId === 1
      ? await pool.query(
        "SELECT month_key, SUM(amount) AS total FROM payroll_close WHERE month_key IS NOT NULL GROUP BY month_key ORDER BY month_key DESC LIMIT 1",
      )
      : [[]];
    const sum = (kind) => ledger.filter((row) => row.entry_kind === kind).reduce((total, row) => total + Number(row.amount), 0);
    res.json({
      company: {
        legalName: company[0]?.legal_name || "",
        shortName: company[0]?.short_name || company[0]?.legal_name || "",
        gstin: company[0]?.gstin || "",
        stateName: company[0]?.state_name || "",
        stateCode: company[0]?.state_code || "",
        sac: company[0]?.sac || "",
      },
      people: Number(people[0].n),
      pay: closes.length ? Number(closes[0].total) : sum("disbursement"),
      payMonth: closes[0]?.month_key || null,
      clientBill: sum("client_bill"),
      material: sum("expense"),
      contracts: orders.map(mapContract),
    });
  });

  app.put("/api/company", async (req, res) => {
    const legalName = String(req.body.legalName ?? "").trim();
    if (!legalName) return res.status(400).json({ error: "Enter the company name." });
    const sac = text(req.body.sac);
    await pool.query(
      "UPDATE company SET legal_name = ?, gstin = ?, state_name = ?, state_code = ?, sac = ? WHERE id = ?",
      [legalName, text(req.body.gstin), text(req.body.stateName), text(req.body.stateCode), sac, companyIdFrom(req)],
    );
    res.json({ legalName, gstin: text(req.body.gstin) || "", stateName: text(req.body.stateName) || "", stateCode: text(req.body.stateCode) || "", sac: sac || "" });
  });

  app.get("/api/contracts", async (_req, res) => {
    const [orders] = await pool.query(`${contractSql} ORDER BY o.id`);
    res.json(orders.map(mapContract));
  });

  app.post("/api/contracts", async (req, res) => {
    const record = readContract(req.body);
    if (record.error) return res.status(400).json(record);
    const party = await ensureParty(pool, record.clientName, record.departmentName);
    try {
      const [result] = await pool.query(
        `INSERT INTO contract_orders (client_id, department_id, ${CONTRACT_COLUMNS}) VALUES (?, ?, ${CONTRACT_COLUMNS.split(",").map(() => "?").join(",")})`,
        [party.clientId, party.departmentId, ...contractValues(record)],
      );
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "That agreement number is already stored." });
      throw error;
    }
  });

  app.put("/api/contracts/:id", async (req, res) => {
    const id = Number(req.params.id);
    const [found] = await pool.query("SELECT id FROM contract_orders WHERE id = ?", [id]);
    if (!found.length) return res.status(404).json({ error: "That contract order is not stored." });
    const record = readContract(req.body);
    if (record.error) return res.status(400).json(record);
    const party = await ensureParty(pool, record.clientName, record.departmentName);
    try {
      await pool.query(
        `UPDATE contract_orders SET client_id = ?, department_id = ?, ${CONTRACT_COLUMNS.split(",").map((column) => `${column.trim()} = ?`).join(", ")} WHERE id = ?`,
        [party.clientId, party.departmentId, ...contractValues(record), id],
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "That agreement number is already stored." });
      throw error;
    }
    res.json({ id });
  });

  app.get("/api/rate-card", async (_req, res) => {
    const [rows] = await pool.query("SELECT skill, trades, gross_daily_rate FROM rate_card ORDER BY id");
    res.json(rows.map((row) => ({ skill: row.skill, trades: row.trades, rate: Number(row.gross_daily_rate) })));
  });

  app.get("/api/invoices", async (_req, res) => {
    const [invoices] = await pool.query(
      `SELECT i.*, o.agreement_no, o.contract_type, c.party_name, d.name AS department_name
       FROM invoices i
       JOIN contract_orders o ON o.id = i.contract_id
       JOIN clients c ON c.id = o.client_id
       JOIN departments d ON d.id = o.department_id
       ORDER BY i.id`,
    );
    const [lines] = await pool.query("SELECT id, invoice_id, trade, skill, man_days, rate, amount FROM invoice_lines ORDER BY id");
    res.json(invoices.map((invoice) => ({
      id: invoice.id,
      contractId: invoice.contract_id,
      invoiceNo: invoice.invoice_no,
      agreementNo: invoice.agreement_no,
      contractType: invoice.contract_type,
      clientName: invoice.party_name,
      departmentName: invoice.department_name,
      periodFrom: asDate(invoice.period_from),
      periodTo: asDate(invoice.period_to),
      buyerName: invoice.buyer_name || "",
      manDays: invoice.man_days === null ? null : Number(invoice.man_days),
      lineTotal: invoice.line_total === null ? null : Number(invoice.line_total),
      basicAmount: invoice.basic_amount === null ? null : Number(invoice.basic_amount),
      cgst: invoice.cgst === null ? null : Number(invoice.cgst),
      sgst: invoice.sgst === null ? null : Number(invoice.sgst),
      roundOff: invoice.round_off === null ? null : Number(invoice.round_off),
      sayTotal: invoice.say_total === null ? null : Number(invoice.say_total),
      tdsGst: invoice.tds_gst === null ? null : Number(invoice.tds_gst),
      tdsIncomeTax: invoice.tds_income_tax === null ? null : Number(invoice.tds_income_tax),
      lines: lines.filter((line) => line.invoice_id === invoice.id).map((line) => ({
        id: line.id,
        trade: line.trade,
        skill: line.skill,
        manDays: Number(line.man_days),
        rate: Number(line.rate),
        amount: Number(line.amount),
      })),
    })));
  });

  app.get("/api/invoices/:id/export", async (req, res) => {
    const format = String(req.query.format || "").toLowerCase();
    if (!["pdf", "word", "excel"].includes(format)) {
      return res.status(400).json({ error: "Choose PDF, Word, or Excel." });
    }
    const id = Number(req.params.id);
    const [invoices] = await pool.query(
      `SELECT i.*, o.agreement_no, c.party_name, d.name AS department_name
       FROM invoices i
       JOIN contract_orders o ON o.id = i.contract_id
       JOIN clients c ON c.id = o.client_id
       JOIN departments d ON d.id = o.department_id
       WHERE i.id = ?`,
      [id],
    );
    if (!invoices.length) return res.status(404).json({ error: "That bill is not stored." });
    const [lines] = await pool.query(
      "SELECT trade, skill, man_days, rate, amount FROM invoice_lines WHERE invoice_id = ? ORDER BY id",
      [id],
    );
    const [company] = await pool.query("SELECT legal_name, gstin, state_name, state_code, sac FROM company WHERE id = 1");
    const invoice = invoices[0];
    const file = await renderDocument(invoiceDocument({
      invoiceNo: invoice.invoice_no,
      agreementNo: invoice.agreement_no,
      buyerName: invoice.buyer_name || invoice.party_name,
      departmentName: invoice.department_name,
      periodFrom: asDate(invoice.period_from),
      periodTo: asDate(invoice.period_to),
      manDays: invoice.man_days === null ? null : Number(invoice.man_days),
      lineTotal: invoice.line_total === null ? null : Number(invoice.line_total),
      basicAmount: invoice.basic_amount === null ? null : Number(invoice.basic_amount),
      cgst: invoice.cgst === null ? null : Number(invoice.cgst),
      sgst: invoice.sgst === null ? null : Number(invoice.sgst),
      roundOff: invoice.round_off === null ? null : Number(invoice.round_off),
      sayTotal: invoice.say_total === null ? null : Number(invoice.say_total),
      tdsGst: invoice.tds_gst === null ? null : Number(invoice.tds_gst),
      tdsIncomeTax: invoice.tds_income_tax === null ? null : Number(invoice.tds_income_tax),
      lines: lines.map((line) => ({
        trade: line.trade,
        skill: line.skill,
        manDays: Number(line.man_days),
        rate: Number(line.rate),
        amount: Number(line.amount),
      })),
    }, {
      legalName: company[0]?.legal_name || "",
      gstin: company[0]?.gstin || "",
      stateName: company[0]?.state_name || "",
      stateCode: company[0]?.state_code || "",
      sac: company[0]?.sac || "",
    }), format);
    res.setHeader("Content-Type", file.type);
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(file.buffer);
  });

  app.post("/api/invoices/:id/lines", async (req, res) => {
    const invoiceId = Number(req.params.id);
    const [found] = await pool.query(
      `SELECT i.id, o.contract_type FROM invoices i JOIN contract_orders o ON o.id = i.contract_id WHERE i.id = ?`,
      [invoiceId],
    );
    if (!found.length) return res.status(404).json({ error: "That bill is not stored." });
    if (found[0].contract_type === "C") return res.status(400).json({ error: "An office contract cannot raise a client bill." });
    const trade = String(req.body.trade ?? "").trim();
    const skill = String(req.body.skill ?? "").trim();
    const manDays = money(req.body.manDays);
    if (!trade) return res.status(400).json({ error: "Enter the trade." });
    if (!Number.isFinite(manDays) || manDays < 0) return res.status(400).json({ error: "Enter the man-days." });
    const [card] = await pool.query("SELECT gross_daily_rate FROM rate_card WHERE skill = ?", [skill]);
    if (!card.length) return res.status(400).json({ error: "Choose a skill from the rate card." });
    const rate = Number(card[0].gross_daily_rate);
    const amount = Math.round(manDays * rate * 100) / 100;
    const [result] = await pool.query(
      "INSERT INTO invoice_lines (invoice_id, trade, skill, man_days, rate, amount) VALUES (?, ?, ?, ?, ?, ?)",
      [invoiceId, trade, skill, manDays, rate, amount],
    );
    res.status(201).json({ id: result.insertId, trade, skill, manDays, rate, amount });
  });

  app.get("/api/purchases", async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT p.id, p.item_name, p.vendor_name, p.amount, p.contract_id, o.agreement_no
       FROM purchases p
       LEFT JOIN contract_orders o ON o.id = p.contract_id
       ORDER BY p.id`,
    );
    res.json(rows.map((row) => ({
      id: row.id,
      itemName: row.item_name,
      vendorName: row.vendor_name,
      amount: Number(row.amount),
      contractId: row.contract_id,
      agreementNo: row.agreement_no || "",
    })));
  });

  app.post("/api/purchases", async (req, res) => {
    const itemName = String(req.body.itemName ?? "").trim();
    const vendorName = String(req.body.vendorName ?? "").trim();
    const amount = money(req.body.amount);
    const contractId = req.body.contractId === "" || req.body.contractId == null ? null : Number(req.body.contractId);
    if (!itemName) return res.status(400).json({ error: "Enter the item." });
    if (!vendorName) return res.status(400).json({ error: "Enter the vendor." });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Enter the amount." });
    if (contractId !== null) {
      const [order] = await pool.query("SELECT id, contract_type, agreement_no FROM contract_orders WHERE id = ?", [contractId]);
      if (!order.length) return res.status(400).json({ error: "That work is not stored." });
      if (order[0].contract_type !== "B") return res.status(400).json({ error: "Tag material to a works contract. A manpower order and an office order do not take a material line." });
    }
    const [result] = await pool.query(
      "INSERT INTO purchases (item_name, vendor_name, amount, contract_id) VALUES (?, ?, ?, ?)",
      [itemName, vendorName, amount, contractId],
    );
    await pool.query(
      `INSERT INTO ledger_entries (entry_kind, source_ref, narration, amount)
       VALUES ('expense', ?, ?, ?)`,
      [`PUR-${result.insertId}`, itemName, amount],
    );
    res.status(201).json({ id: result.insertId });
  });

  app.delete("/api/purchases/:id", async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.query("DELETE FROM purchases WHERE id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "That purchase is not stored." });
    await pool.query("DELETE FROM ledger_entries WHERE entry_kind = 'expense' AND source_ref = ?", [`PUR-${id}`]);
    res.status(204).end();
  });

  app.get("/api/ledger", async (_req, res) => {
    const [rows] = await pool.query("SELECT id, entry_kind, source_ref, narration, amount FROM ledger_entries ORDER BY id");
    res.json(rows.map((row) => ({
      id: row.id,
      kind: row.entry_kind,
      sourceRef: row.source_ref,
      narration: row.narration,
      amount: Number(row.amount),
    })));
  });

  app.get("/api/statutory", async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT pf_percent, pf_ceiling, esi_employee_percent, esi_wage_limit FROM statutory_rates ORDER BY effective_from DESC LIMIT 1",
    );
    const row = rows[0];
    res.json({
      pfPercent: Number(row.pf_percent),
      pfCeiling: Number(row.pf_ceiling),
      esiEmployeePercent: Number(row.esi_employee_percent),
      esiWageLimit: Number(row.esi_wage_limit),
    });
  });
}
