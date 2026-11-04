import { monthLabel } from "./months.js";

export function closeSourceRef(month) {
  return month === "2026-08" ? "AUG-2026" : `PAY-${month}`;
}

export function closeNarration(month) {
  if (month === "2026-08") return "August pay close: actual total, Dilip, and IIFT travel allowance";
  return `Pay close ${monthLabel(month)}`;
}

export function markDays(marks) {
  let sum = 0;
  let any = false;
  for (const value of Object.values(marks || {})) {
    const text = String(value ?? "").trim();
    if (!text || text === "-") continue;
    any = true;
    const upper = text.toUpperCase();
    if (upper === "P") sum += 1;
    else if (upper === "L") sum += 0;
    else if (text === "1/2") sum += 0.5;
    else {
      const amount = Number(text);
      if (Number.isFinite(amount)) sum += amount;
    }
  }
  return any ? sum : null;
}

export function rowDays(row) {
  if (row.totalDays !== null && row.totalDays !== undefined && row.totalDays !== "") {
    const amount = Number(row.totalDays);
    if (Number.isFinite(amount)) return amount;
  }
  return markDays(row.marks);
}

export function attendanceDays(rows) {
  const actual = rows.filter((row) => String(row.sheetName || "").includes("(Actual)"));
  const adjusted = rows.filter((row) => String(row.sheetName || "").includes("(Adj)"));
  const chosen = actual.length ? actual : adjusted;
  if (!chosen.length) return null;
  let days = 0;
  let found = false;
  for (const row of chosen) {
    const amount = rowDays(row);
    if (amount === null) continue;
    days += amount;
    found = true;
  }
  if (!found) return null;
  return { days, sheetName: chosen[0].sheetName };
}

async function writeDisbursement(pool, month, amount) {
  await pool.query(
    `INSERT INTO ledger_entries (entry_kind, source_ref, narration, amount)
     VALUES ('disbursement', ?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount), narration = VALUES(narration)`,
    [closeSourceRef(month), closeNarration(month), amount],
  );
}

export async function closeMonth(pool, month) {
  if (month === "2026-08") {
    const [close] = await pool.query(
      "SELECT label, amount FROM payroll_close WHERE month_key = '2026-08' ORDER BY sort_order",
    );
    if (!close.length) return { error: "August close is not stored." };
    const amount = close.reduce((sum, row) => sum + Number(row.amount), 0);
    await writeDisbursement(pool, month, amount);
    return {
      month,
      amount,
      kept: true,
      message: "August close stays as stored.",
      close: close.map((row) => ({ label: row.label, amount: Number(row.amount) })),
    };
  }

  const [lines] = await pool.query("SELECT payment_done FROM payroll_lines WHERE month_key = ?", [month]);
  if (!lines.length) return { error: "Save payment done for this month before closing." };
  if (lines.some((row) => row.payment_done === null)) {
    return { error: "Enter payment done for every person saved in this month." };
  }
  const amount = Math.round(lines.reduce((sum, row) => sum + Number(row.payment_done), 0) * 100) / 100;
  await pool.query("DELETE FROM payroll_close WHERE month_key = ?", [month]);
  await pool.query(
    "INSERT INTO payroll_close (label, amount, sort_order, month_key) VALUES ('Payment done', ?, 1, ?)",
    [amount, month],
  );
  await writeDisbursement(pool, month, amount);
  return {
    month,
    amount,
    kept: false,
    message: "This month is closed.",
    close: [{ label: "Payment done", amount }],
  };
}
