export function companyIdFrom(req) {
  if (req?.auth && req.auth.role !== "super_admin" && req.auth.companyId) {
    return Number(req.auth.companyId);
  }
  const id = Number(req?.get ? req.get("x-company-id") : req?.headers?.["x-company-id"]);
  return Number.isInteger(id) && id > 0 ? id : 1;
}
