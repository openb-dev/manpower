import { monthKey } from "./months.js";

function daysOf(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const amount = Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the days as a number." };
  return amount;
}

export function registerDeployment(app, pool) {
  app.get("/api/deployments", async (req, res) => {
    const month = monthKey(req.query.month);
    const contractId = Number(req.query.contractId);
    if (!month) return res.status(400).json({ error: "Choose the month." });
    if (!contractId) return res.status(400).json({ error: "Choose the contract." });
    const [rows] = await pool.query(
      `SELECT d.id, d.contract_id, d.employee_id, d.site_id, d.days_worked, d.month_key,
              e.name AS employee_name, s.name AS site_name
       FROM deployment d
       JOIN employees e ON e.id = d.employee_id
       LEFT JOIN site s ON s.id = d.site_id
       WHERE d.deleted_at IS NULL AND d.contract_id = ? AND d.month_key = ?
       ORDER BY e.name`,
      [contractId, month],
    );
    res.json(rows.map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      siteId: row.site_id,
      siteName: row.site_name || "",
      month: row.month_key,
      daysWorked: row.days_worked === null ? null : Number(row.days_worked),
    })));
  });

  app.post("/api/deployments", async (req, res) => {
    const month = monthKey(req.body.month);
    const contractId = Number(req.body.contractId);
    const employeeId = Number(req.body.employeeId);
    const siteId = Number(req.body.siteId);
    if (!month) return res.status(400).json({ error: "Choose the month." });
    if (!contractId) return res.status(400).json({ error: "Choose the contract." });
    if (!employeeId) return res.status(400).json({ error: "Choose the worker." });
    if (!siteId) return res.status(400).json({ error: "Choose the site." });
    const days = daysOf(req.body.daysWorked);
    if (days?.error) return res.status(400).json(days);
    const [orders] = await pool.query("SELECT contract_type FROM contract_orders WHERE id = ?", [contractId]);
    if (!orders.length) return res.status(404).json({ error: "That contract is not stored." });
    if (orders[0].contract_type !== "A") return res.status(400).json({ error: "Deployment is for a manpower contract." });
    const [people] = await pool.query("SELECT id, name FROM employees WHERE id = ?", [employeeId]);
    if (!people.length) return res.status(400).json({ error: "That worker is not stored." });
    const [sites] = await pool.query("SELECT id, name FROM site WHERE id = ? AND deleted_at IS NULL", [siteId]);
    if (!sites.length) return res.status(400).json({ error: "That site is not stored." });
    const [existing] = await pool.query(
      `SELECT id FROM deployment
       WHERE contract_id = ? AND employee_id = ? AND site_id = ? AND month_key = ? AND deleted_at IS NULL`,
      [contractId, employeeId, siteId, month],
    );
    let id = existing[0]?.id;
    if (id) {
      await pool.query("UPDATE deployment SET days_worked = ? WHERE id = ?", [days, id]);
    } else {
      const [result] = await pool.query(
        `INSERT INTO deployment (company_id, contract_id, employee_id, site_id, days_worked, month_key)
         VALUES (1, ?, ?, ?, ?, ?)`,
        [contractId, employeeId, siteId, days, month],
      );
      id = result.insertId;
    }
    res.status(existing.length ? 200 : 201).json({
      id,
      contractId,
      employeeId,
      employeeName: people[0].name,
      siteId,
      siteName: sites[0].name,
      month,
      daysWorked: days,
    });
  });

  app.delete("/api/deployments/:id", async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      "UPDATE deployment SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: "That deployment is not stored." });
    res.status(204).end();
  });
}
