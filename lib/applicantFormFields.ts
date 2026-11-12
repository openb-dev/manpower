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
    get("District") ? `Dist. ${get("District")}` : "",
    get("State"),
    get("Pin") ? `PIN ${get("Pin")}` : "",
    get("Country"),
  ]);
}

export function indianAddressLine(parts: {
  locality?: string;
  careOf?: string;
  houseNo?: string;
  houseOwner?: string;
  po?: string;
  viaPO?: string;
  ps?: string;
  district?: string;
  state?: string;
  pin?: string;
  country?: string;
}) {
  return joinAddressParts([
    parts.locality,
    parts.careOf ? `C/o ${parts.careOf}` : "",
    parts.houseNo ? `No. ${parts.houseNo}` : "",
    parts.houseOwner ? `H/W ${parts.houseOwner}` : "",
    parts.po ? `P.O. ${parts.po}` : "",
    parts.viaPO ? `Via ${parts.viaPO}` : "",
    parts.ps ? `P.S. ${parts.ps}` : "",
    parts.district ? `Dist. ${parts.district}` : "",
    parts.state,
    parts.pin ? `PIN ${parts.pin}` : "",
    parts.country,
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
  phone: string;
  filledAt: string;
};

export function filledByAdminInfo(person: any): FilledByAdmin | null {
  const raw = person?.formData?.filledByAdmin || person?.filledByAdmin;
  if (!raw || typeof raw !== "object") return null;
  const userId = String(raw.userId || raw.id || "").trim();
  const email = String(raw.email || "").trim();
  const name = String(raw.name || "").trim();
  const phone = String(raw.phone || "").replace(/\D/g, "").slice(-10);
  if (!userId && !email && !name) return null;
  return {
    userId,
    name: name || "Admin",
    email,
    phone,
    filledAt: String(raw.filledAt || ""),
  };
}

export function filledByAdminLine(person: any, fallbackName = "") {
  const info = filledByAdminInfo(person);
  const name = String(info?.name || fallbackName || "").trim();
  return name ? `Form filled up by admin — ${name}` : "Form filled up by admin";
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
      const src = doc?.fileData || doc?.fileKey;
      return type === "PHOTO" && typeof src === "string" && src.startsWith("data:image");
    });
    if (photo?.fileData || photo?.fileKey) return photo.fileData || photo.fileKey;
  }
  return "";
}

export type AttachedDocument = {
  docType: string;
  fileName: string;
  src: string;
};

const DOC_LABELS: Record<string, string> = {
  PHOTO: "Passport photo",
  AADHAAR: "Aadhaar",
  PAN: "PAN card",
  PASSBOOK: "Bank passbook / cheque",
  EDUCATION: "Education certificate",
  OTHER_QUALIFICATION: "Other qualification",
  POLICE_VERIFICATION: "Police verification",
};

export function documentTypeLabel(docType: string) {
  const key = String(docType || "").toUpperCase();
  return DOC_LABELS[key] || key.replace(/_/g, " ").toLowerCase();
}

function usableFileSrc(value: unknown) {
  return typeof value === "string" &&
    (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://"))
    ? value
    : "";
}

export function collectAttachedDocuments(person: any): AttachedDocument[] {
  const seen = new Set<string>();
  const out: AttachedDocument[] = [];
  const fd = person?.formData || {};
  const skipPassbook = String(fd.uploadBankDetails || "").toUpperCase() === "NO";

  function add(docType?: string, fileName?: string, src?: unknown) {
    const type = String(docType || "DOCUMENT").toUpperCase();
    if (skipPassbook && type === "PASSBOOK") return;
    const href = usableFileSrc(src);
    if (!href) return;
    const name = String(fileName || documentTypeLabel(type) || "document");
    const key = `${type}|${name}|${href.slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ docType: type, fileName: name, src: href });
  }

  const lists = [person?.documents, person?.applicantDocuments];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const doc of list) {
      add(doc?.docType, doc?.fileName, doc?.fileData || doc?.fileKey || doc?.src);
    }
  }
  add("PHOTO", fd.photoName || "Passport photo", fd.photo);
  add("AADHAAR", fd.aadhaarFileName || "Aadhaar document", fd.aadhaarFile);
  add("PAN", fd.panFileName || "PAN document", fd.panFile);
  add("PASSBOOK", fd.passbookFileName || "Bank passbook", fd.passbookFile);
  add("EDUCATION", fd.educationFileName || "Education certificate", fd.educationFile);
  add("OTHER_QUALIFICATION", fd.otherQualFileName || "Other qualification certificate", fd.otherQualFile);
  add("POLICE_VERIFICATION", fd.policeFileName || "Police verification document", fd.policeFile);
  return out;
}

export function attachmentBlobUrl(src: string) {
  if (!src) return "";
  if (src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  if (!src.startsWith("data:")) return src;
  const comma = src.indexOf(",");
  if (comma < 0) return src;
  const header = src.slice(0, comma);
  const body = src.slice(comma + 1);
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export function applicationDisplayId(person: any) {
  const code = String(person?.applicationNo || person?.formData?.applicationNo || "").trim();
  if (!code) return "";
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(code) || /^[0-9a-f]{20,}$/i.test(code)) return "";
  return code;
}

export function downloadAttachedFile(src: string, fileName: string) {
  const href = attachmentBlobUrl(src);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName || "document";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function openAttachedFile(src: string) {
  const href = attachmentBlobUrl(src);
  window.open(href, "_blank", "noopener,noreferrer");
}
