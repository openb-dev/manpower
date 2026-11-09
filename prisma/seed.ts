import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoPeople } from "./demo-people.ts";

const prisma = new PrismaClient();

const COMPANIES = [
  { slug: "nk", legalName: "M/s N.K.Enterprise", shortName: "N.K. Enterprise", prefix: "NK", gstin: "19AKEPD5739K1ZV", state: "West Bengal", stateCode: "19", sac: "998519" },
  { slug: "origin", legalName: "Origin Services Ltd.", shortName: "Origin", prefix: "ORG", gstin: "19AABCO5678G1Z1", state: "West Bengal", stateCode: "19", sac: "9985" },
  { slug: "oss", legalName: "OSS Manpower Solutions", shortName: "OSS", prefix: "OSS", gstin: "19AABCO9999K1Z2", state: "West Bengal", stateCode: "19", sac: "9985" },
  { slug: "trimurti", legalName: "Trimurti Security Agency", shortName: "Trimurti", prefix: "TRM", gstin: "19AABCT4321P1Z9", state: "West Bengal", stateCode: "19", sac: "9985" },
];

const STANDARD_GUARD_FIELDS = [
  { id: "height", label: "Height", type: "text", required: true, section: "physical" },
  { id: "weight", label: "Weight (kg)", type: "number", required: true, section: "physical" },
  { id: "identificationMark", label: "Identification Mark", type: "text", required: false, section: "physical" },
  { id: "otherQualification", label: "Other qualification", type: "text", required: false, section: "personal" },
  { id: "religion", label: "Religion", type: "select", options: ["Hindu", "Muslim", "Christian", "Sikh", "Other"], required: true, section: "personal" },
  { id: "qualification", label: "Highest Qualification", type: "text", required: true, section: "personal" },
  { id: "experienceYears", label: "Experience (Years)", type: "number", required: false, section: "personal" },
  { id: "bankAccountNo", label: "Bank Account No.", type: "text", required: true, section: "bank" },
  { id: "bankIfsc", label: "IFSC Code", type: "text", required: true, section: "bank" },
  { id: "bankBranch", label: "Branch Name", type: "text", required: true, section: "bank" },
];

const EX_SERVICE_EXTRA_FIELDS = [
  { id: "exServiceNo", label: "Service Number", type: "text", required: true, section: "ex_service" },
  { id: "corpsOrRegiment", label: "Corps / Regiment (e.g. BSF, Army)", type: "text", required: true, section: "ex_service" },
  { id: "rank", label: "Rank at Discharge", type: "text", required: true, section: "ex_service" },
  { id: "dischargeDate", label: "Date of Discharge", type: "date", required: true, section: "ex_service" },
  { id: "dischargeBookNo", label: "Discharge Book No.", type: "text", required: true, section: "ex_service" },
  { id: "armsLicenseNo", label: "Gun / Arms License No. (If applicable)", type: "text", required: false, section: "ex_service" },
  { id: "armsExpiryDate", label: "Arms License Expiry Date", type: "date", required: false, section: "ex_service" },
];

const CLEANING_FIELDS = [
  { id: "religion", label: "Religion", type: "select", options: ["Hindu", "Muslim", "Christian", "Other"], required: true, section: "personal" },
  { id: "experienceYears", label: "Experience in Cleaning / Housekeeping (Years)", type: "number", required: false, section: "personal" },
  { id: "bankAccountNo", label: "Bank Account No.", type: "text", required: true, section: "bank" },
  { id: "bankIfsc", label: "IFSC Code", type: "text", required: true, section: "bank" },
  { id: "bankBranch", label: "Branch Name", type: "text", required: true, section: "bank" },
];

