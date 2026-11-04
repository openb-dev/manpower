import { monthKey, monthLabel } from "./months.js";
import { payslipPdf } from "./payslip.js";

function text(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function moneyOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const amount = Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(amount)) return { error: "Enter the amount as a number." };
  return amount;
}

function asDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function dateOrNull(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { error: "Enter the date as YYYY-MM-DD." };
  return trimmed;
}

async function ledger(pool, kind, source, narration, amount) {
  if (amount === null) {
    await pool.query("DELETE FROM ledger_entries WHERE entry_kind = ? AND source_ref = ?", [kind, source]);
    return;
  }
  await pool.query(
    `INSERT INTO ledger_entries (entry_kind, source_ref, narration, amount)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount), narration = VALUES(narration)`,
    [kind, source, narration, amount],
  );
}

export function registerFinish(app, pool) {
  app.get("/api/employees/:id/payslip", async (req, res) => {
    const month = monthKey(req.query.month);
    const id = Number(req.params.id);
    if (!month) return res.status(400).json({ error: "Choose the month." });
    const [rows] = await pool.query(
      `SELECT e.name, e.trade,
              COALESCE(p.salary, e.salary) AS salary,
              COALESCE(p.divisor, e.divisor) AS divisor,
              p.attendance, COALESCE(p.deduct, 0) AS deduct, p.payment_done
       FROM employees e
       LEFT JOIN payroll_lines p ON p.employee_id = e.id AND p.month_key = ?
       WHERE e.id = ?`,
      [month, id],
    );
    if (!rows.length) return res.status(404).json({ error: "That person is not in the employee book." });
    const [company] = await pool.query("SELECT legal_name FROM company WHERE id = 1");
    const person = rows[0];
    const buffer = await payslipPdf({
      company: company[0]?.legal_name,
      month,
      person: {
        name: person.name,
        trade: person.trade || "",
        salary: person.salary === null ? null : Number(person.salary),
        divisor: Number(person.divisor),
        attendance: person.attendance === null ? null : Number(person.attendance),
        deduct: Number(person.deduct || 0),
        paymentDone: person.payment_done === null ? null : Number(person.payment_done),
      },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${id}-${month}.pdf"`);
    res.send(buffer);
  });

  app.get("/api/work-register/:contractId", async (req, res) => {
    const contractId = Number(req.params.contractId);
    const [rows] = await pool.query("SELECT * FROM work_register WHERE contract_id = ? ORDER BY id DESC LIMIT 1", [contractId]);
    const row = rows[0];
    if (!row) return res.json(null);
    const date = (value) => asDate(value);
    res.json({
      id: row.id,
      contractId: row.contract_id,
      measurementBookNo: row.measurement_book_no || "",
      lcc: row.lcc || "",
      billNo: row.bill_no || "",
      startDate: date(row.start_date),
      completionDate: date(row.completion_date),
      grossAmount: row.gross_amount === null ? "" : Number(row.gross_amount),
      netAmount: row.net_amount === null ? "" : Number(row.net_amount),
      voucherNo: row.voucher_no || "",
      bankReceivedDate: date(row.bank_received_date),
      performanceGuarantee: row.performance_guarantee === null ? "" : Number(row.performance_guarantee),
      earnestMoney: row.earnest_money === null ? "" : Number(row.earnest_money),
      labourWelfareCess: row.labour_welfare_cess === null ? "" : Number(row.labour_welfare_cess),
      gstAmount: row.gst_amount === null ? "" : Number(row.gst_amount),
      incomeTax: row.income_tax === null ? "" : Number(row.income_tax),
      securityDeposit: row.security_deposit === null ? "" : Number(row.security_deposit),
      esiPf: row.esi_pf === null ? "" : Number(row.esi_pf),
      waterCharge: row.water_charge === null ? "" : Number(row.water_charge),
      otherWithheld: row.other_withheld === null ? "" : Number(row.other_withheld),
      remarks: row.remarks || "",
    });
  });

  app.put("/api/work-register/:contractId", async (req, res) => {
    const contractId = Number(req.params.contractId);
    const [orders] = await pool.query("SELECT contract_type, work_name, agreement_no FROM contract_orders WHERE id = ?", [contractId]);
    if (!orders.length) return res.status(404).json({ error: "That contract is not stored." });
    if (orders[0].contract_type !== "B") return res.status(400).json({ error: "The work register is for a works contract." });
    const amounts = {};
    for (const key of ["grossAmount", "netAmount", "performanceGuarantee", "earnestMoney", "labourWelfareCess", "gstAmount", "incomeTax", "securityDeposit", "esiPf", "waterCharge", "otherWithheld"]) {
      const amount = moneyOrNull(req.body[key]);
      if (amount?.error) return res.status(400).json(amount);
      amounts[key] = amount;
    }
    const startDate = dateOrNull(req.body.startDate);
    const completionDate = dateOrNull(req.body.completionDate);
    const bankReceivedDate = dateOrNull(req.body.bankReceivedDate);
    if (startDate?.error) return res.status(400).json(startDate);
    if (completionDate?.error) return res.status(400).json(completionDate);
    if (bankReceivedDate?.error) return res.status(400).json(bankReceivedDate);
    const values = [
      orders[0].work_name, orders[0].agreement_no, text(req.body.measurementBookNo), text(req.body.lcc), text(req.body.billNo),
      startDate, completionDate, amounts.grossAmount, amounts.netAmount, text(req.body.voucherNo), bankReceivedDate,
      amounts.performanceGuarantee, amounts.earnestMoney, amounts.labourWelfareCess, amounts.gstAmount, amounts.incomeTax,
      amounts.securityDeposit, amounts.esiPf, amounts.waterCharge, amounts.otherWithheld, text(req.body.remarks), contractId,
    ];
    const [existing] = await pool.query("SELECT id FROM work_register WHERE contract_id = ?", [contractId]);
    if (existing.length) {
      await pool.query(
        `UPDATE work_register SET work_name=?, agreement_no=?, measurement_book_no=?, lcc=?, bill_no=?, start_date=?, completion_date=?,
          gross_amount=?, net_amount=?, voucher_no=?, bank_received_date=?, performance_guarantee=?, earnest_money=?, labour_welfare_cess=?,
          gst_amount=?, income_tax=?, security_deposit=?, esi_pf=?, water_charge=?, other_withheld=?, remarks=? WHERE contract_id=?`,
        values,
      );
    } else {
      await pool.query(
        `INSERT INTO work_register (company_id, work_name, agreement_no, measurement_book_no, lcc, bill_no, start_date, completion_date,
          gross_amount, net_amount, voucher_no, bank_received_date, performance_guarantee, earnest_money, labour_welfare_cess,
          gst_amount, income_tax, security_deposit, esi_pf, water_charge, other_withheld, remarks, contract_id)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      );
    }
    res.json({ contractId });
  });

  app.put("/api/invoices/:id/tds", async (req, res) => {
    const id = Number(req.params.id);
    const [invoices] = await pool.query("SELECT id, invoice_no FROM invoices WHERE id = ?", [id]);
    if (!invoices.length) return res.status(404).json({ error: "That bill is not stored." });
    const tdsGst = moneyOrNull(req.body.tdsGst);
    const tdsIncomeTax = moneyOrNull(req.body.tdsIncomeTax);
    if (tdsGst?.error) return res.status(400).json({ error: "Enter TDS on GST as a number, or leave it blank." });
    if (tdsIncomeTax?.error) return res.status(400).json({ error: "Enter TDS on income tax as a number, or leave it blank." });
    await pool.query("UPDATE invoices SET tds_gst = ?, tds_income_tax = ? WHERE id = ?", [tdsGst, tdsIncomeTax, id]);
    const no = invoices[0].invoice_no;
    await ledger(pool, "tds_gst", `TDS-GST-${no}`, `TDS on GST ${no}`, tdsGst);
    await ledger(pool, "tds_income_tax", `TDS-IT-${no}`, `TDS on income tax ${no}`, tdsIncomeTax);
    res.json({ id, tdsGst, tdsIncomeTax });
  });

  app.get("/api/receipts", async (req, res) => {
    const invoiceId = Number(req.query.invoiceId);
    const [rows] = await pool.query(
      "SELECT id, invoice_id, received_on, amount FROM receipt WHERE invoice_id = ? ORDER BY id",
      [invoiceId],
    );
    res.json(rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      receivedOn: asDate(row.received_on),
      amount: Number(row.amount),
    })));
  });

  app.post("/api/receipts", async (req, res) => {
    const invoiceId = Number(req.body.invoiceId);
    const amount = moneyOrNull(req.body.amount);
    const receivedOn = dateOrNull(req.body.receivedOn);
    if (!invoiceId) return res.status(400).json({ error: "Choose the bill." });
    if (amount?.error || amount === null) return res.status(400).json({ error: "Enter the amount received." });
    if (receivedOn?.error) return res.status(400).json(receivedOn);
    const [invoices] = await pool.query("SELECT invoice_no FROM invoices WHERE id = ?", [invoiceId]);
    if (!invoices.length) return res.status(404).json({ error: "That bill is not stored." });
    const [result] = await pool.query(
      "INSERT INTO receipt (company_id, invoice_id, received_on, amount) VALUES (1, ?, ?, ?)",
      [invoiceId, receivedOn, amount],
    );
    await ledger(pool, "receipt", `RCT-${result.insertId}`, `Received on ${invoices[0].invoice_no}`, amount);
    res.status(201).json({ id: result.insertId });
  });

  app.get("/api/returns", async (req, res) => {
    const month = monthKey(req.query.month);
    const [rows] = month
      ? await pool.query(
        "SELECT id, return_kind, period_year, period_month, status_name FROM statutory_return WHERE period_year = ? AND period_month = ? ORDER BY id",
        [Number(month.slice(0, 4)), Number(month.slice(5))],
      )
      : await pool.query("SELECT id, return_kind, period_year, period_month, status_name FROM statutory_return ORDER BY period_year DESC, period_month DESC, id DESC LIMIT 50");
    res.json(rows.map((row) => ({
      id: row.id,
      kind: row.return_kind,
      month: `${row.period_year}-${String(row.period_month).padStart(2, "0")}`,
      status: row.status_name,
    })));
  });

  app.post("/api/returns", async (req, res) => {
    const month = monthKey(req.body.month);
    const kind = String(req.body.kind ?? "").trim();
    const status = String(req.body.status ?? "").trim();
    if (!month) return res.status(400).json({ error: "Choose the month." });
    if (!["PF", "ESI", "GST", "TDS"].includes(kind)) return res.status(400).json({ error: "Choose PF, ESI, GST, or TDS." });
    if (!["Pending", "Filed"].includes(status)) return res.status(400).json({ error: "Choose Pending or Filed." });
    const year = Number(month.slice(0, 4));
    const periodMonth = Number(month.slice(5));
    const [existing] = await pool.query(
      "SELECT id FROM statutory_return WHERE return_kind = ? AND period_year = ? AND period_month = ?",
      [kind, year, periodMonth],
    );
    if (existing.length) {
      await pool.query("UPDATE statutory_return SET status_name = ? WHERE id = ?", [status, existing[0].id]);
      return res.json({ id: existing[0].id, kind, month, status });
    }
    const [result] = await pool.query(
      "INSERT INTO statutory_return (company_id, return_kind, period_year, period_month, status_name) VALUES (1, ?, ?, ?, ?)",
      [kind, year, periodMonth, status],
    );
    res.status(201).json({ id: result.insertId, kind, month, status });
  });

  app.get("/api/expenses", async (_req, res) => {
    const [rows] = await pool.query("SELECT id, spent_on, narration, amount FROM office_expense ORDER BY id DESC");
    res.json(rows.map((row) => ({
      id: row.id,
      spentOn: asDate(row.spent_on),
      narration: row.narration,
      amount: Number(row.amount),
    })));
  });

  app.post("/api/expenses", async (req, res) => {
    const narration = text(req.body.narration);
    const amount = moneyOrNull(req.body.amount);
    const spentOn = dateOrNull(req.body.spentOn);
    if (!narration) return res.status(400).json({ error: "Enter what the money was for." });
    if (amount?.error || amount === null) return res.status(400).json({ error: "Enter the amount." });
    if (spentOn?.error) return res.status(400).json(spentOn);
    const [result] = await pool.query(
      "INSERT INTO office_expense (company_id, spent_on, narration, amount) VALUES (1, ?, ?, ?)",
      [spentOn, narration, amount],
    );
    await ledger(pool, "office", `OFF-${result.insertId}`, narration, amount);
    res.status(201).json({ id: result.insertId });
  });

  app.get("/api/purchase-orders", async (_req, res) => {
    const [orders] = await pool.query(
      `SELECT o.id, o.order_date, o.contract_id, v.name AS vendor_name, c.agreement_no,
              (SELECT COUNT(*) FROM goods_receipt g WHERE g.purchase_order_id = o.id) AS receipts
       FROM purchase_order o
       JOIN vendor v ON v.id = o.vendor_id
       LEFT JOIN contract_orders c ON c.id = o.contract_id
       WHERE o.deleted_at IS NULL
       ORDER BY o.id DESC`,
    );
    const [lines] = await pool.query("SELECT purchase_order_id, item_name, quantity, amount FROM purchase_line ORDER BY id");
    res.json(orders.map((order) => ({
      id: order.id,
      orderDate: asDate(row.order_date),
      vendorName: order.vendor_name,
      agreementNo: order.agreement_no || "",
      received: Number(order.receipts) > 0,
      lines: lines.filter((line) => line.purchase_order_id === order.id).map((line) => ({
        itemName: line.item_name,
        quantity: line.quantity === null ? null : Number(line.quantity),
        amount: Number(line.amount),
      })),
    })));
  });

  app.post("/api/purchase-orders", async (req, res) => {
    const vendorId = Number(req.body.vendorId);
    const contractId = req.body.contractId ? Number(req.body.contractId) : null;
    const itemName = text(req.body.itemName);
    const quantity = moneyOrNull(req.body.quantity);
    const amount = moneyOrNull(req.body.amount);
    const orderDate = dateOrNull(req.body.orderDate);
    if (!vendorId) return res.status(400).json({ error: "Choose the vendor." });
    if (!itemName) return res.status(400).json({ error: "Enter the item." });
    if (amount?.error || amount === null) return res.status(400).json({ error: "Enter the amount." });
    if (quantity?.error) return res.status(400).json({ error: "Enter the quantity as a number, or leave it blank." });
    if (orderDate?.error) return res.status(400).json(orderDate);
    const [vendors] = await pool.query("SELECT id FROM vendor WHERE id = ? AND deleted_at IS NULL", [vendorId]);
    if (!vendors.length) return res.status(400).json({ error: "That vendor is not stored. Add the vendor in Masters." });
    if (contractId) {
      const [orders] = await pool.query("SELECT contract_type FROM contract_orders WHERE id = ?", [contractId]);
      if (!orders.length || orders[0].contract_type !== "B") {
        return res.status(400).json({ error: "Tag the order to a works contract, or leave the work blank." });
      }
    }
    const [result] = await pool.query(
      "INSERT INTO purchase_order (company_id, vendor_id, contract_id, order_date) VALUES (1, ?, ?, ?)",
      [vendorId, contractId, orderDate],
    );
    await pool.query(
      "INSERT INTO purchase_line (company_id, purchase_order_id, item_name, quantity, amount) VALUES (1, ?, ?, ?, ?)",
      [result.insertId, itemName, quantity, amount],
    );
    res.status(201).json({ id: result.insertId });
  });

  app.post("/api/purchase-orders/:id/receipt", async (req, res) => {
    const id = Number(req.params.id);
    const receivedOn = dateOrNull(req.body.receivedOn);
    if (receivedOn?.error) return res.status(400).json(receivedOn);
    const [orders] = await pool.query(
      `SELECT o.id, o.contract_id, v.name AS vendor_name
       FROM purchase_order o JOIN vendor v ON v.id = o.vendor_id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
      [id],
    );
    if (!orders.length) return res.status(404).json({ error: "That purchase order is not stored." });
    const [already] = await pool.query("SELECT id FROM goods_receipt WHERE purchase_order_id = ?", [id]);
    if (already.length) return res.status(400).json({ error: "Those goods are already marked received." });
    const [lines] = await pool.query("SELECT item_name, amount FROM purchase_line WHERE purchase_order_id = ?", [id]);
    const amount = lines.reduce((sum, line) => sum + Number(line.amount), 0);
    const itemName = lines.map((line) => line.item_name).join(", ");
    await pool.query(
      "INSERT INTO goods_receipt (company_id, purchase_order_id, received_on, remarks) VALUES (1, ?, ?, ?)",
      [id, receivedOn, text(req.body.remarks)],
    );
    const [purchase] = await pool.query(
      "INSERT INTO purchases (item_name, vendor_name, amount, contract_id) VALUES (?, ?, ?, ?)",
      [itemName, orders[0].vendor_name, amount, orders[0].contract_id],
    );
    await ledger(pool, "expense", `PO-${id}`, itemName, amount);
    res.status(201).json({ id, purchaseId: purchase.insertId, amount });
  });

  app.get("/api/licences", async (_req, res) => {
    const [rows] = await pool.query("SELECT id, licence_kind, licence_no, issued_on, expires_on FROM licence ORDER BY id");
    res.json(rows.map((row) => ({
      id: row.id,
      kind: row.licence_kind,
      licenceNo: row.licence_no || "",
      issuedOn: asDate(row.issued_on),
      expiresOn: asDate(row.expires_on),
    })));
  });

  app.post("/api/licences", async (req, res) => {
    const kind = text(req.body.kind);
    if (!kind) return res.status(400).json({ error: "Enter the licence type." });
    const issuedOn = dateOrNull(req.body.issuedOn);
    const expiresOn = dateOrNull(req.body.expiresOn);
    if (issuedOn?.error || expiresOn?.error) return res.status(400).json({ error: "Enter the dates as YYYY-MM-DD, or leave them blank." });
    const [result] = await pool.query(
      "INSERT INTO licence (company_id, licence_kind, licence_no, issued_on, expires_on) VALUES (1, ?, ?, ?, ?)",
      [kind, text(req.body.licenceNo), issuedOn, expiresOn],
    );
    res.status(201).json({ id: result.insertId });
  });

  app.get("/api/audit", async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.entity_name, a.action_name, a.created_at, u.name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.id DESC LIMIT 80`,
    );
    res.json(rows.map((row) => ({
      id: row.id,
      who: row.name || "",
      action: row.action_name,
      what: row.entity_name,
      at: row.created_at instanceof Date
        ? row.created_at.toISOString().slice(0, 16).replace("T", " ")
        : String(row.created_at || "").slice(0, 16),
    })));
  });

  app.get("/api/backup", async (req, res) => {
    if (req.auth?.role !== "super_admin" && req.auth?.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can download the backup." });
    }
    const tables = ["employees", "payroll_lines", "payroll_close", "contract_orders", "invoices", "ledger_entries", "purchases", "deployment", "office_expense", "work_register", "statutory_return", "licence"];
    const dump = {};
    for (const table of tables) {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      dump[table] = rows;
    }
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="nk-backup-${day}.json"`);
    res.send(JSON.stringify(dump));
  });
}

export { monthLabel };
