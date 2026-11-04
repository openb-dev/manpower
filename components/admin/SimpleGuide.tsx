export function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    NEW: "New",
    SHORTLISTED: "Shortlisted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    ACTIVE: "Working",
    INACTIVE: "Stopped",
    TERMINATED: "Terminated",
    ON_LEAVE: "On leave",
  };
  return status ? map[status] || status : "—";
}
