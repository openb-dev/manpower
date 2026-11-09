"use client";

import React from "react";
import { DECLARATION, TERMS } from "@/server/data/joiningText.js";
import { applicantPhotoUrl } from "@/lib/applicantFormFields";

const NK_LETTERHEAD = {
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
  return (
    <span
      className={`inline border-b border-black px-1 leading-snug break-words align-bottom min-w-0 ${className}`}
      style={{ minWidth: min }}
    >
      {filled ? <span className="font-semibold">{filled}</span> : <span>&nbsp;</span>}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-black text-[10px] leading-none mr-1 align-middle">
      {on ? "✓" : ""}
    </span>
  );
}

function Footer({ date, name, label }: { date: string; name: string; label: string }) {
  return (
    <div className="mt-auto shrink-0 pt-6 flex justify-between items-end gap-6 text-[12px]">
      <div>
        Date : <Blank value={date} min="8rem" />
      </div>
      <div className="text-right min-w-[14rem]">
        <div className="border-b border-black min-h-[1.4em] font-semibold">{name || "\u00a0"}</div>
        <div className="text-[11px] mt-1">({label})</div>
      </div>
    </div>
  );
}

function familyRows(family: unknown) {
  const rows = Array.isArray(family) ? family.slice(0, 5) : [];
  while (rows.length < 5) rows.push({ name: "", relation: "", dateOfBirth: "", aadhaar: "" });
  return rows;
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
  const local = text(fd.localAddress || person?.presentAddress);
  const village = text(fd.villageAddress || person?.permanentAddress);
  const present = text(person?.presentAddress || fd.presentAddress);
  const permanent = text(person?.permanentAddress || fd.permanentAddress);
  const presentPin = text(fd.presentPin);
  const permanentPin = text(fd.permanentPin);
  const religion = text(fd.religion).toLowerCase();
  const photo = applicantPhotoUrl(person);
  const signedOn = dmy(person?.joiningDate || person?.createdAt);
  const aadhaar = text(person?.aadhaarDisplay || fd.aadhaar);
  const pan = text(person?.pan || fd.pan);
  const account = text(person?.bankAccountNo || fd.accountNo);
  const ifsc = text(person?.bankIfsc || fd.ifsc);
  const branch = [text(fd.bankName), text(person?.bankBranch || fd.branchName)].filter(Boolean).join(", ");

  return (
    <div className="paper-form-pack text-black">
      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col">
          <div className="flex justify-center -mt-1 mb-3">
            <div className="bg-black text-white text-center text-[13px] font-bold px-6 py-1.5 rounded-sm">
              APPLICATION FOR EMPLOYMENT
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0 pr-2">
              <div className="text-[22px] font-bold leading-none">{head.name}</div>
              {head.address.map((line) => (
                <div key={line} className="text-[11px] leading-snug">
                  {line}
                </div>
              ))}
              <div className="text-[11px] leading-snug mt-0.5">
                {head.website ? <>Website : {head.website}, </> : null}
                {head.email ? <>Email : {head.email}</> : null}
              </div>
              {head.mobile ? <div className="text-[11px]">Mobile : {head.mobile}</div> : null}
            </div>
            <div className="w-[78px] h-[100px] border border-black shrink-0 bg-white overflow-hidden flex items-center justify-center">
              {photo ? (
                <img src={photo} alt={name} className="max-w-full max-h-full object-contain" />
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed">
            Dear Sir,
            <br />
            I seek for Employment in your Organisation with Immediate Effect.
            <br />
            My Bio-data is given below :-
          </p>
          {(person?.jobRole?.name || person?.roleCategory?.name || fd.skillCategory || fd.gemExperience) && (
            <p className="mt-1 text-[11px] leading-snug break-words">
              Post applied :{" "}
              <span className="font-semibold">
                {[person?.jobRole?.name, person?.roleCategory?.name, fd.skillCategory, fd.gemExperience]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </p>
          )}

          <ol className="mt-2 space-y-1.5 text-[12px] leading-snug list-none">
            <li className="flex gap-2">
              <span className="w-5 shrink-0">1.</span>
              <span className="flex-1 min-w-0 flex flex-wrap items-end gap-x-1">
                Name in full <Blank value={name} className="flex-1" min="8rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">2.</span>
              <span className="flex-1 min-w-0 flex flex-wrap items-end gap-x-1">
                Father&apos;s / Husband Name <Blank value={father} className="flex-1" min="8rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">3.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Date of Birth <Blank value={dob} min="7rem" /> Age <Blank value={age} min="3rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">4.</span>
              <span className="flex-1 min-w-0 space-y-1">
                <span className="block min-w-0">
                  Local Address : Name <Blank value={local} className="w-full" min="0" />
                </span>
                <span className="block">C/o. <Blank className="w-[85%]" /></span>
                <span className="flex flex-wrap items-end gap-x-2">
                  No. <Blank min="4rem" /> P.O. <Blank value={fd.localPO} min="6rem" /> P.S. <Blank value={fd.localPS} min="6rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  PIN <Blank value={fd.localPin} min="4rem" /> Dist. <Blank value={fd.localDistrict} min="6rem" /> State{" "}
                  <Blank value={fd.localState} min="6rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Country <Blank value={fd.localCountry} min="6rem" />
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">5.</span>
              <span className="flex-1 min-w-0 space-y-1">
                <span className="block min-w-0">
                  Village Address : Name <Blank value={village} className="w-full" min="0" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Father&apos;s Name <Blank value={father} min="8rem" /> H/W (Bariwala) <Blank min="5rem" />
                </span>
                <span className="block">C/o. D/o. W/o. <Blank className="w-[70%]" /></span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Vill. <Blank value={village} min="7rem" /> P.O. <Blank value={fd.villagePO} min="7rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Big P.O. - or Via <Blank min="6rem" /> P.S. <Blank value={fd.villagePS} min="6rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  PIN <Blank value={fd.villagePin} min="4rem" /> Dist. <Blank value={fd.villageDistrict} min="6rem" /> State{" "}
                  <Blank value={fd.villageState} min="6rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Country <Blank value={fd.villageCountry} min="6rem" />
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">6.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                No. &amp; Rank if Ex-Service man{" "}
                <Blank value={[text(person?.exServiceNo || fd.exServiceNo), text(fd.exRank)].filter(Boolean).join(" / ")} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">7.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                If Ex-Service Man Date of Discharge <Blank value={dmy(fd.exDischargeDate)} min="6rem" /> Discharge Book No.{" "}
                <Blank value={fd.exDischargeBook} min="5rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">8.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Gun Licence No. (with date of validity &amp; Area){" "}
                <Blank value={person?.armsLicenseNo || fd.gunLicence} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">9.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Gun No. (SSSL / DBBL) <Blank value={fd.gunNo} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">10.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Qualification <Blank value={fd.qualification} className="flex-1" />
              </span>
            </li>
            <li className="pl-5 text-[11px] italic">Xerox copies of certificate :</li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">11.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Other qualification : <Blank value={fd.otherQualification || fd.characterCertificate} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">12.</span>
              <span className="flex-1 min-w-0 flex flex-wrap items-end gap-x-1">
                Experience, if any <Blank value={experienceShown(fd)} className="flex-1" min="0" />
              </span>
            </li>
            <li className="flex gap-2 items-center">
              <span className="w-5 shrink-0">13.</span>
              <span className="flex flex-wrap items-center gap-x-4">
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
              <span className="w-5 shrink-0">14.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Identification Mark <Blank value={fd.identificationMark} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">15.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-2">
                a) Nationality <Blank value={fd.nationality} min="5rem" />
                b) Height <Blank value={heightShown(fd)} min="5rem" />
                c) Weight <Blank value={fd.weight} min="3rem" /> Kgs.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">16.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Name of nominee <Blank value={fd.nominee} min="8rem" /> Relation <Blank value={fd.nomineeRelation} min="6rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">17.</span>
              <span className="flex-1">
                Reference certificate (if any) :- certificate that the above named individual is known to me since last{" "}
                <Blank value={fd.reference} className="min-w-[12rem]" /> yrs. he bears a good moral character and I assure
                that he will surely discharge a complaint free service, if employed. I stand guarantor for him.
              </span>
            </li>
          </ol>

          <Footer date={signedOn} name={name} label="Full Signature of the Applicant" />
        </div>
      </section>

      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col">
          <div className="text-center">
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
          <div className="bg-black text-white text-center text-[13px] font-bold py-1.5 mt-3 mb-3">
            EMPLOYEE&apos;S DECLARATION
          </div>

          <ol className="space-y-1.5 text-[12px] leading-relaxed list-none">
            <li className="flex gap-2">
              <span className="w-5 shrink-0">1.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Name (Capital letter as per Aadhaar) : <Blank value={name.toUpperCase()} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">2.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Father&apos;s Name (as per Aadhaar) : <Blank value={father} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">3.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Date of Birth (as per Aadhaar) : <Blank value={dob} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">4.</span>
              <span className="flex-1 space-y-1">
                <span className="block min-w-0">
                  Present Address : <Blank value={text(fd.presentAddress) || present} className="w-full" min="0" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  P.O. <Blank value={fd.presentPO} min="6rem" /> P.S. <Blank value={fd.presentPS} min="6rem" /> PIN{" "}
                  <Blank value={presentPin} min="4rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Dist. <Blank value={fd.presentDistrict} min="6rem" /> State <Blank value={fd.presentState} min="6rem" />{" "}
                  Country <Blank value={fd.presentCountry} min="5rem" />
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">5.</span>
              <span className="flex-1 space-y-1">
                <span className="block min-w-0">
                  Permanent Address : <Blank value={text(fd.permanentAddress) || permanent} className="w-full" min="0" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  P.O. <Blank value={fd.permanentPO} min="6rem" /> P.S. <Blank value={fd.permanentPS} min="6rem" /> PIN{" "}
                  <Blank value={permanentPin} min="4rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-2">
                  Dist. <Blank value={fd.permanentDistrict} min="6rem" /> State <Blank value={fd.permanentState} min="6rem" />{" "}
                  Country <Blank value={fd.permanentCountry} min="5rem" />
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">6.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Contact Mobile No. : <Blank value={person?.mobile || fd.mobile} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">7.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Educational Qualification : <Blank value={fd.qualification} className="flex-1" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">8.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Aadhaar No. &amp; PAN No. (own) : <Blank value={aadhaar} min="8rem" /> / <Blank value={pan} min="7rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 shrink-0">9.</span>
              <span className="flex-1 space-y-1">
                <span className="flex flex-wrap items-end gap-x-1">
                  Previous Employee Details a) Name of Previous Employer : <Blank value={fd.previousEmployer} className="flex-1" />
                </span>
                <span className="flex flex-wrap items-end gap-x-1">
                  b) UAN No. (if allotted) : <Blank value={person?.uan || fd.uan} className="flex-1" />
                </span>
                <span className="flex flex-wrap items-end gap-x-1">
                  c) ESI IP No. : <Blank value={person?.esicNo || fd.esiIp} className="flex-1" />
                </span>
              </span>
            </li>
          </ol>

          <div className="mt-2 text-[12px]">10. Family Details :</div>
          <table className="w-full border-collapse border border-black text-[11px] mt-1">
            <thead>
              <tr>
                <th className="border border-black w-10 py-1 font-semibold">Sl. No.</th>
                <th className="border border-black py-1 font-semibold">Name of Family Members</th>
                <th className="border border-black py-1 font-semibold">Relation</th>
                <th className="border border-black py-1 font-semibold">Date of Birth</th>
                <th className="border border-black py-1 font-semibold">Aadhaar No.</th>
              </tr>
            </thead>
            <tbody>
              {familyRows(fd.family).map((member: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-black text-center py-1.5">{idx + 1}</td>
                  <td className="border border-black px-2 py-1.5">{text(member.name)}</td>
                  <td className="border border-black px-2 py-1.5">{text(member.relation)}</td>
                  <td className="border border-black px-2 py-1.5">{dmy(member.dateOfBirth)}</td>
                  <td className="border border-black px-2 py-1.5">{text(member.aadhaar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] mt-1">
            Xerox copy of Aadhaar must be attached with form. Use separate sheet if family members than five person.
          </p>

          <ol className="mt-2 space-y-1.5 text-[12px] leading-relaxed list-none" start={11}>
            <li className="flex gap-2">
              <span className="w-6 shrink-0">11.</span>
              <span className="flex-1 space-y-1">
                <span className="flex flex-wrap items-end gap-x-1">
                  Bank Details : SB A/C No. <Blank value={account} min="8rem" /> IFSC Code : <Blank value={ifsc} min="7rem" />
                </span>
                <span className="flex flex-wrap items-end gap-x-1">
                  Bank Name &amp; Branch add. <Blank value={branch} className="flex-1" />
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-6 shrink-0">12.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Nominee Name <Blank value={fd.nominee} min="8rem" /> Relation <Blank value={fd.nomineeRelation} min="6rem" />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-6 shrink-0">13.</span>
              <span className="flex-1 flex flex-wrap items-end gap-x-1">
                Write dispensary or Dr. Name where IP preferred <Blank value={fd.preferredDispensary} className="flex-1" />
              </span>
            </li>
          </ol>

          <Footer date={signedOn} name={name} label="Signature of Employee" />
          <p className="text-[11px] mt-3">
            **Note : Xerox copy of Aadhaar, PAN and Bank Pass Book / Cancelled Cheque attached with self-attested.
          </p>
        </div>
      </section>

      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col">
          <h2 className="text-center text-[22px] font-bold mb-3">18. DECLARATION</h2>
          <p className="text-[12px] mb-2">{DECLARATION.intro}</p>
          <ol className="space-y-1.5 text-[11.5px] leading-snug list-decimal pl-5">
            {DECLARATION.points.map((point: string) => (
              <li key={point}>{point}</li>
            ))}
          </ol>
          <Footer date={signedOn} name={name} label="Full Signature of the Applicant" />
        </div>
      </section>

      <section className="paper-form-page">
        <div className="paper-form-sheet flex flex-col">
          <h2 className="text-center text-[22px] font-bold">TERMS &amp; CONDITIONS</h2>
          <p className="text-center text-[12px] mb-3">({TERMS.note})</p>
          <ol className="space-y-1.5 text-[11px] leading-snug list-decimal pl-5">
            {TERMS.points.map((point: string) => (
              <li key={point}>{point}</li>
            ))}
          </ol>
          <Footer date={signedOn} name={name} label="Full Signature of the Applicant" />
        </div>
      </section>
    </div>
  );
}
