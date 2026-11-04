import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { accessFor, moduleAllows } from "./core/access.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

async function passwordMatches(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(password, salt, 32);
  const left = Buffer.from(hash, "hex");
  if (left.length !== derived.length) return false;
  return timingSafeEqual(left, derived);
}

export async function registerAuth(app, pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role_name VARCHAR(40) NOT NULL,
      company_id INT NULL DEFAULT NULL,
      active TINYINT NOT NULL DEFAULT 1
    )
  `);
  await pool.query("ALTER TABLE users MODIFY company_id INT NULL DEFAULT NULL").catch(() => {});

  const accounts = [
    ["Global Super Admin", "admin@manpower.com", "Admin@12345", "super_admin", null, 1],
    ["N.K. Enterprise Admin", "admin@nk.com", "Admin@12345", "admin", 1, 1],
    ["N.K. Enterprise Admin", "admin@nkenterprise.com", "Admin@12345", "admin", 1, 1],
    ["Office Admin", "office@nkenterprise.com", "Office@12345", "admin", 1, 1],
    ["Office Admin", "office@nk.com", "Admin@12345", "admin", 1, 1],
    ["Accounts", "accounts@nkenterprise.com", "Accounts@12345", "accounts", 1, 1],
    ["Accounts", "accounts@nk.com", "Admin@12345", "accounts", 1, 1],
    ["HR", "hr@nkenterprise.com", "Hr@12345", "hr", 1, 1],
    ["HR", "hr@nk.com", "Admin@12345", "hr", 1, 1],
    ["Viewer", "viewer@nkenterprise.com", "Viewer@12345", "viewer", 1, 1],
    ["Viewer", "viewer@nk.com", "Admin@12345", "viewer", 1, 1],
    ["Origin Admin", "admin@origin.com", "Admin@12345", "admin", 2, 1],
    ["OSS Admin", "admin@oss.com", "Admin@12345", "admin", 3, 1],
    ["Trimurti Admin", "admin@trimurti.com", "Admin@12345", "admin", 4, 1],
    ["Inactive User", "inactive@nkenterprise.com", "Inactive@12345", "user", 1, 0],
  ];
  for (const [name, email, password, roleName, compId, active] of accounts) {
    const [found] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (found.length) {
      await pool.query(
        "UPDATE users SET name = ?, role_name = ?, company_id = ?, active = ? WHERE email = ?",
        [name, roleName, compId, active, email]
      );
      continue;
    }
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role_name, company_id, active) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, await hashPassword(password), roleName, compId, active],
    );
  }

  async function getCompanyForUser(companyId, role) {
    if (!companyId || role === "super_admin") return null;
    const [compRows] = await pool.query(
      `SELECT c.id, c.legal_name, c.short_name, c.code, c.gstin, c.state_name, c.state_code, c.sac,
              (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) AS people
       FROM company c WHERE c.id = ?`,
      [companyId]
    );
    if (!compRows.length) return null;
    const c = compRows[0];
    return {
      id: c.id,
      legalName: c.legal_name,
      shortName: c.short_name,
      code: c.code,
      gstin: c.gstin || "",
      stateName: c.state_name || "",
      stateCode: c.state_code || "",
      sac: c.sac || "",
      people: Number(c.people || 0),
    };
  }

  app.post("/api/login", async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    if (!email || !password) return res.status(400).json({ error: "Enter the email and the password." });

    const altEmail = email.endsWith("@nk.com")
      ? email.replace("@nk.com", "@nkenterprise.com")
      : email.endsWith("@nkenterprise.com")
      ? email.replace("@nkenterprise.com", "@nk.com")
      : email;

    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, role_name, company_id, active FROM users WHERE email = ? OR email = ?",
      [email, altEmail],
    );
    if (!rows.length || !(await passwordMatches(password, rows[0].password_hash))) {
      return res.status(401).json({ error: "That email or password is not correct." });
    }
    if (!rows[0].active) return res.status(403).json({ error: "This user is not active." });
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO session (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))",
      [token, rows[0].id],
    );
    const access = accessFor(rows[0].role_name);
    const company = await getCompanyForUser(rows[0].company_id, rows[0].role_name);
    res.json({
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role_name,
      company,
      token,
      modules: access.modules,
      canWrite: access.canWrite,
    });
  });

  app.get("/api/session", async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, email, role_name, company_id, active FROM users WHERE id = ?",
      [req.auth.userId],
    );
    if (!rows.length || !rows[0].active) return res.status(401).json({ error: "Sign in required." });
    const access = accessFor(rows[0].role_name);
    const company = await getCompanyForUser(rows[0].company_id, rows[0].role_name);
    res.json({
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role_name,
      company,
      modules: access.modules,
      canWrite: access.canWrite,
    });
  });

  app.post("/api/logout", async (req, res) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token) {
      await pool.query("DELETE FROM session WHERE token = ?", [token]).catch(() => {});
    }
    res.json({ ok: true });
  });
}

export function requireAuth(pool) {
  return async (req, res, next) => {
    if (
      req.originalUrl.startsWith("/api/login") ||
      req.originalUrl.startsWith("/api/apply") ||
      req.originalUrl.startsWith("/api/logout")
    ) return next();
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Sign in required." });
    const [rows] = await pool.query(
      `SELECT u.id, u.role_name, u.company_id, u.active
       FROM session s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token],
    );
    if (!rows.length || !rows[0].active) return res.status(401).json({ error: "Sign in required." });
    const access = accessFor(rows[0].role_name);
    if (!access.canWrite && req.method !== "GET" && req.method !== "HEAD") {
      return res.status(403).json({ error: "This role cannot change records." });
    }
    if (!moduleAllows(req.originalUrl, req.method, access.modules)) {
      return res.status(403).json({ error: "This role cannot open that page." });
    }
    req.auth = { userId: rows[0].id, role: rows[0].role_name, companyId: rows[0].company_id, ...access };
    next();
  };
}
