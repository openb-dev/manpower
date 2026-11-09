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

function familyRows(family: unknown) {
  const rows = Array.isArray(family) ? family.slice(0, 5) : [];
  while (rows.length < 5) rows.push({ name: "", relation: "", dateOfBirth: "", aadhaar: "" });
  return rows;
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
  const local = text(fd.localAddress || person?.presentAddress);
  const village = text(fd.villageAddress || person?.permanentAddress);
  const present = text(person?.presentAddress || fd.presentAddress);
  const permanent = text(person?.permanentAddress || fd.permanentAddress);
  const religion = text(fd.religion);
  const employeeIdNo = text(person?.employeeCode || person?.employee?.employeeCode || fd.officeApplicantId);
  const filledBy = fd.filledByAdmin && typeof fd.filledByAdmin === "object" ? fd.filledByAdmin : null;
  const signedOn = dmy(person?.joiningDate || person?.createdAt);
  const postApplied = [person?.jobRole?.name, person?.roleCategory?.name, fd.skillCategory, fd.gemExperience]
    .filter(Boolean)
    .join(" / ");
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

  const lineFill = (label: string, value: string, y: number, size = 10.5) => {
    pdf.setFont("times", "normal");
    pdf.setFontSize(size);
    const labelW = pdf.getTextWidth(label + " ");
    pdf.text(label, left, y);
    const val = value || "";
    pdf.setFont("times", "bold");
    const lines = pdf.splitTextToSize(val, width - labelW - 2);
    pdf.text(lines, left + labelW, y);
    const used = Math.max(1, lines.length) * (size * 0.42);
    const underlineY = y + 1.1;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.2);
    pdf.line(left + labelW, underlineY, right, underlineY);
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i += 1) {
        pdf.line(left, y + i * (size * 0.42) + 1.1, right, y + i * (size * 0.42) + 1.1);
      }
    }
    return y + used + 3.2;
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
    write(`Date : ${signedOn}`, left, 278, 10);
    pdf.setFont("times", "bold");
    pdf.text(name, right, 274, { align: "right" });
    pdf.setLineWidth(0.2);
    pdf.line(right - 52, 275, right, 275);
    pdf.setFont("times", "normal");
    pdf.setFontSize(9);
    pdf.text(`(${label})`, right, 279, { align: "right" });
  };

  const letterhead = (startY: number, withPhoto = false) => {
    const photoW = 25;
    const photoH = 32;
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

  // Page 1
  let y = banner("APPLICATION FOR EMPLOYMENT", 16);
  y = letterhead(y + 4, true);
  write("Dear Sir,", left, y, 10.5);
  y += 5;
  write("I seek for Employment in your Organisation with Immediate Effect.", left, y, 10.5);
  y += 5;
  write("My Bio-data is given below :-", left, y, 10.5);
  y += 6;
  y = lineFill("Employee ID No. :", employeeIdNo, y);
  if (filledBy) {
    y = lineFill(
      "Form filled up by admin :",
      [text(filledBy.name), text(filledBy.email) && `Email ${text(filledBy.email)}`, (text(filledBy.userId) || text(filledBy.id)) && `ID ${text(filledBy.userId || filledBy.id)}`]
        .filter(Boolean)
        .join("  ·  "),
      y,
    );
  }
  if (postApplied) y = lineFill("Post applied :", postApplied, y);
  y = lineFill("1. Name in full", name, y);
  y = lineFill("2. Father's / Husband Name", father, y);
  pdf.setFont("times", "normal");
  pdf.setFontSize(10.5);
  pdf.text("3. Date of Birth", left, y);
  const dobLabelW = pdf.getTextWidth("3. Date of Birth ");
  pdf.setFont("times", "bold");
  pdf.text(dob || "", left + dobLabelW, y);
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.2);
  pdf.line(left + dobLabelW, y + 1.1, left + 92, y + 1.1);
  pdf.setFont("times", "normal");
  pdf.text("Age", left + 96, y);
  const ageLabelW = pdf.getTextWidth("Age ");
  pdf.setFont("times", "bold");
  pdf.text(age || "", left + 96 + ageLabelW, y);
  pdf.line(left + 96 + ageLabelW, y + 1.1, right, y + 1.1);
  y += 8.5;
  y = lineFill("4. Local Address", local, y);
  y = lineFill("     P.O. / P.S.", [text(fd.localPO), text(fd.localPS)].filter(Boolean).join(" / "), y);
  y = lineFill(
    "     PIN / Dist. / State / Country",
    [text(fd.localPin), text(fd.localDistrict), text(fd.localState), text(fd.localCountry)].filter(Boolean).join(" / "),
    y,
  );
  y = lineFill("5. Village Address", village, y);
  y = lineFill("     Vill. / P.O. / P.S.", [village, text(fd.villagePO), text(fd.villagePS)].filter(Boolean).join(" / "), y);
  y = lineFill(
    "     PIN / Dist. / State / Country",
    [text(fd.villagePin), text(fd.villageDistrict), text(fd.villageState), text(fd.villageCountry)].filter(Boolean).join(" / "),
    y,
  );
  y = lineFill(
    "6. No. & Rank if Ex-Service man",
    [text(person?.exServiceNo || fd.exServiceNo), text(fd.exRank)].filter(Boolean).join(" / ") || "NA",
    y,
  );
  y = lineFill("7. Date of Discharge / Discharge Book No.", [dmy(fd.exDischargeDate), text(fd.exDischargeBook)].filter(Boolean).join(" / "), y);
  y = lineFill("8. Gun Licence No.", text(person?.armsLicenseNo || fd.gunLicence) || "NA", y);
  y = lineFill("9. Gun No. (SSSL / DBBL)", text(fd.gunNo) || "NA", y);
  y = lineFill("10. Qualification", text(fd.qualification), y);
  y = lineFill("11. Other qualification", text(fd.otherQualification || fd.characterCertificate), y);
  y = lineFill("12. Experience, if any", experienceShown(fd), y);
  write("13. Religion", left, y);
  const relX = left + 28;
  const mark = (label: string, on: boolean, x: number) => {
    pdf.rect(x, y - 3.2, 3.2, 3.2);
    if (on) {
      pdf.setFont("times", "bold");
      pdf.setFontSize(9);
      pdf.text("X", x + 0.6, y - 0.4);
    }
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.text(label, x + 5, y);
  };
  const rel = religion.toLowerCase();
  mark("Hindu", rel.includes("hindu"), relX);
  mark("Muslim", rel.includes("muslim") || rel.includes("islam"), relX + 28);
  mark("Christian", rel.includes("christian"), relX + 58);
  y += 7;
  y = lineFill("14. Identification Mark", text(fd.identificationMark), y);
  y = lineFill(
    "15. Nationality / Height / Weight",
    [text(fd.nationality) || "Indian", heightShown(fd), text(fd.weight) ? `${text(fd.weight)} Kgs` : ""].filter(Boolean).join("   /   "),
    y,
  );
  y = lineFill("16. Name of nominee / Relation", [text(fd.nominee), text(fd.nomineeRelation)].filter(Boolean).join(" / "), y);
  y = wrap(
    `17. Reference : ${text(fd.reference) || "________________"}  - certificate that the above named individual is known to me since last ${text(fd.referenceYears) || "____"} yrs. He bears a good moral character and I stand guarantor for him/her.`,
    left,
    y,
    width,
    10,
  );
  footer("Full Signature of the Applicant");

  // Page 2
  pdf.addPage();
  y = 18;
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text(companyName, pageW / 2, y, { align: "center" });
  y += 5;
  pdf.setFont("times", "normal");
  pdf.setFontSize(9);
  for (const line of address) {
    pdf.text(line, pageW / 2, y, { align: "center" });
    y += 4;
  }
  if (nk) {
    pdf.text(`Website : ${NK.website}, Email : ${NK.email} Mobile : ${NK.mobile}`, pageW / 2, y, { align: "center" });
  }
  y = banner("EMPLOYEE'S DECLARATION", y + 8);
  y += 4;
  y = lineFill("1. Name (Capital letter as per Aadhaar) :", name.toUpperCase(), y);
  y = lineFill("2. Father's Name (as per Aadhaar) :", father, y);
  y = lineFill("3. Date of Birth (as per Aadhaar) :", dob, y);
  y = lineFill("4. Present Address :", present, y);
  y = lineFill("     P.O. / P.S. / PIN", [text(fd.presentPO), text(fd.presentPS), text(fd.presentPin)].filter(Boolean).join(" / "), y);
  y = lineFill(
    "     Dist. / State / Country",
    [text(fd.presentDistrict), text(fd.presentState), text(fd.presentCountry)].filter(Boolean).join(" / "),
    y,
  );
  y = lineFill("5. Permanent Address :", permanent, y);
  y = lineFill("     P.O. / P.S. / PIN", [text(fd.permanentPO), text(fd.permanentPS), text(fd.permanentPin)].filter(Boolean).join(" / "), y);
  y = lineFill(
    "     Dist. / State / Country",
    [text(fd.permanentDistrict), text(fd.permanentState), text(fd.permanentCountry)].filter(Boolean).join(" / "),
    y,
  );
  y = lineFill("6. Contact Mobile No. :", text(person?.mobile || fd.mobile), y);
  y = lineFill("7. Educational Qualification :", text(fd.qualification), y);
  y = lineFill("8. Aadhaar No. & PAN No. (own) :", [text(person?.aadhaarDisplay || fd.aadhaar), text(person?.pan || fd.pan)].filter(Boolean).join(" / "), y);
  y = lineFill("9. a) Name of Previous Employer :", text(fd.previousEmployer), y);
  y = lineFill("     b) UAN No. (if allotted) :", text(person?.uan || fd.uan), y);
  y = lineFill("     c) ESI IP No. :", text(person?.esicNo || fd.esiIp), y);
  write("10. Family Details :", left, y, 10.5);
  y += 3;
  const cols = [left, left + 12, left + 72, left + 108, left + 148, right];
  const headers = ["Sl.", "Name of Family Members", "Relation", "Date of Birth", "Aadhaar No."];
  pdf.setFont("times", "bold");
  pdf.setFontSize(8.5);
  pdf.rect(left, y, width, 7);
  for (let i = 1; i < cols.length - 1; i += 1) pdf.line(cols[i], y, cols[i], y + 7);
  headers.forEach((h, i) => pdf.text(h, cols[i] + 1.2, y + 4.6));
  y += 7;
  pdf.setFont("times", "normal");
  familyRows(fd.family).forEach((member: any, idx: number) => {
    pdf.rect(left, y, width, 7);
    for (let i = 1; i < cols.length - 1; i += 1) pdf.line(cols[i], y, cols[i], y + 7);
    const cells = [String(idx + 1), text(member.name), text(member.relation), dmy(member.dateOfBirth), text(member.aadhaar)];
    cells.forEach((c, i) => {
      const maxW = cols[i + 1] - cols[i] - 2.2;
      pdf.text(pdf.splitTextToSize(c, maxW)[0] || "", cols[i] + 1.2, y + 4.6);
    });
    y += 7;
  });
  y += 5;
  write("Xerox copy of Aadhaar must be attached with form.", left, y, 8.5);
  y += 6;
  y = lineFill("11. Bank Details : SB A/C No.", text(person?.bankAccountNo || fd.accountNo), y);
  y = lineFill("      IFSC Code :", text(person?.bankIfsc || fd.ifsc), y);
  y = lineFill("      Bank Name & Branch", [text(fd.bankName), text(person?.bankBranch || fd.branchName)].filter(Boolean).join(", "), y);
  y = lineFill("12. Nominee Name / Relation", [text(fd.nominee), text(fd.nomineeRelation)].filter(Boolean).join(" / "), y);
  y = lineFill("13. Dispensary or Dr. Name where IP preferred", text(fd.preferredDispensary), y);
  write(
    "**Note : Xerox copy of Aadhaar, PAN and Bank Pass Book / Cancelled Cheque attached with self-attested.",
    left,
    268,
    8,
  );
  footer("Signature of Employee");

  // Page 3
  pdf.addPage();
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text("18. DECLARATION", pageW / 2, 18, { align: "center" });
  y = 26;
  y = wrap(DECLARATION.intro, left, y, width, 10.5);
  y += 2;
  DECLARATION.points.forEach((point: string, idx: number) => {
    const block = pdf.splitTextToSize(`${idx + 1}.  ${point}`, width);
    if (y + block.length * 4.1 > 268) {
      footer("Full Signature of the Applicant");
      pdf.addPage();
      y = 18;
    }
    pdf.setFont("times", "normal");
    pdf.setFontSize(9.5);
    pdf.text(block, left, y);
    y += block.length * 4.1 + 0.8;
  });
  footer("Full Signature of the Applicant");

  // Page 4
  pdf.addPage();
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text("TERMS & CONDITIONS", pageW / 2, 16, { align: "center" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(9);
  pdf.text(`(${TERMS.note})`, pageW / 2, 22, { align: "center" });
  y = 28;
  TERMS.points.forEach((point: string, idx: number) => {
    const block = pdf.splitTextToSize(`${idx + 1}.  ${point}`, width);
    if (y + block.length * 3.8 > 268) {
      footer("Full Signature of the Applicant");
      pdf.addPage();
      y = 16;
    }
    pdf.setFont("times", "normal");
    pdf.setFontSize(8.8);
    pdf.text(block, left, y);
    y += block.length * 3.8 + 0.6;
  });
  footer("Full Signature of the Applicant");

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
