export function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    NEW: "New",
    SHORTLISTED: "Shortlisted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    EMPLOYEE: "Employee",
    OLD_EMPLOYEE: "Old employee",
    ACTIVE: "Working",
    INACTIVE: "Stopped",
    TERMINATED: "Terminated",
    ON_LEAVE: "On leave",
  };
  return status ? map[status] || status : "—";
}
