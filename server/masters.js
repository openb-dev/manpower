function clean(value) {
  return String(value ?? "").trim();
}

async function listNamed(pool, table) {
  const [rows] = await pool.query(
    `SELECT id, name FROM \`${table}\` WHERE deleted_at IS NULL ORDER BY name`,
  );
  return rows;
}

function namedRoutes(app, pool, table, path, label) {
  app.get(path, async (_req, res) => {
    if (table === "designation") {
      const [full] = await pool.query(
        "SELECT id, name, skill FROM designation WHERE deleted_at IS NULL ORDER BY name",
      );
      return res.json(full.map((row) => ({ id: row.id, name: row.name, skill: row.skill || "" })));
    }
    const rows = await listNamed(pool, table);
    res.json(rows.map((row) => ({ id: row.id, name: row.name })));
  });

  app.post(path, async (req, res) => {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ error: `Enter the ${label}.` });
    const [existing] = await pool.query(
      `SELECT id FROM \`${table}\` WHERE name = ? AND deleted_at IS NULL`,
      [name],
    );
    if (existing.length) return res.status(400).json({ error: `That ${label} is already stored.` });
    if (table === "designation") {
      const skill = clean(req.body.skill);
      const [result] = await pool.query(
        "INSERT INTO designation (company_id, name, skill) VALUES (1, ?, ?)",
        [name, skill || null],
      );
      return res.status(201).json({ id: result.insertId, name, skill });
    }
    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (company_id, name) VALUES (1, ?)`,
      [name],
    );
    res.status(201).json({ id: result.insertId, name });
  });

  app.delete(`${path}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      `UPDATE \`${table}\` SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: `That ${label} is not stored.` });
    res.status(204).end();
  });
}

export function registerMasters(app, pool) {
  namedRoutes(app, pool, "site", "/api/sites", "site");
  namedRoutes(app, pool, "designation", "/api/designations", "designation");
  namedRoutes(app, pool, "vendor", "/api/vendors", "vendor");

  app.get("/api/departments", async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, c.party_name
       FROM departments d
       JOIN clients c ON c.id = d.client_id
       ORDER BY c.party_name, d.name`,
    );
    res.json(rows.map((row) => ({ id: row.id, name: row.name, clientName: row.party_name })));
  });

  app.post("/api/departments", async (req, res) => {
    const clientName = clean(req.body.clientName);
    const name = clean(req.body.name);
    if (!clientName) return res.status(400).json({ error: "Enter the client." });
    if (!name) return res.status(400).json({ error: "Enter the department." });
    const [clients] = await pool.query("SELECT id FROM clients WHERE party_name = ?", [clientName]);
    const clientId = clients.length
      ? clients[0].id
      : (await pool.query("INSERT INTO clients (party_name) VALUES (?)", [clientName]))[0].insertId;
    const [existing] = await pool.query(
      "SELECT id FROM departments WHERE client_id = ? AND name = ?",
      [clientId, name],
    );
    if (existing.length) return res.status(400).json({ error: "That department is already stored." });
    const [result] = await pool.query(
      "INSERT INTO departments (client_id, name) VALUES (?, ?)",
      [clientId, name],
    );
    res.status(201).json({ id: result.insertId, name, clientName });
  });
}
