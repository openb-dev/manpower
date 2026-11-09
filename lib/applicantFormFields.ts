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
  return next;
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
