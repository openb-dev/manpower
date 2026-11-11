import { DECLARATION, TERMS } from "@/server/data/joiningText.js";
import { applicantPhotoUrl } from "@/lib/applicantFormFields";

const NK = {
  name: "M/s. N.K. Enterprise",
  address: [
    "Nabanari Apartment, F-3/2, 3rd Floor, Mohishgote, Dhalipara,",
    "P.O.- Krishnapur, P.S.- New Town, Kolkata-700102",
  ],
  website: "www.nkenterpriselkolkata.com",
  email: "nkenterprise0633@gmail.com",
  mobile: "9804057947 / 7980350454",
};

function text(value: unknown) {
  if (value == null) return "";
  const s = String(value).trim();
  return s && s !== "—" ? s : "";
}

function dmy(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function hm(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(d)
    .replace(/\s*(am|pm)$/i, (part) => ` ${part.trim().toUpperCase()}`);
}

function experienceShown(fd: Record<string, any>) {
  if (String(fd?.experienceType || "").toUpperCase() === "FRESHER") return "Fresher";
  const jobs = Array.isArray(fd?.workHistory) ? fd.workHistory : [];
  const lines = jobs
    .map((job: any) => {
      const post = text(job?.job);
      const employer = text(job?.employer);
      const from = text(job?.from);
      const to = text(job?.to);
      const when = [from, to].filter(Boolean).join(" to ");
      return [post && employer ? `${post} at ${employer}` : post || employer, when].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  if (lines.length) return lines.join("; ");
  return text(fd?.experience);
}

function experienceIsFresher(fd: Record<string, any>) {
  const t = String(fd?.experienceType || "").toUpperCase();
  if (t === "FRESHER") return true;
  if (t === "EXPERIENCED") return false;
  return String(fd?.experience || "").toUpperCase() === "FRESHER";
}

function experienceIsExperienced(fd: Record<string, any>) {
  if (experienceIsFresher(fd)) return false;
  const t = String(fd?.experienceType || "").toUpperCase();
  if (t === "EXPERIENCED") return true;
  const shown = experienceShown(fd);
  return Boolean(shown && shown.toUpperCase() !== "FRESHER");
}

function heightShown(fd: Record<string, any>) {
  if (fd?.heightUnit === "ft") {
    const ft = text(fd.heightFt);
    const inch = text(fd.heightInch);
    if (!ft && !inch) return text(fd.height);
    return `${ft || "0"} ft ${inch || "0"} inch`;
  }
  const raw = text(fd?.heightCm || fd?.height);
  if (!raw) return "";
  if (/cm|ft|inch|'/i.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return `${n} cm`;
}

function familyYes(fd: Record<string, any>) {
  const choice = String(fd?.includeFamily || "").toUpperCase();
  if (choice === "NO") return false;
  if (choice === "YES") return true;
  const rows = Array.isArray(fd?.family) ? fd.family : [];
  return rows.some((member: any) =>
    [member?.name, member?.relation, member?.dateOfBirth, member?.aadhaar].some((part) => String(part || "").trim()),
  );
}

function familyRows(fd: Record<string, any>) {
  if (!familyYes(fd)) return [];
  const rows = Array.isArray(fd?.family) ? fd.family.filter((member: any) => text(member?.name)).slice(0, 5) : [];
  return rows;
}

function bankYes(fd: Record<string, any>) {
  return String(fd?.uploadBankDetails || "").toUpperCase() === "YES";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function paperFormFileName(person: any, index = 0) {
  const raw = String(person?.fullName || "applicant").trim();
  const safe = raw.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "applicant";
  const suffix = String(person?.id || index).slice(-4);
  return `Applicant-form-${safe}-${suffix}.pdf`;
}

export async function waitForImages(_root?: HTMLElement) {
  return;
}

export async function buildPaperFormPdf(
  person: any,
  company?: { slug?: string; legalName?: string; shortName?: string },
) {
  const jspdfMod: any = await import("jspdf");
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default;
  if (!jsPDF) throw new Error("PDF library did not load.");

  const fd = person?.formData || {};
  const nk = !company?.slug || company.slug === "nk";
  const companyName = company?.legalName || person?.company?.legalName || (nk ? NK.name : "Company");
  const address = nk ? NK.address : ["West Bengal, India"];
  const websiteLine = nk
    ? `Website : ${NK.website}, Email : ${NK.email}`
    : "";
  const mobileLine = nk ? `Mobile : ${NK.mobile}` : "";
  const name = text(person?.fullName || fd.name);
  const father = text(person?.fatherOrHusband || fd.fatherOrHusband);
  const dob = dmy(person?.dateOfBirth || fd.dateOfBirth);
  const age = text(fd.age);
  const presentLocality = text(fd.presentAddress) || text(fd.localAddress) || text(person?.presentAddress);
  const permanentLocality = text(fd.permanentAddress) || text(fd.villageAddress) || text(person?.permanentAddress);
  const religion = text(fd.religion);
  const signedAt = fd.submittedAt || person?.createdAt || person?.joiningDate;
  const signedOn = dmy(signedAt);
  const signedTime = hm(fd.submittedAt || person?.createdAt);
  const postApplied = [
    person?.jobRole?.name,
    fd.otherCategory || fd.gemProfile || person?.roleCategory?.name,
    fd.skillCategory,
    fd.gemExperience,
  ]
    .filter(Boolean)
    .join(" - ");
  const photo = applicantPhotoUrl(person);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const left = 14;
  const right = 196;
  const width = right - left;

  const write = (str: string, x: number, y: number, size = 10, style: "normal" | "bold" = "normal") => {
    pdf.setFont("times", style);
    pdf.setFontSize(size);
    pdf.setTextColor(0, 0, 0);
    pdf.text(str || "", x, y);
  };

  const wrap = (str: string, x: number, y: number, maxW: number, size = 10, style: "normal" | "bold" = "normal") => {
    pdf.setFont("times", style);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(str || "", maxW);
    pdf.text(lines, x, y);
    return y + lines.length * (size * 0.42);
  };

  const tickBox = (x: number, y: number, on: boolean) => {
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.28);
    pdf.rect(x, y - 3.2, 3.2, 3.2);
    if (on) {
      pdf.setLineWidth(0.5);
      pdf.line(x + 0.55, y - 1.4, x + 1.3, y - 0.45);
      pdf.line(x + 1.3, y - 0.45, x + 2.6, y - 2.65);
    }
  };

  const dashLine = (x1: number, y1: number, x2: number) => {
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.22);
    const dash = 0.9;
    const gap = 0.55;
    let x = x1;
    while (x < x2 - 0.2) {
      pdf.line(x, y1, Math.min(x + dash, x2), y1);
      x += dash + gap;
    }
  };

  const lineFill = (label: string, value: string, y: number, size = 10.5) => {
    pdf.setFont("times", "normal");
    pdf.setFontSize(size);
    const tag = label.endsWith(":") ? `${label} ` : `${label} : `;
    const labelW = pdf.getTextWidth(tag);
    pdf.text(tag, left, y);
    const val = value || "";
    pdf.setFont("times", "bold");
    const lines = pdf.splitTextToSize(val, width - labelW - 2);
    pdf.text(lines, left + labelW, y);
    const used = Math.max(1, lines.length) * (size * 0.38);
    const underlineY = y + 0.9;
    dashLine(left + labelW, underlineY, right);
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i += 1) {
        dashLine(left, y + i * (size * 0.38) + 0.9, right);
      }
    }
    return y + used + 2;
  };

  const rowFields = (items: { label: string; value: string }[], y: number, size = 9.5) => {
    const n = Math.max(items.length, 1);
    const gap = 3;
    const colW = (width - gap * (n - 1)) / n;
    pdf.setFontSize(size);
    items.forEach((item, i) => {
      const x = left + i * (colW + gap);
      const tag = `${item.label} : `;
      pdf.setFont("times", "normal");
      const lw = pdf.getTextWidth(tag);
      pdf.text(tag, x, y);
      pdf.setFont("times", "bold");
      const maxVal = Math.max(8, colW - lw - 1);
      const shown = pdf.splitTextToSize(item.value || "", maxVal)[0] || "";
      pdf.text(shown, x + lw, y);
      dashLine(x + lw, y + 1, x + colW);
    });
    return y + 5.6;
  };

  const banner = (title: string, y: number) => {
    pdf.setFillColor(0, 0, 0);
    pdf.rect(left, y - 5, width, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("times", "bold");
    pdf.setFontSize(12);
    pdf.text(title, pageW / 2, y, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    return y + 8;
  };

  const footer = (label: string) => {
    const dateTimeTag = `Date : ${signedOn}     Time : `;
    write(`${dateTimeTag}${signedTime}`, left, 278, 10);
    if (!signedTime) {
      const tagW = pdf.getTextWidth(dateTimeTag);
      dashLine(left + tagW, 279.2, left + tagW + 24);
    }
    pdf.setFont("times", "bold");
    pdf.text(name, right, 274, { align: "right" });
    pdf.setLineWidth(0.2);
    pdf.line(right - 52, 275, right, 275);
    pdf.setFont("times", "normal");
    pdf.setFontSize(9);
    pdf.text(`(${label})`, right, 279, { align: "right" });
  };

  const stampPageNumbers = () => {
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
      pdf.setPage(i);
      pdf.setFont("times", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Page ${i} of ${total}`, pageW / 2, 287, { align: "center" });
    }
  };

  const letterhead = (startY: number, withPhoto = false) => {
  const photoW = 22;
  const photoH = 28;
    const gap = 5;
    const photoX = right - photoW;
    const photoY = startY;
    const textMax = withPhoto ? photoX - left - gap : width;

    if (withPhoto) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.35);
      pdf.rect(photoX, photoY, photoW, photoH);
      if (photo.startsWith("data:image")) {
        const formats = photo.includes("png") ? ["PNG", "JPEG"] : ["JPEG", "PNG"];
        let drawn = false;
        for (const fmt of formats) {
          try {
            const props = pdf.getImageProperties(photo);
            const imgRatio = props.width / Math.max(props.height, 1);
            const boxRatio = photoW / photoH;
            const pad = 0.5;
            const innerW = photoW - pad * 2;
            const innerH = photoH - pad * 2;
            let drawW = innerW;
            let drawH = innerH;
            if (imgRatio > boxRatio) {
              drawH = innerW / imgRatio;
            } else {
              drawW = innerH * imgRatio;
            }
            const dx = photoX + pad + (innerW - drawW) / 2;
            const dy = photoY + pad + (innerH - drawH) / 2;
            pdf.addImage(photo, fmt, dx, dy, drawW, drawH);
            drawn = true;
            break;
          } catch {
            /* try next format */
          }
        }
        if (!drawn) {
          pdf.setFont("times", "normal");
          pdf.setFontSize(7);
          pdf.text("PHOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
        }
      }
    }

    pdf.setFont("times", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(0, 0, 0);
    const nameLines = pdf.splitTextToSize(companyName, textMax);
    pdf.text(nameLines, left, startY);
    let ty = startY + nameLines.length * 6;
    pdf.setFont("times", "normal");
    pdf.setFontSize(9);
    for (const line of address) {
      const lines = pdf.splitTextToSize(line, textMax);
      pdf.text(lines, left, ty);
      ty += lines.length * 4;
    }
    if (websiteLine) {
      const lines = pdf.splitTextToSize(websiteLine, textMax);
      pdf.text(lines, left, ty);
      ty += lines.length * 4;
    }
    if (mobileLine) {
      const lines = pdf.splitTextToSize(mobileLine, textMax);
      pdf.text(lines, left, ty);
      ty += lines.length * 4;
    }
    const bottom = withPhoto ? Math.max(ty, photoY + photoH) : ty;
    return bottom + 5;
  };

  // Page 1 — full application on one A4 sheet
  let y = banner("APPLICATION FOR EMPLOYMENT", 14);
  y = letterhead(y + 2, true);
  if (postApplied) y = lineFill("Post applied :", postApplied, y, 9.5);
  y = rowFields(
    [
      { label: "1. Name in full", value: name },
      { label: "D.O.B.", value: dob },
      { label: "Age", value: age },
    ],
    y,
    9.5,
  );
  y = lineFill("2. Father's / Husband Name", father, y, 9.5);
  y = rowFields(
    [
      { label: "3. Mobile", value: text(person?.mobile || fd.mobile) },
      { label: "Emergency contact", value: text(fd.emergencyContact) },
    ],
    y,
    9.5,
  );
  write("4. Present Address :", left, y, 9.5);
  y += 4.5;
  y = lineFill("Vill. / Locality", presentLocality, y, 9.5);
  y = rowFields(
    [
      { label: "P.O.", value: text(fd.presentPO || fd.localPO) },
      { label: "P.S.", value: text(fd.presentPS || fd.localPS) },
      { label: "Dist.", value: text(fd.presentDistrict || fd.localDistrict) },
      { label: "State", value: text(fd.presentState || fd.localState) },
      { label: "PIN", value: text(fd.presentPin || fd.localPin) },
    ],
    y,
    8.8,
  );
  write("5. Permanent Address :", left, y, 9.5);
  y += 4.5;
  y = lineFill("Vill. / Locality", permanentLocality, y, 9.5);
  y = rowFields(
    [
      { label: "P.O.", value: text(fd.permanentPO || fd.villagePO) },
      { label: "P.S.", value: text(fd.permanentPS || fd.villagePS) },
      { label: "Dist.", value: text(fd.permanentDistrict || fd.villageDistrict) },
      { label: "State", value: text(fd.permanentState || fd.villageState) },
      { label: "PIN", value: text(fd.permanentPin || fd.villagePin) },
    ],
    y,
    8.8,
  );
  y = rowFields(
    [
      { label: "6. Ex-Service No.", value: text(person?.exServiceNo || fd.exServiceNo) },
      { label: "Rank", value: text(fd.exRank) },
    ],
    y,
    9.5,
  );
  y = rowFields(
    [
      { label: "7. Date of Discharge", value: dmy(fd.exDischargeDate) },
      { label: "Discharge Book No.", value: text(fd.exDischargeBook) },
    ],
    y,
    9.5,
  );
  y = lineFill("8. Gun Licence No.", text(person?.armsLicenseNo || fd.gunLicence) || "NA", y, 9.5);
  y = lineFill("9. Gun No. (SSSL / DBBL)", text(fd.gunNo) || "NA", y, 9.5);
  y = lineFill("10. Qualification", text(fd.qualification), y, 9.5);
  y = lineFill("11. Other qualification", text(fd.otherQualification || fd.characterCertificate), y, 9.5);
  write("12. Experience, if any :", left, y, 9.5);
  const expX = left + 48;
  tickBox(expX, y, experienceIsFresher(fd));
  pdf.setFont("times", "normal");
  pdf.setFontSize(9.5);
  pdf.text("Fresher", expX + 5, y);
  tickBox(expX + 28, y, experienceIsExperienced(fd));
  pdf.text("Experienced", expX + 33, y);
  y += 6;
  if (experienceIsExperienced(fd)) {
    const details = experienceShown(fd);
    if (details && details.toUpperCase() !== "FRESHER") y = lineFill("Details", details, y, 9.5);
  }
  y = lineFill(
    "a) Previous Employer",
    text(fd.previousEmployer) || (String(fd.experienceType || "").toUpperCase() === "FRESHER" ? "None" : ""),
    y,
    9.5,
  );
  y = rowFields(
    [
      { label: "b) UAN / PF", value: text(person?.uan || fd.uan) || "NA" },
      { label: "c) ESI IP No.", value: text(person?.esicNo || fd.esiIp) || "NA" },
    ],
    y,
    9.5,
  );
  write("13. Religion :", left, y, 9.5);
  const relX = left + 32;
  const mark = (label: string, on: boolean, x: number) => {
    tickBox(x, y, on);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.text(label, x + 5, y);
  };
  const rel = religion.toLowerCase();
  mark("Hindu", rel.includes("hindu"), relX);
  mark("Muslim", rel.includes("muslim") || rel.includes("islam"), relX + 28);
  mark("Christian", rel.includes("christian"), relX + 58);
  y += 5.5;
  y = lineFill("14. Identification Mark", text(fd.identificationMark), y, 9.5);
  y = rowFields(
    [
      { label: "15. Nationality", value: text(fd.nationality) || "Indian" },
      { label: "Height", value: heightShown(fd) },
      { label: "Weight", value: text(fd.weight) ? `${text(fd.weight)} Kgs` : "" },
    ],
    y,
    9.5,
  );
  y = rowFields(
    [
      { label: "16. Nominee", value: text(fd.nominee) },
      { label: "Relation", value: text(fd.nomineeRelation) },
    ],
    y,
    9.5,
  );
  y = wrap(
    `17. Reference : ${text(fd.reference) || "________"} known since last ${text(fd.referenceYears) || "__"} yrs. I stand guarantor for him/her.`,
    left,
    y,
    width,
    9,
  );
  y += 2.5;
  pdf.setFont("times", "normal");
  pdf.setFontSize(10.5);
  pdf.text("18. Family Member Details :", left, y);
  const familyMark = (label: string, on: boolean, x: number) => {
    tickBox(x, y, on);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.text(label, x + 5, y);
  };
  familyMark("Yes", familyYes(fd), left + 58);
  familyMark("No", !familyYes(fd), left + 82);
  y += 7;
  if (familyYes(fd)) {
    const cols = [left, left + 12, left + 72, left + 108, left + 148, right];
    const headers = ["Sl.", "Name of Family Members", "Relation", "Date of Birth", "Aadhaar No."];
    pdf.setFont("times", "bold");
    pdf.setFontSize(8);
    pdf.rect(left, y, width, 6);
    for (let i = 1; i < cols.length - 1; i += 1) pdf.line(cols[i], y, cols[i], y + 6);
    headers.forEach((h, i) => pdf.text(h, cols[i] + 1.2, y + 4.1));
    y += 6;
    pdf.setFont("times", "normal");
    familyRows(fd).forEach((member: any, idx: number) => {
      pdf.rect(left, y, width, 6);
      for (let i = 1; i < cols.length - 1; i += 1) pdf.line(cols[i], y, cols[i], y + 6);
      const cells = [
        String(idx + 1),
        text(member.name),
        text(member.relation),
        dmy(member.dateOfBirth),
        text(member.aadhaar),
      ];
      cells.forEach((c, i) => {
        const maxW = cols[i + 1] - cols[i] - 2.2;
        pdf.text(pdf.splitTextToSize(c, maxW)[0] || "", cols[i] + 1.2, y + 4.1);
      });
      y += 6;
    });
    y += 5;
  }
  pdf.setFont("times", "normal");
  pdf.setFontSize(10.5);
  pdf.text("19. Bank Details :", left, y);
  familyMark("Yes", bankYes(fd), left + 42);
  familyMark("No", !bankYes(fd), left + 66);
  y += 7;
  if (bankYes(fd)) {
    y = rowFields(
      [
        { label: "SB A/C No.", value: text(person?.bankAccountNo || fd.accountNo) },
        { label: "IFSC", value: text(person?.bankIfsc || fd.ifsc) },
      ],
      y,
    );
    y = lineFill("Bank Name", text(fd.bankName), y);
    y = lineFill("Branch name & address", text(person?.bankBranch || fd.branchName), y);
  }
  footer("Full Signature of the Applicant");

  const writeFullPageList = (
    heading: string,
    intro: string,
    points: string[],
    extraHeader?: () => number,
  ) => {
    pdf.addPage();
    const boxLeft = 10;
    const boxTop = 10;
    const boxW = 190;
    const boxH = 258;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.7);
    pdf.rect(boxLeft, boxTop, boxW, boxH);
    let top = 18;
    if (extraHeader) top = extraHeader();
    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.text(heading, pageW / 2, top, { align: "center" });
    top += 8;
    const footerY = 262;
    const startY = top;
    const available = footerY - startY - 2;

    const blocksAt = (size: number) => {
      pdf.setFont("times", "normal");
      pdf.setFontSize(size);
      const out: string[][] = [];
      if (intro) out.push(pdf.splitTextToSize(intro, width));
      points.forEach((point, idx) => out.push(pdf.splitTextToSize(`${idx + 1}.  ${point}`, width)));
      return out;
    };

    let size = 10.5;
    let blocks = blocksAt(size);
    let lineCount = blocks.reduce((sum, block) => sum + block.length, 0);
    let gap = 1.1;
    let lh = size * 0.42;
    while (size > 7.4) {
      const used = lineCount * lh + Math.max(0, blocks.length - 1) * gap;
      if (used <= available) break;
      size -= 0.3;
      blocks = blocksAt(size);
      lineCount = blocks.reduce((sum, block) => sum + block.length, 0);
      lh = size * 0.4;
    }
    const used = lineCount * lh + Math.max(0, blocks.length - 1) * gap;
    if (used < available) gap += (available - used) / Math.max(blocks.length, 1);

    let cy = startY;
    pdf.setFont("times", "normal");
    pdf.setFontSize(size);
    blocks.forEach((block) => {
      pdf.text(block, left, cy);
      cy += block.length * lh + gap;
    });
    footer("Full Signature of the Applicant");
  };

  writeFullPageList("DECLARATION", DECLARATION.intro, DECLARATION.points);

  writeFullPageList("TERMS & CONDITIONS", `(${TERMS.note})`, TERMS.points, () => {
    let hy = 16;
    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.text(companyName, pageW / 2, hy, { align: "center" });
    hy += 6;
    pdf.setFont("times", "normal");
    pdf.setFontSize(9);
    for (const line of address) {
      pdf.text(line, pageW / 2, hy, { align: "center" });
      hy += 4;
    }
    if (nk) {
      pdf.text(`Website : ${NK.website}, Email : ${NK.email}  Mobile : ${NK.mobile}`, pageW / 2, hy, { align: "center" });
      hy += 5;
    }
    return hy + 2;
  });

  stampPageNumbers();
  return pdf;
}

export async function downloadPaperFormPdf(
  person: any,
  filename: string,
  company?: { slug?: string; legalName?: string; shortName?: string },
) {
  const pdf = await buildPaperFormPdf(person, company);
  saveBlob(pdf.output("blob"), filename);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export async function printPaperFormPdf(
  person: any,
  company?: { slug?: string; legalName?: string; shortName?: string },
) {
  const pdf = await buildPaperFormPdf(person, company);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Paper form");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
      reject(new Error("The paper form could not be opened for print."));
    }, 20000);
    frame.onload = () => {
      window.clearTimeout(timer);
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch {
        saveBlob(blob, paperFormFileName(person));
        resolve();
      }
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 120000);
    };
    frame.src = url;
  });
}
