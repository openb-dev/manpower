"use client";

import React, { useEffect, useRef, useState } from "react";
import { DECLARATION, TERMS } from "@/server/data/joiningText.js";
import { applicantPhotoUrl, applicationDisplayId } from "@/lib/applicantFormFields";

const NK_LETTERHEAD = {
  address: [
    "Nabanari Apartment, F-3/2, 3rd Floor, Mohishgote, Dhalipara,",
    "P.O.- Krishnapur, P.S.- New Town, Kolkata-700102",
  ],
  website: "www.nkenterprisekolkata.com",
  email: "nkenterprise063@gmail.com",
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

function Blank({
  value,
  className = "",
  min = "4.5rem",
}: {
  value?: unknown;
  className?: string;
  min?: string;
}) {
  const filled = text(value);
  const fill = className.includes("flex-1") || className.includes("w-full");
  return (
    <span
      className={`${fill ? "block min-w-0" : "inline-block"} border-b border-dotted border-black px-1 leading-snug align-bottom ${className}`}
      style={fill ? { minWidth: 0 } : { minWidth: min }}
    >
      {filled ? <span className="font-semibold break-words">{filled}</span> : <span>&nbsp;</span>}
    </span>
  );
}

function LineField({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: unknown;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-1.5 min-w-0 ${className}`}>
      <span className="shrink-0">{label} :</span>
      <span className="flex-1 min-w-0 overflow-hidden border-b border-dotted border-black font-semibold leading-snug break-words min-h-[1.15em]">
        {text(value) || "\u00a0"}
      </span>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] leading-none mr-1 align-middle">
      {on ? "✓" : ""}
    </span>
  );
}

function Footer({
  date,
  time,
  name,
  label,
  page,
  total = 3,
}: {
  date: string;
  time?: string;
  name: string;
  label: string;
  page: number;
  total?: number;
}) {
  return (
    <div className="mt-auto shrink-0 pt-4 grid grid-cols-3 items-end gap-3 text-[12px]">
      <div>
        Date : <Blank value={date} min="8rem" /> Time : <Blank value={time} min="6rem" />
      </div>
      <div className="text-center text-[11px] pb-1">
        Page {page} of {total}
      </div>
      <div className="text-right min-w-0">
        <div className="border-b border-black min-h-[1.4em] font-semibold">{name || "\u00a0"}</div>
        <div className="text-[11px] mt-1">({label})</div>
      </div>
    </div>
  );
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

function FamilyTable({ fd }: { fd: Record<string, any> }) {
  return (
    <table className="w-full border-collapse border border-black text-[11px] mt-1">
      <thead>
        <tr>
          <th className="border border-black w-8 py-0.5 font-semibold">Sl.</th>
          <th className="border border-black py-0.5 font-semibold">Name</th>
          <th className="border border-black py-0.5 font-semibold">Relation</th>
          <th className="border border-black py-0.5 font-semibold">Date of Birth</th>
          <th className="border border-black py-0.5 font-semibold">Aadhaar No.</th>
        </tr>
      </thead>
      <tbody>
        {familyRows(fd).map((member: any, idx: number) => (
          <tr key={idx}>
            <td className="border border-black text-center py-0.5">{idx + 1}</td>
            <td className="border border-black px-1 py-0.5">{text(member.name)}</td>
            <td className="border border-black px-1 py-0.5">{text(member.relation)}</td>
            <td className="border border-black px-1 py-0.5">{dmy(member.dateOfBirth)}</td>
            <td className="border border-black px-1 py-0.5">{text(member.aadhaar)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BankFields({
  account,
  ifsc,
  bankName,
  branch,
}: {
  account?: unknown;
  ifsc?: unknown;
  bankName?: unknown;
  branch?: unknown;
}) {
  return (
    <div className="mt-1 space-y-1">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4">
        <LineField label="SB A/C No." value={account} />
        <LineField label="IFSC" value={ifsc} />
      </div>
      <LineField label="Bank Name" value={bankName} />
      <LineField label="Branch name & address" value={branch} />
    </div>
  );
}

function DashBits({
  items,
}: {
  items: { label: string; value?: unknown; min?: string; grow?: boolean }[];
}) {
  return (
    <span className="flex flex-wrap items-end gap-x-2 gap-y-0.5 min-w-0 flex-1">
      {items.map((item) => (
        <span key={item.label} className={`inline-flex items-end gap-1 min-w-0 ${item.grow ? "flex-1" : ""}`}>
          <span className="shrink-0 whitespace-nowrap">{item.label} :</span>
          <span
            className={`${item.grow ? "flex-1 min-w-[2.8rem]" : "inline-block"} border-b border-dotted border-black px-0.5 font-semibold leading-tight break-words`}
            style={item.grow ? undefined : { minWidth: item.min || "3.2rem" }}
          >
            {text(item.value) || "\u00a0"}
          </span>
        </span>
      ))}
    </span>
  );
}

function AddressLines({
  locality,
  po,
  ps,
  district,
  state,
  pin,
}: {
  locality?: unknown;
  po?: unknown;
  ps?: unknown;
  district?: unknown;
  state?: unknown;
  pin?: unknown;
}) {
  return (
    <div className="w-full min-w-0 space-y-0.5">
      <DashBits items={[{ label: "Vill. / Locality", value: locality, grow: true }]} />
      <DashBits
        items={[
          { label: "P.O.", value: po, grow: true },
          { label: "P.S.", value: ps, grow: true },
          { label: "Dist.", value: district, grow: true },
          { label: "State", value: state, grow: true },
          { label: "PIN", value: pin, min: "3.6rem" },
        ]}
      />
    </div>
  );
}

function ScaledPaper({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      const natural = 210 * (96 / 25.4);
      setScale(Math.min(1, box.clientWidth / Math.max(natural, 1)));
      setInnerH(inner.scrollHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="paper-form-scale-box">
      <div className="overflow-hidden" style={{ height: innerH ? innerH * scale : undefined }}>
        <div
          ref={innerRef}
          className="paper-form-pack"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function letterhead(company?: { legalName?: string; shortName?: string; slug?: string }) {
  const name = company?.legalName || company?.shortName || "M/s. N.K. Enterprise";
  const nk = !company?.slug || company.slug === "nk";
  return {
    name,
    address: nk ? NK_LETTERHEAD.address : ["West Bengal, India"],
    website: nk ? NK_LETTERHEAD.website : "",
    email: nk ? NK_LETTERHEAD.email : "",
    mobile: nk ? NK_LETTERHEAD.mobile : "",
  };
}

export function ApplicantPaperForm({
  person,
  company,
}: {
  person: any;
  company?: { legalName?: string; shortName?: string; slug?: string } | null;
}) {
  const fd = person?.formData || {};
  const head = letterhead(company);
  const name = text(person?.fullName || fd.name);
  const father = text(person?.fatherOrHusband || fd.fatherOrHusband);
  const dob = dmy(person?.dateOfBirth || fd.dateOfBirth);
  const age = text(fd.age);
  const presentLocality = text(fd.presentAddress) || text(fd.localAddress) || text(person?.presentAddress);
  const permanentLocality = text(fd.permanentAddress) || text(fd.villageAddress) || text(person?.permanentAddress);
  const presentPO = text(fd.presentPO || fd.localPO);
  const presentPS = text(fd.presentPS || fd.localPS);
  const presentDistrict = text(fd.presentDistrict || fd.localDistrict);
  const presentState = text(fd.presentState || fd.localState);
  const presentPin = text(fd.presentPin || fd.localPin);
  const permanentPO = text(fd.permanentPO || fd.villagePO);
  const permanentPS = text(fd.permanentPS || fd.villagePS);
  const permanentDistrict = text(fd.permanentDistrict || fd.villageDistrict);
  const permanentState = text(fd.permanentState || fd.villageState);
  const permanentPin = text(fd.permanentPin || fd.villagePin);
  const religion = text(fd.religion).toLowerCase();
  const photo = applicantPhotoUrl(person);
  const signedAt = fd.submittedAt || person?.createdAt || person?.joiningDate;
  const signedOn = dmy(signedAt);
  const signedTime = hm(fd.submittedAt || person?.createdAt);
  const account = text(person?.bankAccountNo || fd.accountNo);
  const ifsc = text(person?.bankIfsc || fd.ifsc);
  return (
    <ScaledPaper>
    <div className="text-black">
      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex-1 flex justify-center">
              <div className="bg-black text-white text-center text-[11px] font-bold px-6 py-0.5 rounded-sm">
                APPLICATION FOR EMPLOYMENT
              </div>
            </div>
            <div className="text-right text-[11px] font-bold whitespace-nowrap">
              Application ID : {applicationDisplayId(person) || "—"}
            </div>
          </div>
          <div className="relative min-h-[78px] mb-1 pr-[78px]">
            <div className="absolute top-0 right-0 w-[66px] h-[82px] border border-black bg-white overflow-hidden flex items-center justify-center">
              {photo ? (
                <img src={photo} alt={name} className="max-w-full max-h-full object-contain" />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-bold leading-tight">{head.name}</div>
              {head.address.map((line) => (
                <div key={line} className="text-[10px] leading-snug">
                  {line}
                </div>
              ))}
              <div className="text-[10px] leading-snug mt-0.5">
                {head.website ? <>Website : {head.website}, </> : null}
                {head.email ? <>Email : {head.email}</> : null}
              </div>
              {head.mobile ? <div className="text-[10px]">Mobile : {head.mobile}</div> : null}
            </div>
          </div>

          <div className="mt-1 mb-0.5">
            <DashBits items={[{ label: "Application ID", value: applicationDisplayId(person), grow: true }]} />
          </div>

          {(person?.jobRole?.name || person?.roleCategory?.name || fd.skillCategory || fd.gemExperience) && (
            <p className="mt-2 text-[11px] leading-snug break-words">
              Post applied :{" "}
              <span className="font-semibold">
                {[
                  person?.jobRole?.name,
                  fd.otherCategory || fd.gemProfile || person?.roleCategory?.name,
                  fd.skillCategory,
                  fd.gemExperience,
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </span>
            </p>
          )}

          <ol className="mt-1 space-y-0.5 text-[10.5px] leading-tight list-none flex-1">
            <li className="flex gap-2">
              <span className="w-4 shrink-0">1.</span>
              <DashBits
                items={[
                  { label: "Name in full", value: name, grow: true },
                  { label: "D.O.B.", value: dob, min: "4.8rem" },
                  { label: "Age", value: age, min: "2.2rem" },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">2.</span>
              <DashBits items={[{ label: "Father's / Husband Name", value: father, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">3.</span>
              <DashBits
                items={[
                  { label: "Mobile", value: person?.mobile || fd.mobile, min: "5.4rem" },
                  { label: "Emergency contact", value: fd.emergencyContact, min: "5.4rem" },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">4.</span>
              <div className="flex-1 min-w-0">
                <div>Present Address :</div>
                <AddressLines
                  locality={presentLocality}
                  po={presentPO}
                  ps={presentPS}
                  district={presentDistrict}
                  state={presentState}
                  pin={presentPin}
                />
              </div>
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">5.</span>
              <div className="flex-1 min-w-0">
                <div>Permanent Address :</div>
                <AddressLines
                  locality={permanentLocality}
                  po={permanentPO}
                  ps={permanentPS}
                  district={permanentDistrict}
                  state={permanentState}
                  pin={permanentPin}
                />
              </div>
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">6.</span>
              <DashBits
                items={[
                  { label: "Ex-Service No.", value: person?.exServiceNo || fd.exServiceNo, grow: true },
                  { label: "Rank", value: fd.exRank, grow: true },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">7.</span>
              <DashBits
                items={[
                  { label: "Date of Discharge", value: dmy(fd.exDischargeDate), grow: true },
                  { label: "Discharge Book No.", value: fd.exDischargeBook, grow: true },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">8.</span>
              <DashBits items={[{ label: "Gun Licence No.", value: person?.armsLicenseNo || fd.gunLicence, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">9.</span>
              <DashBits items={[{ label: "Gun No. (SSSL / DBBL)", value: fd.gunNo, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">10.</span>
              <DashBits items={[{ label: "Qualification", value: fd.qualification, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">11.</span>
              <DashBits items={[{ label: "Other qualification", value: fd.otherQualification || fd.characterCertificate, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">12.</span>
              <div className="flex-1 min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-x-3">
                  Experience, if any :
                  <span>
                    <Tick on={experienceIsFresher(fd)} /> Fresher
                  </span>
                  <span>
                    <Tick on={experienceIsExperienced(fd)} /> Experienced
                  </span>
                </span>
                {experienceIsExperienced(fd) && experienceShown(fd) && experienceShown(fd).toUpperCase() !== "FRESHER" ? (
                  <DashBits items={[{ label: "Details", value: experienceShown(fd), grow: true }]} />
                ) : null}
                <DashBits
                  items={[
                    {
                      label: "a) Previous Employer",
                      value:
                        text(fd.previousEmployer) ||
                        (String(fd.experienceType || "").toUpperCase() === "FRESHER" ? "None" : ""),
                      grow: true,
                    },
                  ]}
                />
                <DashBits
                  items={[
                    { label: "b) UAN / PF", value: text(person?.uan || fd.uan) || "NA", grow: true },
                    { label: "c) ESI IP No.", value: text(person?.esicNo || fd.esiIp) || "NA", grow: true },
                  ]}
                />
              </div>
            </li>
            <li className="flex gap-2 items-center">
              <span className="w-4 shrink-0">13.</span>
              <span className="flex flex-wrap items-center gap-x-3">
                <span className="shrink-0">Religion :</span>
                <span>
                  <Tick on={religion.includes("hindu")} /> Hindu
                </span>
                <span>
                  <Tick on={religion.includes("muslim") || religion.includes("islam")} /> Muslim
                </span>
                <span>
                  <Tick on={religion.includes("christian")} /> Christian
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">14.</span>
              <DashBits items={[{ label: "Identification Mark", value: fd.identificationMark, grow: true }]} />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">15.</span>
              <DashBits
                items={[
                  { label: "Nationality", value: fd.nationality, grow: true },
                  { label: "Height", value: heightShown(fd), min: "3.2rem" },
                  { label: "Weight", value: fd.weight ? `${text(fd.weight)} Kgs` : "", min: "3.2rem" },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">16.</span>
              <DashBits
                items={[
                  { label: "Nominee", value: fd.nominee, grow: true },
                  { label: "Relation", value: fd.nomineeRelation, grow: true },
                ]}
              />
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">17.</span>
              <span className="flex-1">
                Reference : <Blank value={fd.reference} className="min-w-[8rem]" /> known since last{" "}
                <Blank value={fd.referenceYears} min="2.2rem" /> yrs. I stand guarantor for him/her.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">18.</span>
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-x-3">
                  Family Member Details :
                  <span>
                    <Tick on={familyYes(fd)} /> Yes
                  </span>
                  <span>
                    <Tick on={!familyYes(fd)} /> No
                  </span>
                </span>
                {familyYes(fd) ? <FamilyTable fd={fd} /> : null}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-4 shrink-0">19.</span>
              <span className="flex-1 min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-x-3">
                  Bank Details :
                  <span>
                    <Tick on={bankYes(fd)} /> Yes
                  </span>
                  <span>
                    <Tick on={!bankYes(fd)} /> No
                  </span>
                </span>
                {bankYes(fd) ? (
                  <BankFields
                    account={account}
                    ifsc={ifsc}
                    bankName={fd.bankName}
                    branch={person?.bankBranch || fd.branchName}
                  />
                ) : null}
              </span>
            </li>
          </ol>

          <Footer date={signedOn} time={signedTime} name={name} label="Full Signature of the Applicant" page={1} />
        </div>
      </section>

      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col min-h-[297mm]">
          <div className="flex-1 min-h-0 border-2 border-black px-3 py-3 flex flex-col">
            <h2 className="text-center text-[22px] font-bold mb-3">DECLARATION</h2>
            <p className="text-[13px] mb-3">{DECLARATION.intro}</p>
            <ol className="flex-1 space-y-1.5 text-[11.5px] leading-snug list-decimal pl-5">
              {DECLARATION.points.map((point: string) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          </div>
          <Footer date={signedOn} time={signedTime} name={name} label="Full Signature of the Applicant" page={2} />
        </div>
      </section>

      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col min-h-[297mm]">
          <div className="flex-1 min-h-0 border-2 border-black px-3 py-3 flex flex-col">
            <div className="text-center mb-3">
              <div className="text-[22px] font-bold leading-none">{head.name}</div>
              {head.address.map((line) => (
                <div key={line} className="text-[11px] leading-snug">
                  {line}
                </div>
              ))}
              <div className="text-[11px] leading-snug">
                {head.website ? <>Website : {head.website}, </> : null}
                {head.email ? <>Email : {head.email} </> : null}
                {head.mobile ? <>Mobile : {head.mobile}</> : null}
              </div>
            </div>
            <h2 className="text-center text-[18px] font-bold">TERMS &amp; CONDITIONS</h2>
            <p className="text-center text-[12px] mb-3">({TERMS.note})</p>
            <ol className="flex-1 space-y-1 text-[10.5px] leading-snug list-decimal pl-5">
              {TERMS.points.map((point: string) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          </div>
          <Footer date={signedOn} time={signedTime} name={name} label="Full Signature of the Applicant" page={3} />
        </div>
      </section>
    </div>
    </ScaledPaper>
  );
}
