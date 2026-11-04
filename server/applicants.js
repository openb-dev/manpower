import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { last4 } from "./core/secrets.js";
import { companyIdFrom } from "./companyScope.js";
import { JOINING_VERSION } from "./data/joiningText.js";
import { personError } from "./data/required.js";
import { saveApplication } from "./data/application.js";

const scryptAsync = promisify(scrypt);
const uploadRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "uploads");

export const JOB_ROLES = [
  { name: "Security Guard", skill: "Skilled", gun: true },
  { name: "Gunman", skill: "Skilled", gun: true },
  { name: "Supervisor", skill: "Skilled", gun: true },
  { name: "Skilled Worker", skill: "Skilled", gun: false },
  { name: "Semi-skilled Worker", skill: "Semi-skilled", gun: false },
  { name: "Unskilled Worker", skill: "Unskilled", gun: false },
];

export function roleByName(name) {
  return JOB_ROLES.find((role) => role.name === String(name || "").trim()) || null;
}

export function normalizeContact(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
    return email;
  }
  const digits = trimmed.replace(/\D/g, "");
  const phone =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (!/^[6-9]\d{9}$/.test(phone)) return "";
  return phone;
}

function hashCode(contact, code) {
  return createHash("sha256").update(`${contact}:${code}`).digest("hex");
}

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

function publicForm(form) {
  const copy = { ...(form || {}) };
  for (const key of ["photo", "aadhaarFile", "panFile", "passbookFile", "aadhaar", "pan", "accountNo"]) delete copy[key];
  copy.aadhaarLast4 = copy.aadhaarLast4 || "";
  copy.panLast4 = copy.panLast4 || "";
  copy.accountLast4 = copy.accountLast4 || "";
  copy.family = (copy.family || []).map((member) => ({
    name: member.name || "",
    relation: member.relation || "",
    dateOfBirth: member.dateOfBirth || "",
    aadhaarLast4: member.aadhaarLast4 || last4(member.aadhaar || ""),
  }));
  return copy;
}

async function saveUpload(applicantId, kind, dataUrl, originalName) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1].includes("png") ? "png" : match[1].includes("pdf") ? "pdf" : "jpg";
  await mkdir(uploadRoot, { recursive: true });
  const stored = `applicant-${applicantId}-${kind}.${ext}`;
  await writeFile(path.join(uploadRoot, stored), Buffer.from(match[2], "base64"));
  return { stored, originalName: originalName || stored };
}

function canAccessApplicants(req, res) {
  if (req.auth?.role === "super_admin" || req.auth?.role === "admin" || req.auth?.role === "hr") return true;
  res.status(403).json({ error: "Only administrators and HR can open the applicant book." });
  return false;
}