async function main() {
  console.log("Seeding Database for Multi-Tenant Manpower System...");

  // 1. Super Admin
  const superAdminPassword = await bcrypt.hash("Admin@12345", 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@manpower.com" },
    update: {},
    create: {
      email: "admin@manpower.com",
      name: "Global Super Admin",
      passwordHash: superAdminPassword,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`[OK] Super admin ready: ${superAdmin.email}`);

  // 2. Companies & Sequences
  for (const comp of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { slug: comp.slug },
      update: {
        legalName: comp.legalName,
        shortName: comp.shortName,
        gstin: comp.gstin,
        stateName: comp.state,
        stateCode: comp.stateCode,
        sac: comp.sac,
      },
      create: {
        slug: comp.slug,
        legalName: comp.legalName,
        shortName: comp.shortName,
        gstin: comp.gstin,
        stateName: comp.state,
        stateCode: comp.stateCode,
        sac: comp.sac,
      },
    });

    // Sequence for employee codes
    await prisma.companySequence.upsert({
      where: { companyId: company.id },
      update: { prefix: comp.prefix },
      create: {
        companyId: company.id,
        prefix: comp.prefix,
        nextNumber: 1,
      },
    });

    // Company Admin
    const adminEmail = `admin@${comp.slug}.com`;
    const adminPassword = await bcrypt.hash("Admin@12345", 10);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { companyId: company.id },
      create: {
        email: adminEmail,
        name: `${comp.shortName} Admin`,
        passwordHash: adminPassword,
        role: Role.COMPANY_ADMIN,
        companyId: company.id,
      },
    });

    // Default Site
    await prisma.site.upsert({
      where: { companyId_code: { companyId: company.id, code: "HEAD-OFFICE" } },
      update: {},
      create: {
        companyId: company.id,
        name: "Headquarters & Office",
        code: "HEAD-OFFICE",
        location: comp.state,
      },
    });

    // Job Roles & Categories (DB-driven)
    const rolesConfig = [
      {
        name: "Security Guard",
        code: "SEC-GUARD",
        active: true,
        categories: [
          { name: "Civilian", code: "CIVILIAN", fields: STANDARD_GUARD_FIELDS },
          { name: "Ex-serviceman", code: "BSF_EX", fields: [...STANDARD_GUARD_FIELDS, ...EX_SERVICE_EXTRA_FIELDS] },
          { name: "Lady Guard", code: "LADY", fields: STANDARD_GUARD_FIELDS },
          { name: "Gunman", code: "GUNMAN", fields: STANDARD_GUARD_FIELDS },
          { name: "Others", code: "OTHERS", fields: STANDARD_GUARD_FIELDS },
        ],
      },
      {
        name: "Manpower",
        code: "MANPOWER",
        active: true,
        categories: [{ name: "Others", code: "OTHERS", fields: CLEANING_FIELDS }],
      },
      {
        name: "Sweeper",
        code: "SWEEPER",
        active: false,
        categories: [{ name: "General Sweeper", code: "GEN_SWEEPER", fields: CLEANING_FIELDS }],
      },
      {
        name: "Housekeeper",
        code: "HOUSEKEEPER",
        active: false,
        categories: [{ name: "General Housekeeper", code: "GEN_HOUSEKEEPER", fields: CLEANING_FIELDS }],
      },
    ];

    for (const r of rolesConfig) {
      const jobRole = await prisma.jobRole.upsert({
        where: { companyId_code: { companyId: company.id, code: r.code } },
        update: { name: r.name, active: r.active !== false },
        create: {
          companyId: company.id,
          name: r.name,
          code: r.code,
          active: r.active !== false,
        },
      });

      for (const cat of r.categories) {
        const roleCat = await prisma.roleCategory.upsert({
          where: { jobRoleId_code: { jobRoleId: jobRole.id, code: cat.code } },
          update: { name: cat.name },
          create: {
            companyId: company.id,
            jobRoleId: jobRole.id,
            name: cat.name,
            code: cat.code,
          },
        });

        // Versioned Form Definition
        await prisma.formDefinition.upsert({
          where: { roleCategoryId_version: { roleCategoryId: roleCat.id, version: 1 } },
          update: { schema: cat.fields },
          create: {
            companyId: company.id,
            roleCategoryId: roleCat.id,
            version: 1,
            schema: cat.fields,
          },
        });
      }
    }

    // Default Contracts for CRM & Government Work Register
    const existingContract = await prisma.contract.findFirst({ where: { companyId: company.id } });
    const contract = existingContract ? await prisma.contract.update({
      where: { id: existingContract.id },
      data: {
        clientName: "West Bengal State Electricity (WBSEDCL)",
        departmentName: "Security & Substation Division",
        contractType: "A",
        workName: "Round-the-clock Security Guard & Supervisor Deployment",
        agreementNo: `${comp.prefix}/AGR/2026/089`,
        tenderNo: "NIT/WBSEDCL/SEC/2025/112",
        tenderOpening: new Date("2025-11-15"),
        estimateCost: 2600000,
        tenderAmount: 2450000,
        emdAmount: 52000,
        emdPercent: 2,
        emdMode: "FDR",
        emdInstrumentNo: "FDR/SBI/782190",
        emdDate: new Date("2025-11-10"),
        emdBankName: "State Bank of India, Dalhousie Branch",
        emdStatus: "ADJUSTED_TO_PG",
        pgAmount: 122500,
        pgPercent: 5,
        pgMode: "BANK_GUARANTEE",
        pgInstrumentNo: "BG/PNB/2026/4412",
        pgBankName: "Punjab National Bank, Burrabazar",
        pgDate: new Date("2026-03-20"),
        pgExpiryDate: new Date("2027-04-15"),
        pgClaimDate: new Date("2027-07-15"),
        pgStatus: "ACTIVE",
        measurementBookNo: "MB-2026/104, Pg 12-28",
        lccNo: "LCC/WB/KOL/0942",
        startAgreement: new Date("2026-04-01"),
        startActual: new Date("2026-04-01"),
        completionAgreement: new Date("2027-03-31"),
        workStatus: "IN_PROGRESS",
        billNumber: "RA-04/AUG-2026",
        billDate: new Date("2026-08-31"),
        grossAmount: 215000,
        securityDeposit: 10750,
        incomeTaxTds: 4300,
        gstRecovery: 4300,
        labourCess: 2150,
        waterCharge: 0,
        esiPfDeduction: 3500,
        withheldAmount: 800,
        otherRecovery: 0,
        totalDeductions: 25800,
        netAmount: 189200,
        voucherNumber: "VCH-2026-0914",
        bankReceivedDate: new Date("2026-09-08"),
        remarks: "Bill passed & credited to SBI A/c 3019842145. Active manpower deployment.",
      },
    }) : await prisma.contract.create({
      data: {
        companyId: company.id,
        clientName: "West Bengal State Electricity (WBSEDCL)",
        departmentName: "Security & Substation Division",
        contractType: "A",
        workName: "Round-the-clock Security Guard & Supervisor Deployment",
        agreementNo: `${comp.prefix}/AGR/2026/089`,
        tenderNo: "NIT/WBSEDCL/SEC/2025/112",
        tenderOpening: new Date("2025-11-15"),
        estimateCost: 2600000,
        tenderAmount: 2450000,
        emdAmount: 52000,
        emdPercent: 2,
        emdMode: "FDR",
        emdInstrumentNo: "FDR/SBI/782190",
        emdDate: new Date("2025-11-10"),
        emdBankName: "State Bank of India, Dalhousie Branch",
        emdStatus: "ADJUSTED_TO_PG",
        pgAmount: 122500,
        pgPercent: 5,
        pgMode: "BANK_GUARANTEE",
        pgInstrumentNo: "BG/PNB/2026/4412",
        pgBankName: "Punjab National Bank, Burrabazar",
        pgDate: new Date("2026-03-20"),
        pgExpiryDate: new Date("2027-04-15"),
        pgClaimDate: new Date("2027-07-15"),
        pgStatus: "ACTIVE",
        measurementBookNo: "MB-2026/104, Pg 12-28",
        lccNo: "LCC/WB/KOL/0942",
        startAgreement: new Date("2026-04-01"),
        startActual: new Date("2026-04-01"),
        completionAgreement: new Date("2027-03-31"),
        workStatus: "IN_PROGRESS",
        billNumber: "RA-04/AUG-2026",
        billDate: new Date("2026-08-31"),
        grossAmount: 215000,
        securityDeposit: 10750,
        incomeTaxTds: 4300,
        gstRecovery: 4300,
        labourCess: 2150,
        waterCharge: 0,
        esiPfDeduction: 3500,
        withheldAmount: 800,
        otherRecovery: 0,
        totalDeductions: 25800,
        netAmount: 189200,
        voucherNumber: "VCH-2026-0914",
        bankReceivedDate: new Date("2026-09-08"),
        remarks: "Bill passed & credited to SBI A/c 3019842145. Active manpower deployment.",
      },
    });

    // Also seed a pre-contract tender in EMD stage
    const tenderContract = await prisma.contract.findFirst({
      where: { companyId: company.id, tenderNo: "CPWD/KCED-II/NIT-34/2026-27" },
    });
    if (!tenderContract) {
      await prisma.contract.create({
        data: {
          companyId: company.id,
          clientName: "Central Public Works Department (CPWD)",
          departmentName: "Kolkata Central Electrical Division - II",
          contractType: "B",
          workName: "Comprehensive Electrical Maintenance & Guarding Services at Nizam Palace",
          agreementNo: "PENDING_AWARD",
          tenderNo: "CPWD/KCED-II/NIT-34/2026-27",
          tenderOpening: new Date("2026-10-25"),
          estimateCost: 3850000,
          tenderAmount: 3620000,
          emdAmount: 77000,
          emdPercent: 2,
          emdMode: "DEMAND_DRAFT",
          emdInstrumentNo: "DD/HDFC/992144",
          emdDate: new Date("2026-10-05"),
          emdBankName: "HDFC Bank, Park Street Branch",
          emdStatus: "SUBMITTED",
          workStatus: "TENDER_EMD",
          remarks: "Pre-contract tender submitted. Financial bid opening on 25th Oct.",
        },
      });
    }

    // Also seed an awarded contract in PG stage (before work start)
    const pgContract = await prisma.contract.findFirst({
      where: { companyId: company.id, agreementNo: "NSG/KOL/ENGG/2026/04" },
    });
    if (!pgContract) {
      await prisma.contract.create({
        data: {
          companyId: company.id,
          clientName: "National Security Guard (NSG) Hub",
          departmentName: "Badu Camp, Rajarhat Engineering Wing",
          contractType: "B",
          workName: "Perimeter Security Lighting, Civil Repair & Facility Manpower",
          agreementNo: "NSG/KOL/ENGG/2026/04",
          tenderNo: "NSG/HQ/W-18/2026",
          tenderOpening: new Date("2026-07-02"),
          estimateCost: 1500000,
          tenderAmount: 1420000,
          emdAmount: 30000,
          emdPercent: 2,
          emdMode: "ONLINE",
          emdInstrumentNo: "TXN-SBI-98314112",
          emdDate: new Date("2026-07-10"),
          emdStatus: "REFUNDED",
          emdRefundDate: new Date("2026-08-15"),
          emdRefundRef: "REF-NSG-2026-99",
          pgAmount: 71000,
          pgPercent: 5,
          pgMode: "BANK_GUARANTEE",
          pgInstrumentNo: "BG/SBI/NSG/8812",
          pgBankName: "State Bank of India, Salt Lake Sec V",
          pgDate: new Date("2026-08-20"),
          pgExpiryDate: new Date("2027-02-28"),
          pgClaimDate: new Date("2027-05-31"),
          pgStatus: "ACTIVE",
          workStatus: "AWARDED_PG",
          remarks: "LOA received; PG submitted and accepted. Pre-work site inspection in progress.",
        },
      });
    }

    // Default Bill for Accounts
    const existingInvoice = await prisma.invoice.findFirst({ where: { companyId: company.id } });
    if (!existingInvoice) {
      await prisma.invoice.create({
        data: {
          companyId: company.id,
          contractId: contract.id,
          billNo: `${comp.prefix}-INV-2026-08`,
          periodFrom: new Date("2026-08-01"),
          periodTo: new Date("2026-08-31"),
          grossAmount: 185000,
          cgst: 16650,
          sgst: 16650,
          roundOff: 0,
          sayTotal: 218300,
          totalAmount: 218300,
          status: "APPROVED",
          meta: {
            inclusiveTotal: 218300,
            grandTotal: 218300,
            amountInWords: "Rupees two lakh eighteen thousand three hundred only",
          },
          lines: {
            create: [
              { trade: "Security Guard", skill: "Skilled", manDays: 156, ratePerDay: 650, amount: 101400 },
              { trade: "Supervisor", skill: "Skilled", manDays: 52, ratePerDay: 850, amount: 44200 },
              { trade: "Gunman", skill: "Skilled", manDays: 31, ratePerDay: 950, amount: 29450 },
            ],
          },
        },
      });
    }

    // Default Purchase for Procurement
    const existingPurchase = await prisma.purchase.findFirst({ where: { companyId: company.id } });
    if (!existingPurchase) {
      await prisma.purchase.create({
        data: {
          companyId: company.id,
          contractId: contract.id,
          itemName: "Security Uniform Sets & Badges (50 pcs)",
          vendorName: "Bengal Uniform & Safety Supplies",
          amount: 47500,
          invoiceNo: "BUSS/26/1042",
          purchaseDate: new Date("2026-09-15"),
        },
      });
    }

    // Default Ledger for Finance
    const existingLedger = await prisma.ledgerEntry.findFirst({ where: { companyId: company.id } });
    if (!existingLedger) {
      await prisma.ledgerEntry.createMany({
        data: [
          { companyId: company.id, narration: "Client Payment received against Bill #08", creditAmount: 218300, debitAmount: 0, category: "CLIENT_RECEIPT" },
          { companyId: company.id, narration: "August 2026 Guard Wage Disbursement", creditAmount: 0, debitAmount: 142500, category: "SALARY" },
          { companyId: company.id, narration: "Uniform & Equipment Procurement", creditAmount: 0, debitAmount: 47500, category: "OFFICE" },
        ],
      });
    }

    const existingPeople = await prisma.applicant.count({ where: { companyId: company.id } });
    if (existingPeople === 0) {
      await seedDemoPeople(prisma, company.id, company.slug, comp.prefix);
      console.log(`[OK] Company configured: ${comp.shortName} (${comp.slug}) with complete demo people.`);
    } else {
      console.log(`[OK] Company configured: ${comp.shortName} (${comp.slug}) with roles, contracts, bills & ledger.`);
    }
  }

  console.log("\nSeeding successfully completed!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
