import {
  ApplicantStatus,
  EmployeeStatus,
  PrismaClient,
  SkillCategory,
  VerificationStatus,
} from "@prisma/client";
import { encryptText, getAadhaarLast4, hashAadhaar } from "../lib/crypto/index.ts";

function dummyImage(label: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="${bg}"/><text x="120" y="150" fill="white" text-anchor="middle" font-family="Arial" font-size="18">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function dummyPdf(title: string) {
  const content = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 360 240]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT /F1 14 Tf 24 140 Td (${title} dummy document) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(content).toString("base64")}`;
}

function buildFormAndDocs(person: {
  name: string;
  fatherOrHusband: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  mobile: string;
  religion: string;
  qualification: string;
  experience: string;
  exServiceNo: string;
  exRank: string;
  exDischargeDate: string;
  exDischargeBook: string;
  gunLicence: string;
  gunNo: string;
  uan: string;
  esiIp: string;
  pan: string;
  aadhaar: string;
  family: { name: string; relation: string; dateOfBirth: string; aadhaar: string }[];
}) {
  const photo = dummyImage("PHOTO", "#1e3a5f");
  const aadhaarFile = dummyPdf(`${person.name} Aadhaar`);
  const panFile = dummyPdf(`${person.name} PAN`);
  const passbookFile = dummyPdf(`${person.name} Passbook`);

  const formData = {
    name: person.name,
    fatherOrHusband: person.fatherOrHusband,
    dateOfBirth: person.dateOfBirth,
    age: person.age,
    gender: person.gender,
    localAddress: "12B, B.B. Ganguly Street, Bowbazar, Kolkata",
    villageAddress: "Vill + P.O. Bishnupur, Dist. South 24 Parganas",
    qualification: person.qualification,
    experience: person.experience,
    characterCertificate: "Issued by local councillor, Ward 45, valid till 2027",
    identificationMark: "Mole on the left forearm",
    nationality: "Indian",
    religion: person.religion,
    reference: "S. Banerjee, Site Supervisor, 9830011122",
    height: "172",
    weight: "68",
    chest: "36",
    nominee: `${person.fatherOrHusband} (Father / Husband)`,
    photo,
    photoName: `${person.name.replace(/\s+/g, "-").toLowerCase()}-photo.svg`,
    exServiceNo: person.exServiceNo,
    exRank: person.exRank,
    exDischargeDate: person.exDischargeDate,
    exDischargeBook: person.exDischargeBook,
    gunLicence: person.gunLicence,
    gunNo: person.gunNo,
    mobile: person.mobile,
    presentAddress: "12B, B.B. Ganguly Street, Bowbazar, Kolkata",
    presentPin: "700012",
    permanentAddress: "Vill + P.O. Bishnupur, Dist. South 24 Parganas",
    permanentPin: "743503",
    aadhaar: person.aadhaar,
    pan: person.pan,
    previousEmployer: "Eastern Security Services Pvt. Ltd.",
    uan: person.uan,
    esiIp: person.esiIp,
    preferredDispensary: "ESI Dispensary, Sealdah",
    family: person.family,
    bankName: "State Bank of India",
    accountNo: `30198${person.mobile.slice(-5)}`,
    ifsc: "SBIN0000145",
    branchName: "Dalhousie Square",
    policeStatus: "verified",
    securityMoney: "2500",
    declarationAccepted: true,
    termsAccepted: true,
    joiningTerms: true,
    termsVersion: "nk-joining-1",
    aadhaarFile,
    aadhaarFileName: `${person.name.replace(/\s+/g, "-").toLowerCase()}-aadhaar.pdf`,
    panFile,
    panFileName: `${person.name.replace(/\s+/g, "-").toLowerCase()}-pan.pdf`,
    passbookFile,
    passbookFileName: `${person.name.replace(/\s+/g, "-").toLowerCase()}-passbook.pdf`,
  };

  const documents = [
    { docType: "PHOTO", fileName: formData.photoName, fileData: photo, mimeType: "image/svg+xml", fileSize: photo.length },
    { docType: "AADHAAR", fileName: formData.aadhaarFileName, fileData: aadhaarFile, mimeType: "application/pdf", fileSize: aadhaarFile.length },
    { docType: "PAN", fileName: formData.panFileName, fileData: panFile, mimeType: "application/pdf", fileSize: panFile.length },
    { docType: "PASSBOOK", fileName: formData.passbookFileName, fileData: passbookFile, mimeType: "application/pdf", fileSize: passbookFile.length },
  ];

  return { formData, documents };
}

type DemoPerson = {
  status: ApplicantStatus;
  convertToEmployee?: boolean;
  roleCode: string;
  categoryCode: string;
  skill?: SkillCategory;
  basicRate?: number;
  name: string;
  fatherOrHusband: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  mobile: string;
  email: string;
  religion: string;
  qualification: string;
  experience: string;
  aadhaar: string;
  pan: string;
  exServiceNo: string;
  exRank: string;
  exDischargeDate: string;
  exDischargeBook: string;
  gunLicence: string;
  gunNo: string;
  uan: string;
  esiIp: string;
  family: { name: string; relation: string; dateOfBirth: string; aadhaar: string }[];
};

function demoMobile(slug: string, seq: number) {
  return String(9800000000 + (slug.charCodeAt(0) % 9) * 100000 + seq);
}

function peopleForCompany(slug: string): DemoPerson[] {
  const tag = slug.slice(0, 2).toUpperCase();
  return [
    {
      status: ApplicantStatus.NEW,
      roleCode: "SEC-GUARD",
      categoryCode: "CIVILIAN",
      name: "Rajesh Kumar Singh",
      fatherOrHusband: "Ram Prasad Singh",
      dateOfBirth: "1994-03-12",
      age: "32",
      gender: "MALE",
      mobile: demoMobile(slug, 1001),
      email: `rajesh.singh@${slug}.demo`,
      religion: "Hindu",
      qualification: "Higher Secondary (Arts)",
      experience: "6 years private security",
      aadhaar: `23451234${String(tag.charCodeAt(0)).padStart(4, "0")}`,
      pan: `${tag}RKS12${tag.slice(0, 1)}4F`,
      exServiceNo: "NA",
      exRank: "NA",
      exDischargeDate: "1994-03-12",
      exDischargeBook: "NA",
      gunLicence: "NA",
      gunNo: "NA",
      uan: "100234567890",
      esiIp: "4112345678",
      family: [
        { name: "Sita Devi Singh", relation: "Wife", dateOfBirth: "1996-08-21", aadhaar: "612345678901" },
        { name: "Aarav Singh", relation: "Son", dateOfBirth: "2018-01-09", aadhaar: "712345678902" },
      ],
    },
    {
      status: ApplicantStatus.SHORTLISTED,
      roleCode: "SEC-GUARD",
      categoryCode: "LADY",
      name: "Priya Das",
      fatherOrHusband: "Alok Das",
      dateOfBirth: "1997-11-04",
      age: "28",
      gender: "FEMALE",
      mobile: demoMobile(slug, 1002),
      email: `priya.das@${slug}.demo`,
      religion: "Hindu",
      qualification: "Graduate (B.A.)",
      experience: "3 years lady guard, mall duty",
      aadhaar: `34562345${String(tag.charCodeAt(1)).padStart(4, "0")}`,
      pan: `${tag}PDS98${tag.slice(0, 1)}2K`,
      exServiceNo: "NA",
      exRank: "NA",
      exDischargeDate: "1997-11-04",
      exDischargeBook: "NA",
      gunLicence: "NA",
      gunNo: "NA",
      uan: "NA",
      esiIp: "NA",
      family: [{ name: "Alok Das", relation: "Father", dateOfBirth: "1972-05-16", aadhaar: "812345678903" }],
    },
    {
      status: ApplicantStatus.APPROVED,
      convertToEmployee: true,
      roleCode: "SEC-GUARD",
      categoryCode: "BSF_EX",
      skill: SkillCategory.SKILLED,
      basicRate: 18500,
      name: "Amit Roy",
      fatherOrHusband: "Late Bimal Roy",
      dateOfBirth: "1986-07-19",
      age: "40",
      gender: "MALE",
      mobile: demoMobile(slug, 1003),
      email: `amit.roy@${slug}.demo`,
      religion: "Hindu",
      qualification: "Matric + Army education",
      experience: "15 years BSF, 2 years civil guard",
      aadhaar: `45673456${String(80 + slug.length).padStart(4, "0")}`,
      pan: `${tag}AMR45${tag.slice(0, 1)}7P`,
      exServiceNo: "BSF/14/88214",
      exRank: "Head Constable",
      exDischargeDate: "2024-03-31",
      exDischargeBook: "DB/BSF/2024/441",
      gunLicence: "WB/KOL/AL/2019/3341",
      gunNo: "INSAS-77821",
      uan: "101198765432",
      esiIp: "4198765432",
      family: [
        { name: "Rina Roy", relation: "Wife", dateOfBirth: "1989-02-11", aadhaar: "912345678904" },
        { name: "Neha Roy", relation: "Daughter", dateOfBirth: "2012-09-03", aadhaar: "112345678905" },
      ],
    },
    {
      status: ApplicantStatus.REJECTED,
      roleCode: "SWEEPER",
      categoryCode: "GEN_SWEEPER",
      name: "Manoj Halder",
      fatherOrHusband: "Gopal Halder",
      dateOfBirth: "1991-01-28",
      age: "35",
      gender: "MALE",
      mobile: demoMobile(slug, 1004),
      email: `manoj.halder@${slug}.demo`,
      religion: "Hindu",
      qualification: "Class VIII",
      experience: "4 years housekeeping",
      aadhaar: `56784567${String(90 + slug.length).padStart(4, "0")}`,
      pan: `${tag}MNH33${tag.slice(0, 1)}1L`,
      exServiceNo: "NA",
      exRank: "NA",
      exDischargeDate: "1991-01-28",
      exDischargeBook: "NA",
      gunLicence: "NA",
      gunNo: "NA",
      uan: "NA",
      esiIp: "NA",
      family: [{ name: "Gopal Halder", relation: "Father", dateOfBirth: "1965-12-02", aadhaar: "212345678906" }],
    },
    {
      status: ApplicantStatus.APPROVED,
      convertToEmployee: true,
      roleCode: "HOUSEKEEPER",
      categoryCode: "GEN_HOUSEKEEPER",
      skill: SkillCategory.UNSKILLED,
      basicRate: 14200,
      name: "Sunita Mondal",
      fatherOrHusband: "Bikash Mondal",
      dateOfBirth: "1995-06-08",
      age: "31",
      gender: "FEMALE",
      mobile: demoMobile(slug, 1005),
      email: `sunita.mondal@${slug}.demo`,
      religion: "Hindu",
      qualification: "Madhyamik",
      experience: "5 years office housekeeping",
      aadhaar: `67895678${String(70 + slug.length).padStart(4, "0")}`,
      pan: `${tag}SNM21${tag.slice(0, 1)}8Q`,
      exServiceNo: "NA",
      exRank: "NA",
      exDischargeDate: "1995-06-08",
      exDischargeBook: "NA",
      gunLicence: "NA",
      gunNo: "NA",
      uan: "100556677889",
      esiIp: "4155667788",
      family: [{ name: "Bikash Mondal", relation: "Husband", dateOfBirth: "1992-04-17", aadhaar: "312345678907" }],
    },
  ];
}

export async function clearPeopleData(prisma: PrismaClient) {
  await prisma.attendance.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.applicantRemark.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.applicantOtp.deleteMany();
  await prisma.candidateAccount.deleteMany();
}

export async function seedDemoPeople(prisma: PrismaClient, companyId: string, companySlug: string, prefix: string) {
  const site = await prisma.site.findFirst({
    where: { companyId, code: "HEAD-OFFICE" },
  });
  const roles = await prisma.jobRole.findMany({
    where: { companyId },
    include: { categories: true },
  });

  const people = peopleForCompany(companySlug);
  let employeeNumber = 1;

  for (const person of people) {
    const jobRole = roles.find((role) => role.code === person.roleCode);
    const roleCategory = jobRole?.categories.find((cat) => cat.code === person.categoryCode);
    if (!jobRole || !roleCategory) {
      throw new Error(`Missing role ${person.roleCode}/${person.categoryCode} for ${companySlug}`);
    }

    const { formData, documents } = buildFormAndDocs(person);
    const applicant = await prisma.applicant.create({
      data: {
        companyId,
        jobRoleId: jobRole.id,
        roleCategoryId: roleCategory.id,
        fullName: person.name,
        mobile: person.mobile,
        email: person.email,
        fatherOrHusband: person.fatherOrHusband,
        dateOfBirth: new Date(person.dateOfBirth),
        gender: person.gender,
        presentAddress: `${formData.presentAddress} (PIN: ${formData.presentPin})`,
        permanentAddress: `${formData.permanentAddress} (PIN: ${formData.permanentPin})`,
        aadhaarLast4: getAadhaarLast4(person.aadhaar),
        aadhaarHash: hashAadhaar(person.aadhaar),
        aadhaarEncrypted: encryptText(person.aadhaar),
        pan: person.pan,
        armsLicenseNo: person.gunLicence,
        exServiceNo: person.exServiceNo,
        pvcStatus: VerificationStatus.VERIFIED,
        formData,
        documents,
        status: person.status,
      },
    });

    if (!person.convertToEmployee) continue;

    const employeeCode = `${prefix}-${String(employeeNumber).padStart(4, "0")}`;
    employeeNumber += 1;

    const employee = await prisma.employee.create({
      data: {
        companyId,
        employeeCode,
        applicantId: applicant.id,
        jobRoleId: jobRole.id,
        roleCategoryId: roleCategory.id,
        siteId: site?.id || null,
        fullName: person.name,
        mobile: person.mobile,
        email: person.email,
        fatherOrHusband: person.fatherOrHusband,
        dateOfBirth: new Date(person.dateOfBirth),
        gender: person.gender,
        presentAddress: applicant.presentAddress,
        permanentAddress: applicant.permanentAddress,
        skill: person.skill || SkillCategory.UNSKILLED,
        basicRate: person.basicRate || 14000,
        divisorDays: 26,
        bankAccountNo: formData.accountNo,
        bankIfsc: formData.ifsc,
        bankBranch: formData.branchName,
        uan: person.uan === "NA" ? null : person.uan,
        esicNo: person.esiIp === "NA" ? null : person.esiIp,
        aadhaarLast4: applicant.aadhaarLast4,
        aadhaarHash: applicant.aadhaarHash,
        aadhaarEncrypted: applicant.aadhaarEncrypted,
        pan: person.pan,
        status: EmployeeStatus.ACTIVE,
        joiningDate: new Date("2026-04-01"),
      },
    });

    for (const doc of documents) {
      await prisma.employeeDocument.create({
        data: {
          employeeId: employee.id,
          docType: doc.docType,
          fileKey: doc.fileData,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
        },
      });
    }
  }

  await prisma.companySequence.update({
    where: { companyId },
    data: { nextNumber: employeeNumber },
  });

  await seedDemoAttendance(prisma, companyId);
}

export async function seedDemoAttendance(prisma: PrismaClient, companyId: string, monthKey = "2026-10") {
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, siteId: { not: null } },
    select: { id: true, siteId: true },
  });
  const throughDay = 25;
  for (const employee of employees) {
    for (let day = 1; day <= throughDay; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      await prisma.attendance.upsert({
        where: {
          companyId_employeeId_nominalDate: {
            companyId,
            employeeId: employee.id,
            nominalDate: new Date(`${date}T00:00:00.000Z`),
          },
        },
        update: {
          status: weekday === 0 ? "WEEK_OFF" : "PRESENT",
        },
        create: {
          companyId,
          employeeId: employee.id,
          siteId: employee.siteId as string,
          nominalDate: new Date(`${date}T00:00:00.000Z`),
          status: weekday === 0 ? "WEEK_OFF" : "PRESENT",
          markedBy: "demo-seed",
        },
      });
    }
  }
}