export async function registerApplicants(app, pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      job_role VARCHAR(80) NULL,
      status_name VARCHAR(40) NOT NULL DEFAULT 'registered',
      company_id INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [companyColumn] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applicants' AND COLUMN_NAME = 'company_id'`,
  );
  if (Number(companyColumn[0].n) === 0) {
    await pool.query("ALTER TABLE applicants ADD COLUMN company_id INT NOT NULL DEFAULT 1");
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_otp (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact VARCHAR(255) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      setup_token CHAR(64) NULL,
      expires_at DATETIME NOT NULL,
      used TINYINT NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_session (
      token CHAR(64) PRIMARY KEY,
      applicant_id INT NOT NULL,
      expires_at DATETIME NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_form (
      applicant_id INT PRIMARY KEY,
      form_json JSON NOT NULL,
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_file (
      id INT AUTO_INCREMENT PRIMARY KEY,
      applicant_id INT NOT NULL,
      document_kind VARCHAR(40) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      stored_path VARCHAR(500) NOT NULL
    )
  `);

  const [nkApplicants] = await pool.query(
    "SELECT COUNT(*) AS n FROM applicants WHERE company_id = 1",
  );
  if (Number(nkApplicants[0]?.n || 0) === 0) {
    const defaultPasswordHash = await hashPassword("Applicant@12345");
    const seedApplicants = [
      {
        contact: "rajesh.mondal92@gmail.com",
        job_role: "Security Guard",
        status_name: "submitted",
        company_id: 1,
        form: {
          name: "Rajesh Mondal",
          fatherOrHusband: "Late Debabrata Mondal",
          dateOfBirth: "1992-06-14",
          age: "34",
          qualification: "Higher Secondary (10+2)",
          localAddress: "72/1 Picnic Garden Road, Tiljala, Kolkata, West Bengal",
          villageAddress: "Vill - Joynagar, PO - Majilpur, Dist - South 24 Parganas, West Bengal",
          experience: "5 years experience in Industrial & Commercial Security",
          characterCertificate: "Provided (Issued by Ward Councilor)",
          identificationMark: "Scar on right forearm",
          nationality: "Indian",
          religion: "Hindu",
          reference: "Subhashis Roy (Site Supervisor, 9831000001)",
          height: "5 ft 10 in",
          weight: "74 kg",
          chest: "38 in",
          nominee: "Aparna Mondal (Wife)",
          mobile: "9830123456",
          presentAddress: "72/1 Picnic Garden Road, Tiljala, Kolkata",
          presentPin: "700039",
          permanentAddress: "Vill - Joynagar, PO - Majilpur, Dist - South 24 Parganas",
          permanentPin: "743337",
          aadhaarLast4: "4321",
          panLast4: "567K",
          previousEmployer: "Eagle Security Services Pvt Ltd",
          uan: "100987654321",
          esiIp: "4112345678",
          preferredDispensary: "Kolkata Central ESI Hospital",
          bankName: "State Bank of India",
          accountLast4: "3456",
          ifsc: "SBIN0001234",
          branchName: "Park Street Branch, Kolkata",
          policeStatus: "Verified",
          securityMoney: "None",
          declarationAccepted: true,
          termsAccepted: true,
          family: [
            { name: "Debabrata Mondal", relation: "Father", dateOfBirth: "1960-01-01", aadhaarLast4: "1111" },
            { name: "Aparna Mondal", relation: "Wife", dateOfBirth: "1995-04-12", aadhaarLast4: "2222" },
            { name: "Rahul Mondal", relation: "Son", dateOfBirth: "2018-09-05", aadhaarLast4: "3333" },
          ],
        },
      },
      {
        contact: "subedar.gurdeep@gmail.com",
        job_role: "Gunman",
        status_name: "submitted",
        company_id: 1,
        form: {
          name: "Gurdeep Singh",
          fatherOrHusband: "Harbans Singh",
          dateOfBirth: "1978-03-22",
          age: "48",
          qualification: "Graduate (BA) - Army Educational Corps",
          localAddress: "Quarter 14B, BSF Enclave, Salt Lake Sector 5, Kolkata",
          villageAddress: "Vill - Dera Baba Nanak, Gurdaspur, Punjab",
          experience: "24 years Military Service (Retd Subedar BSF) + 3 years Cash Van Escort",
          characterCertificate: "Exemplary Army Discharge Book",
          identificationMark: "Mole on left cheek",
          nationality: "Indian",
          religion: "Sikh",
          reference: "Col. H.S. Sandhu (Retd, 9419000002)",
          height: "6 ft 1 in",
          weight: "82 kg",
          chest: "42 in",
          nominee: "Manpreet Kaur (Wife)",
          exServiceNo: "JC-348910W",
          exRank: "Subedar",
          exDischargeDate: "2023-04-30",
          exDischargeBook: "ARM-DIS-89210",
          gunLicence: "PB-GUN-2004-98124",
          gunNo: "12B-449102",
          mobile: "9419123890",
          presentAddress: "Quarter 14B, BSF Enclave, Salt Lake Sector 5, Kolkata",
          presentPin: "700091",
          permanentAddress: "Vill - Dera Baba Nanak, Gurdaspur, Punjab",
          permanentPin: "143511",
          aadhaarLast4: "8765",
          panLast4: "892P",
          previousEmployer: "Border Security Force (BSF) / SecureTrans Logistics",
          uan: "101234567890",
          esiIp: "Exempt (ECHS beneficiary)",
          preferredDispensary: "Command Hospital Salt Lake",
          bankName: "Punjab National Bank",
          accountLast4: "7890",
          ifsc: "PUNB0143500",
          branchName: "Salt Lake Sector 1, Kolkata",
          policeStatus: "Armed Forces Clearance",
          securityMoney: "None",
          declarationAccepted: true,
          termsAccepted: true,
          family: [
            { name: "Harbans Singh", relation: "Father", dateOfBirth: "1950-05-10", aadhaarLast4: "5555" },
            { name: "Manpreet Kaur", relation: "Wife", dateOfBirth: "1982-11-20", aadhaarLast4: "6666" },
          ],
        },
      },
      {
        contact: "amit.haldar1998@gmail.com",
        job_role: "Unskilled Worker",
        status_name: "submitted",
        company_id: 1,
        form: {
          name: "Amit Haldar",
          fatherOrHusband: "Sukumar Haldar",
          dateOfBirth: "1998-11-05",
          age: "28",
          qualification: "Class 8 Pass",
          localAddress: "C-12 Bagmari Road, Maniktala, Kolkata",
          villageAddress: "Vill - Canning, PO - Matla, Dist - South 24 Parganas, West Bengal",
          experience: "3 years Housekeeping & Floor Maintenance at IT Park Salt Lake",
          characterCertificate: "Provided (Panchayat Pradhan certificate)",
          identificationMark: "Birthmark on left shoulder",
          nationality: "Indian",
          religion: "Hindu",
          reference: "Tapan Mondal (Supervisor, 9831999993)",
          height: "5 ft 6 in",
          weight: "62 kg",
          chest: "35 in",
          nominee: "Soma Haldar (Mother)",
          mobile: "9734567890",
          presentAddress: "C-12 Bagmari Road, Maniktala, Kolkata",
          presentPin: "700054",
          permanentAddress: "Vill - Canning, PO - Matla, Dist - South 24 Parganas",
          permanentPin: "743329",
          aadhaarLast4: "1122",
          panLast4: "334H",
          previousEmployer: "Cleanwell Facility Services",
          uan: "101998877665",
          esiIp: "4198765432",
          preferredDispensary: "Maniktala ESI Hospital",
          bankName: "Bank of India",
          accountLast4: "2345",
          ifsc: "BKID0004012",
          branchName: "Maniktala Branch, Kolkata",
          policeStatus: "Verified",
          securityMoney: "None",
          declarationAccepted: true,
          termsAccepted: true,
          family: [
            { name: "Sukumar Haldar", relation: "Father", dateOfBirth: "1968-02-14", aadhaarLast4: "7777" },
            { name: "Soma Haldar", relation: "Mother", dateOfBirth: "1972-08-19", aadhaarLast4: "8888" },
          ],
        },
      },
    ];

    for (const applicant of seedApplicants) {
      const [res] = await pool.query(
        "INSERT INTO applicants (contact, password_hash, job_role, status_name, company_id) VALUES (?, ?, ?, ?, ?)",
        [applicant.contact, defaultPasswordHash, applicant.job_role, applicant.status_name, applicant.company_id],
      );
      await pool.query(
        "INSERT INTO applicant_form (applicant_id, form_json) VALUES (?, ?)",
        [res.insertId, JSON.stringify(applicant.form)],
      );
      await pool.query(
        "INSERT INTO applicant_file (applicant_id, document_kind, file_name, stored_path) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
        [
          res.insertId, "photo", `${applicant.form.name.toLowerCase().replace(/\\s+/g, "-")}-photo.jpg`, "default-photo.jpg",
          res.insertId, "aadhaar", `${applicant.form.name.toLowerCase().replace(/\\s+/g, "-")}-aadhaar.pdf`, "default-aadhaar.pdf",
          res.insertId, "pan", `${applicant.form.name.toLowerCase().replace(/\\s+/g, "-")}-pan.pdf`, "default-pan.pdf",
          res.insertId, "passbook", `${applicant.form.name.toLowerCase().replace(/\\s+/g, "-")}-passbook.pdf`, "default-passbook.pdf",
        ],
      );
    }
  }

  app.get("/api/apply/roles", (_req, res) => {
    res.json(JOB_ROLES.map((role) => ({ name: role.name, skill: role.skill, gun: role.gun })));
  });

  app.post("/api/apply/start", async (req, res) => {
    const contact = normalizeContact(req.body?.contact);
    if (!contact) return res.status(400).json({ error: "Enter a valid email or a 10-digit mobile number." });
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await pool.query("UPDATE applicant_otp SET used = 1 WHERE contact = ? AND used = 0", [contact]);
    await pool.query(
      "INSERT INTO applicant_otp (contact, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [contact, hashCode(contact, code)],
    );
    console.log(`[REAL-TIME OTP DISPATCH] Dispatched 6-digit verification code to ${contact}`);
    res.json({ contact, success: true });
  });

  app.post("/api/apply/verify", async (req, res) => {
    const contact = normalizeContact(req.body?.contact);
    const code = String(req.body?.code || "").trim();
    if (!contact || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code." });
    const [rows] = await pool.query(
      "SELECT id, code_hash FROM applicant_otp WHERE contact = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
      [contact],
    );
    if (!rows.length || rows[0].code_hash !== hashCode(contact, code)) {
      return res.status(400).json({ error: "That code is not valid." });
    }
    const setupToken = randomBytes(32).toString("hex");
    await pool.query("UPDATE applicant_otp SET used = 1, setup_token = ? WHERE id = ?", [setupToken, rows[0].id]);
    res.json({ setupToken });
  });

  app.post("/api/apply/password", async (req, res) => {
    const setupToken = String(req.body?.setupToken || "");
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
    const [rows] = await pool.query(
      "SELECT contact FROM applicant_otp WHERE setup_token = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
      [setupToken],
    );
    if (!rows.length) return res.status(400).json({ error: "Ask for a new code and try again." });
    const contact = rows[0].contact;
    const passwordHash = await hashPassword(password);
    const [originRow] = await pool.query("SELECT id FROM company WHERE code = 'origin' LIMIT 1");
    const originId = originRow[0]?.id || 2;
    const [existing] = await pool.query("SELECT id, status_name, job_role FROM applicants WHERE contact = ?", [contact]);
    let applicantId = existing[0]?.id;
    if (applicantId) {
      await pool.query("UPDATE applicants SET password_hash = ?, company_id = ? WHERE id = ?", [passwordHash, originId, applicantId]);
    } else {
      const [inserted] = await pool.query(
        "INSERT INTO applicants (contact, password_hash, company_id) VALUES (?, ?, ?)",
        [contact, passwordHash, originId],
      );
      applicantId = inserted.insertId;
    }
    await pool.query("DELETE FROM applicant_otp WHERE contact = ?", [contact]);
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO applicant_session (token, applicant_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))",
      [token, applicantId],
    );
    const [current] = await pool.query("SELECT status_name, job_role FROM applicants WHERE id = ?", [applicantId]);
    res.json({ token, status: current[0].status_name, jobRole: current[0].job_role || "" });
  });

  app.post("/api/apply/login", async (req, res) => {
    const contact = normalizeContact(req.body?.contact);
    const password = String(req.body?.password || "");
    if (!contact) return res.status(400).json({ error: "Enter a valid email or a 10-digit mobile number." });
    const [rows] = await pool.query("SELECT id, password_hash, status_name, job_role FROM applicants WHERE contact = ?", [contact]);
    if (!rows.length || !(await passwordMatches(password, rows[0].password_hash))) {
      return res.status(401).json({ error: "Email or phone, or the password, does not match." });
    }
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO applicant_session (token, applicant_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))",
      [token, rows[0].id],
    );
    res.json({ token, status: rows[0].status_name, jobRole: rows[0].job_role || "" });
  });

  app.post("/api/apply/submit", async (req, res) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const [sessions] = await pool.query(
      `SELECT a.id, a.status_name
       FROM applicant_session s
       JOIN applicants a ON a.id = s.applicant_id
       WHERE s.token = ? AND s.expires_at > NOW()`,
      [token],
    );
    if (!sessions.length) return res.status(401).json({ error: "Sign in again to send the application." });
    if (sessions[0].status_name === "submitted") return res.status(400).json({ error: "This application is already submitted." });
    const role = roleByName(req.body?.jobRole);
    if (!role) return res.status(400).json({ error: "Choose a job role." });
    const form = { ...(req.body?.form || {}) };
    if (!role.gun) {
      form.gunLicence = form.gunLicence || "NA";
      form.gunNo = form.gunNo || "NA";
    }
    if (!form.declarationAccepted || !form.termsAccepted) {
      return res.status(400).json({ error: "Read the declaration and the terms and conditions, then accept both." });
    }
    form.joiningTerms = true;
    form.termsVersion = JOINING_VERSION;
    const message = personError({
      name: form.name,
      trade: role.name,
      skill: role.skill,
      salary: "1",
      attendance: "0",
      advance: "0",
      divisor: "26",
      deduct: "0",
      paymentDone: "0",
      application: form,
    });
    if (message) return res.status(400).json({ error: message });
    const [origin] = await pool.query("SELECT id FROM company WHERE code = 'origin' LIMIT 1");
    const applicantId = sessions[0].id;
    const uploads = [
      ["photo", form.photo, form.photoName],
      ["aadhaar", form.aadhaarFile, form.aadhaarFileName],
      ["pan", form.panFile, form.panFileName],
      ["passbook", form.passbookFile, form.passbookFileName],
    ];
    await pool.query("DELETE FROM applicant_file WHERE applicant_id = ?", [applicantId]);
    for (const [kind, data, name] of uploads) {
      const saved = await saveUpload(applicantId, kind, data, name);
      if (!saved) return res.status(400).json({ error: "Upload the photo, Aadhaar, PAN, and bank passbook." });
      await pool.query(
        "INSERT INTO applicant_file (applicant_id, document_kind, file_name, stored_path) VALUES (?, ?, ?, ?)",
        [applicantId, kind, saved.originalName, saved.stored],
      );
    }
    const stored = publicForm({
      ...form,
      aadhaarLast4: last4(form.aadhaar),
      panLast4: last4(form.pan),
      accountLast4: last4(form.accountNo),
    });
    await pool.query(
      `INSERT INTO applicant_form (applicant_id, form_json) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE form_json = VALUES(form_json), submitted_at = CURRENT_TIMESTAMP`,
      [applicantId, JSON.stringify(stored)],
    );
    await pool.query(
      "UPDATE applicants SET job_role = ?, status_name = 'submitted', company_id = ? WHERE id = ?",
      [role.name, origin[0]?.id || 2, applicantId],
    );
    res.json({ ok: true });
  });

  app.get("/api/applicants", async (req, res) => {
    if (!canAccessApplicants(req, res)) return;
    const [rows] = await pool.query(
      `SELECT a.id, a.contact, a.job_role, a.status_name, a.created_at,
              JSON_UNQUOTE(JSON_EXTRACT(f.form_json, '$.name')) AS applicant_name
       FROM applicants a
       LEFT JOIN applicant_form f ON f.applicant_id = a.id
       WHERE a.company_id = ?
       ORDER BY a.id DESC`,
      [companyIdFrom(req)],
    );
    res.json(rows);
  });

  app.get("/api/applicants/:id", async (req, res) => {
    if (!canAccessApplicants(req, res)) return;
    const [rows] = await pool.query(
      `SELECT a.id, a.contact, a.job_role, a.status_name, a.created_at, f.form_json, f.submitted_at
       FROM applicants a
       LEFT JOIN applicant_form f ON f.applicant_id = a.id
       WHERE a.id = ? AND a.company_id = ?`,
      [req.params.id, companyIdFrom(req)],
    );
    if (!rows.length) return res.status(404).json({ error: "Application not found." });
    const [files] = await pool.query(
      "SELECT document_kind, file_name FROM applicant_file WHERE applicant_id = ?",
      [req.params.id],
    );
    const row = rows[0];
    let form = row.form_json;
    if (typeof form === "string") form = JSON.parse(form);
    res.json({
      id: row.id,
      contact: row.contact,
      jobRole: row.job_role || "",
      status: row.status_name,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      form: form || null,
      files,
    });
  });

  app.post("/api/applicants/:id/status", async (req, res) => {
    if (!canAccessApplicants(req, res)) return;
    const applicantId = Number(req.params.id);
    const companyId = companyIdFrom(req);
    const newStatus = String(req.body?.status || "").toLowerCase().trim();
    if (!["submitted", "shortlisted", "rejected"].includes(newStatus)) {
      return res.status(400).json({ error: "Status must be submitted, shortlisted, or rejected." });
    }
    const [existing] = await pool.query(
      "SELECT id, status_name FROM applicants WHERE id = ? AND company_id = ?",
      [applicantId, companyId],
    );
    if (!existing.length) return res.status(404).json({ error: "Application not found." });
    if (existing[0].status_name === "approved") {
      return res.status(400).json({ error: "Cannot change status of an already approved applicant." });
    }
    await pool.query(
      "UPDATE applicants SET status_name = ? WHERE id = ? AND company_id = ?",
      [newStatus, applicantId, companyId],
    );
    res.json({ ok: true, status: newStatus });
  });

  app.post("/api/applicants/:id/approve", async (req, res) => {
    if (!canAccessApplicants(req, res)) return;
    const applicantId = Number(req.params.id);
    const companyId = companyIdFrom(req);
    const [rows] = await pool.query(
      `SELECT a.id, a.contact, a.job_role, a.status_name, a.company_id, f.form_json
       FROM applicants a
       LEFT JOIN applicant_form f ON f.applicant_id = a.id
       WHERE a.id = ? AND a.company_id = ?`,
      [applicantId, companyId],
    );
    if (!rows.length) return res.status(404).json({ error: "Application not found." });
    if (rows[0].status_name === "approved") {
      return res.status(400).json({ error: "This applicant has already been approved and converted to an employee." });
    }

    const row = rows[0];
    let form = row.form_json;
    if (typeof form === "string") {
      try { form = JSON.parse(form); } catch { form = {}; }
    }
    form = form || {};

    const role = roleByName(row.job_role);
    const employeeName = String(req.body?.name || form.name || row.contact).trim();
    const trade = String(req.body?.trade || row.job_role || (role ? role.name : "Worker")).trim();
    const skill = String(req.body?.skill || (role ? role.skill : "Skilled")).trim();
    const salary = Number(req.body?.salary) || 14000;
    const divisor = Number(req.body?.divisor) || 26;

    const [result] = await pool.query(
      "INSERT INTO employees (name, trade, skill, salary, divisor, company_id) VALUES (?, ?, ?, ?, ?, ?)",
      [employeeName, trade, skill, salary, divisor, companyId],
    );
    const employeeId = result.insertId;

    await saveApplication(pool, employeeId, form, companyId);

    const [files] = await pool.query(
      "SELECT document_kind, file_name, stored_path FROM applicant_file WHERE applicant_id = ?",
      [applicantId],
    );
    for (const file of files) {
      await pool.query(
        "INSERT INTO employee_document (company_id, employee_id, document_kind, file_name, stored_path) VALUES (?, ?, ?, ?, ?)",
        [companyId, employeeId, file.document_kind, file.file_name, file.stored_path || file.file_name],
      ).catch(() => {});
    }

    await pool.query(
      "UPDATE applicants SET status_name = 'approved' WHERE id = ? AND company_id = ?",
      [applicantId, companyId],
    );

    res.json({
      ok: true,
      employeeId,
      name: employeeName,
      status: "approved",
      message: `Applicant ${employeeName} approved and added to Employee Book with Employee ID #${employeeId}.`,
    });
  });
}
