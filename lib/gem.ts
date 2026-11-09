export const GEM_SKILL_CATEGORIES = [
  "Unskilled",
  "Semi-skilled",
  "Skilled",
  "Highly-Skilled",
] as const;

export const GEM_EXPERIENCE_BANDS = [
  "0 to 3 Years",
  "3 to 7 Years",
  "7 to 10 Years",
  "10 to 15 Years",
  "15 Years+",
] as const;

/** Client GeM "List of Profiles" under Manpower Outsourcing Services. */
export const GEM_MANPOWER_PROFILES = [
  "Administrative Operator or Office Assistant or Executive Assistant",
  "Receptionist Cum Operator",
  "Personnel Assistant",
  "Secretary",
  "Multi-tasking Staff",
  "Office Supervisor",
  "Computer Operator",
  "Mali/Gardener",
  "Establishment Assistant",
  "Clerk",
  "Store Keeper",
  "Office Helper",
  "Librarian",
  "Store Supervisor",
  "Admin Officer",
  "Accounting Operator or Accounts Assistants or Accounts Executive",
  "Audit Clerk",
  "Account Clerk",
  "Cashier",
  "Accounts Officer",
  "Mazdoor/Labour",
  "Mali/Gardener Helper",
  "Sweeper",
  "Washer",
  "Attendant",
  "Office Peon",
  "Blacksmith",
  "Carpenter",
  "Electrician",
  "Mason",
  "Plumber",
  "Welder",
  "Painter",
  "Cook",
  "Driller",
  "Driver - HMV",
  "Tailor",
  "Staff Nurses",
  "Nursing Orderly",
  "Nursing Orderly Supervisor",
  "Pharmacist",
  "Physiotherapist",
  "Sanitary Inspector",
  "Social Worker",
  "Medical Social Worker",
  "Plaster Cutter",
  "Lab. Attendant",
  "Laboratory Assistant/Attendant",
  "Water Carrier",
  "Animal Attendant",
  "IT Engineer",
  "Computer science engineer",
  "Web designer",
  "IT maintenance engineer",
  "IT hardware technician",
  "Civil Engineer",
  "Mechanical engineer",
  "Crane Operator",
  "Fitter",
  "Junior Data Entry Operator",
  "Driver - LMV",
  "Dispatch Rider",
  "Assistant lineman",
  "Fire Operator (FO)",
  "Barber",
  "Labour Agriculture",
  "Mazdoor Agriculture / Cultivator Agriculture",
  "Driver (Engine Tractor M.T. Motor) Agriculture",
  "Superintendent",
  "Instrument technician",
  "Estate manager",
  "Field Worker",
  "Hospital Manager",
  "Hostel Servant",
  "Office Attendant",
  "Teacher",
  "Workshop Attendant",
  "Boat Operator",
  "Draftsman",
  "Nursing Assistant",
  "Gym Trainer Male",
  "Gym Trainer Female",
  "Tradesmen Mate",
  "Ward Attendant (Male)",
  "Ward Attendant (Female)",
  "Warden (Female)",
  "Fisherman",
  "Data Entry Operator",
  "Stenographer",
  "Sanitation Supervisor",
  "Others",
] as const;

export function gemProfileCode(name: string) {
  const code = name
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return code || "PROFILE";
}

export function isSecurityGuardRole(role?: { code?: string; name?: string } | null) {
  const text = `${role?.code || ""} ${role?.name || ""}`.toLowerCase();
  return /sec-guard|security/.test(text);
}

export function isManpowerRole(role?: { code?: string; name?: string } | null) {
  const text = `${role?.code || ""} ${role?.name || ""}`.toLowerCase();
  return role?.code === "MANPOWER" || text.includes("manpower");
}

export function sortGemProfiles<T extends { name: string }>(categories: T[]) {
  const order = new Map(GEM_MANPOWER_PROFILES.map((name, index) => [name, index]));
  return [...categories].sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
}
