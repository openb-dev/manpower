const ROLE_MODULES = {
  super_admin: ["hrm", "crm", "accounts", "finance", "procurement", "masters"],
  admin: ["hrm", "crm", "accounts", "finance", "procurement", "masters"],
  accounts: ["accounts", "finance"],
  hr: ["hrm"],
  viewer: ["hrm", "crm", "accounts", "finance", "procurement"],
};

export function accessFor(role) {
  return {
    modules: ROLE_MODULES[role] || [],
    canWrite: role !== "viewer" && Boolean(ROLE_MODULES[role]),
  };
}

const MODULE_RULES = [
  ["/api/employees", "hrm", ["hrm", "crm"]],
  ["/api/payroll", "hrm"],
  ["/api/attendance", "hrm", ["hrm", "crm"]],
  ["/api/applicants", "hrm"],
  ["/api/contracts", "crm"],
  ["/api/deployments", "crm"],
  ["/api/work-register", "crm"],
  ["/api/invoices", "accounts"],
  ["/api/rate-card", "accounts"],
  ["/api/returns", "accounts"],
  ["/api/receipts", "accounts"],
  ["/api/ledger", "finance"],
  ["/api/expenses", "finance"],
  ["/api/purchases", "procurement"],
  ["/api/purchase-orders", "procurement"],
  ["/api/sites", "masters", ["masters", "crm"]],
  ["/api/departments", "masters", ["masters", "crm"]],
  ["/api/vendors", "masters", ["masters", "procurement"]],
  ["/api/designations", "masters"],
  ["/api/company", "masters"],
  ["/api/backup", "masters"],
  ["/api/audit", "masters"],
  ["/api/licences", "masters"],
];

export function moduleAllows(url, method, modules) {
  const path = String(url || "").split("?")[0];
  if (
    path.startsWith("/api/login") ||
    path === "/api/session" ||
    path === "/api/logout" ||
    path === "/api/home" ||
    path.startsWith("/api/statutory")
  ) return true;
  const rule = MODULE_RULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!rule) return true;
  const allowed = method === "GET" || method === "HEAD" ? (rule[2] || [rule[1]]) : [rule[1]];
  return allowed.some((name) => modules.includes(name));
}
