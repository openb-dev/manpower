export const QUALIFICATION_OPTIONS = [
  "Class 8 or below",
  "Madhyamik (Class 10)",
  "Higher Secondary (Class 12)",
  "ITI / Diploma",
  "Graduation",
  "Post Graduation",
  "Other",
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const DEFAULT_STATE = "West Bengal";
export const DEFAULT_COUNTRY = "India";

export const FILE_DATA_KEYS = [
  "photo",
  "aadhaarFile",
  "panFile",
  "passbookFile",
  "educationFile",
  "otherQualFile",
  "policeFile",
] as const;

export function joinAddressParts(parts: unknown[]) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

export function placeLine(fd: Record<string, any> | null | undefined, prefix: string) {
  const get = (key: string) => String(fd?.[`${prefix}${key}`] || "").trim();
  return joinAddressParts([
    get("Pin") ? `PIN ${get("Pin")}` : "",
    get("District") ? `Dist. ${get("District")}` : "",
    get("State"),
    get("Country"),
  ]);
}

export function formDataWithoutFiles(form: Record<string, any>) {
  const next = { ...form };
  for (const key of FILE_DATA_KEYS) next[key] = "";
  delete next.filledByAdmin;
  return next;
}

export type FilledByAdmin = {
  userId: string;
  name: string;
  email: string;
  filledAt: string;
};

export function filledByAdminInfo(person: any): FilledByAdmin | null {
  const raw = person?.formData?.filledByAdmin || person?.filledByAdmin;
  if (!raw || typeof raw !== "object") return null;
  const userId = String(raw.userId || raw.id || "").trim();
  const email = String(raw.email || "").trim();
  const name = String(raw.name || "").trim();
  if (!userId && !email) return null;
  return {
    userId,
    name: name || "Admin",
    email,
    filledAt: String(raw.filledAt || ""),
  };
}

export function wantsBankUpload(form: Record<string, any> | null | undefined) {
  return String(form?.uploadBankDetails || "").toUpperCase() === "YES";
}

export function hasPassbookAttachment(person: any) {
  const fd = person?.formData || {};
  if (String(fd.uploadBankDetails || "").toUpperCase() === "NO") return false;
  if (fd.passbookFileName || (typeof fd.passbookFile === "string" && fd.passbookFile.startsWith("data:"))) {
    return true;
  }
  const lists = [person?.documents, person?.applicantDocuments];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    if (
      list.some((doc: any) => {
        const type = String(doc?.docType || "").toUpperCase();
        return type === "PASSBOOK" && (doc?.fileName || doc?.fileData);
      })
    ) {
      return true;
    }
  }
  return false;
}

export function applicantPhotoUrl(person: any) {
  const fd = person?.formData || {};
  if (typeof fd.photo === "string" && fd.photo.startsWith("data:image")) return fd.photo;
  const lists = [person?.documents, person?.applicantDocuments];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    const photo = list.find((doc: any) => {
      const type = String(doc?.docType || "").toUpperCase();
      return type === "PHOTO" && typeof doc?.fileData === "string" && doc.fileData.startsWith("data:image");
    });
    if (photo?.fileData) return photo.fileData;
  }
  return "";
}
