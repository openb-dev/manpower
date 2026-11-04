const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthKey(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

export function monthLabel(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  return `${NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

export function monthRange(key) {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}
