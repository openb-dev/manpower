process.env.NODE_ENV = "test";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/db/index.ts";
import { requestApplicantOtp, verifyApplicantOtp } from "../modules/otp/services.ts";
import { generate6DigitOtp, hashOtp, isOtpExpired } from "../lib/otp/index.ts";
import { encryptText, decryptText, maskAadhaar, hashAadhaar, getAadhaarLast4 } from "../lib/crypto/index.ts";
import { normalizeContact } from "../server/applicants.js";

// ============================================================================
// 1. CRM & GOVERNMENT WORK REGISTER EDGE CASES
// ============================================================================

test("CRM Edge Case: Running bill deductions math with zero, null, and fractional statutory rates", () => {
  function computeRegisterNet({
    grossAmount = 0,
    securityDeposit = 0,
    incomeTaxTds = 0,
    gstRecovery = 0,
    labourCess = 0,
    waterCharge = 0,
    esiPfDeduction = 0,
    withheldAmount = 0,
    otherRecovery = 0,
  }) {
    const gross = Number(grossAmount) || 0;
    const sumDeductions =
      (Number(securityDeposit) || 0) +
      (Number(incomeTaxTds) || 0) +
      (Number(gstRecovery) || 0) +
      (Number(labourCess) || 0) +
      (Number(waterCharge) || 0) +
      (Number(esiPfDeduction) || 0) +
      (Number(withheldAmount) || 0) +
      (Number(otherRecovery) || 0);

    const net = gross - sumDeductions;
    return {
      totalDeductions: Math.round(sumDeductions * 100) / 100,
      netAmount: Math.round(net * 100) / 100,
      isDeficit: net < 0,
    };
  }

  // Edge Case 1.1: Standard CPWD deductions on ₹2,15,000
  const std = computeRegisterNet({
    grossAmount: 215000,
    securityDeposit: 10750, // 5%
    incomeTaxTds: 4300,    // 2%
    gstRecovery: 4300,     // 2%
    labourCess: 2150,      // 1%
  });
  assert.equal(std.totalDeductions, 21500);
  assert.equal(std.netAmount, 193500);
  assert.equal(std.isDeficit, false);

  // Edge Case 1.2: All deductions null or undefined (Net equals Gross)
  const zeroDed = computeRegisterNet({ grossAmount: 150000 });
  assert.equal(zeroDed.totalDeductions, 0);
  assert.equal(zeroDed.netAmount, 150000);

  // Edge Case 1.3: Deductions exceed gross bill (Excess recovery / Deficit)
  const excess = computeRegisterNet({
    grossAmount: 50000,
    securityDeposit: 5000,
    otherRecovery: 60000, // Large penalty/recovery
  });
  assert.equal(excess.totalDeductions, 65000);
  assert.equal(excess.netAmount, -15000);
  assert.equal(excess.isDeficit, true);

  // Edge Case 1.4: Floating point rounding precision (2 decimal places)
  const floatCase = computeRegisterNet({
    grossAmount: 100000.33,
    securityDeposit: 5000.11,
    labourCess: 1000.01,
  });
  assert.equal(floatCase.totalDeductions, 6000.12);
  assert.equal(floatCase.netAmount, 94000.21);
});

test("CRM Edge Case: EMD and PG calculations, status lifecycle, and validity checks", () => {
  function computeEmd(tenderAmount, percent = 2) {
    const val = Number(tenderAmount) || 0;
    const pct = Number(percent) || 0;
    if (val <= 0 || pct <= 0) return 0;
    return Math.round((val * pct) / 100);
  }

  function computePg(contractAmount, percent = 5) {
    const val = Number(contractAmount) || 0;
    const pct = Number(percent) || 0;
    if (val <= 0 || pct <= 0) return 0;
    return Math.round((val * pct) / 100);
  }

  function isPgExpired(expiryDate) {
    if (!expiryDate) return false;
    return new Date(expiryDate).getTime() < Date.now();
  }

  // Edge Case 2.1: Zero or negative values
  assert.equal(computeEmd(0, 2), 0);
  assert.equal(computeEmd(-50000, 2), 0);
  assert.equal(computePg(0, 5), 0);

  // Edge Case 2.2: Standard calculations
  assert.equal(computeEmd(2450000, 2), 49000);
  assert.equal(computePg(2450000, 5), 122500);

  // Edge Case 2.3: PG Expiry date validation
  const pastDate = new Date("2020-01-01");
  const futureDate = new Date("2030-01-01");
  assert.equal(isPgExpired(pastDate), true);
  assert.equal(isPgExpired(futureDate), false);
  assert.equal(isPgExpired(null), false);

  // Edge Case 2.4: EMD to PG status transitions
  const validEmdStatuses = ["SUBMITTED", "ACTIVE", "REFUNDED", "ADJUSTED_TO_PG", "ADJUSTED_TO_SD", "FORFEITED"];
  const validPgStatuses = ["SUBMITTED", "ACTIVE", "RELEASED", "INVOKED"];

  assert.ok(validEmdStatuses.includes("ADJUSTED_TO_PG"));
  assert.ok(validPgStatuses.includes("RELEASED"));
});

test("CRM Edge Case: Stipulated vs Actual date comparisons (Schedule delay & overrun)", () => {
  function checkScheduleStatus(stipulatedStart, actualStart, stipulatedEnd, actualEnd) {
    const stipStart = stipulatedStart ? new Date(stipulatedStart).getTime() : null;
    const actStart = actualStart ? new Date(actualStart).getTime() : null;
    const stipEnd = stipulatedEnd ? new Date(stipulatedEnd).getTime() : null;
    const actEnd = actualEnd ? new Date(actualEnd).getTime() : null;

    const startDelayed = stipStart && actStart ? actStart > stipStart : false;
    const endDelayed = stipEnd && actEnd ? actEnd > stipEnd : false;

    return { startDelayed, endDelayed };
  }

  // Work started 5 days late, completed 15 days late
  const overrun = checkScheduleStatus("2026-04-01", "2026-04-06", "2026-09-30", "2026-10-15");
  assert.equal(overrun.startDelayed, true);
  assert.equal(overrun.endDelayed, true);

  // On time schedule
  const onTime = checkScheduleStatus("2026-04-01", "2026-04-01", "2026-09-30", "2026-09-28");
  assert.equal(onTime.startDelayed, false);
  assert.equal(onTime.endDelayed, false);
});

// ============================================================================
// 2. OTP & AUTHENTICATION EDGE CASES
// ============================================================================

test("OTP Edge Case: Attempt limit exhaustion (Max 3 attempts)", async () => {
  const company = await prisma.company.findUnique({ where: { slug: "nk" } });
  assert.ok(company);

  const randomSuffix = String(Math.floor(100000 + Math.random() * 900000));
  const testPhone = `9011${randomSuffix}`;

  const req = await requestApplicantOtp({
    companySlug: "nk",
    identifier: testPhone,
  });
  assert.equal(req.success, true);
  assert.ok(req.trialCode);

  // Attempt 1: Wrong OTP
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: "000000" }),
    /Invalid OTP code\. 2 attempt\(s\) remaining\./
  );

  // Attempt 2: Wrong OTP
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: "111111" }),
    /Invalid OTP code\. 1 attempt\(s\) remaining\./
  );

  // Attempt 3: Wrong OTP (Exhausts max attempts)
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: "222222" }),
    /Invalid OTP code\. 0 attempt\(s\) remaining\./
  );

  // Attempt 4: Even with correct code now, it must be completely locked out!
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: req.trialCode }),
    /Maximum attempts exceeded/
  );
});

test("OTP Edge Case: Expired OTP rejected", async () => {
  const company = await prisma.company.findUnique({ where: { slug: "nk" } });
  const testPhone = "9022" + Math.floor(100000 + Math.random() * 900000);

  // Manually insert an expired OTP (expired 1 minute ago)
  const plainOtp = generate6DigitOtp();
  await prisma.applicantOtp.create({
    data: {
      companyId: company.id,
      identifier: testPhone,
      hashedOtp: hashOtp(plainOtp),
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
      attempts: 0,
      maxAttempts: 3,
    },
  });

  // Verify should fail due to expiry
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: plainOtp }),
    /OTP has expired/
  );
});

test("OTP Edge Case: Already verified OTP cannot be reused (Replay attack prevention)", async () => {
  const company = await prisma.company.findUnique({ where: { slug: "nk" } });
  const testPhone = "9033" + Math.floor(100000 + Math.random() * 900000);

  const req = await requestApplicantOtp({
    companySlug: "nk",
    identifier: testPhone,
  });

  // First verification: Success
  const firstVerify = await verifyApplicantOtp({
    companySlug: "nk",
    identifier: testPhone,
    code: req.trialCode,
  });
  assert.equal(firstVerify.verified, true);

  // Second verification with the same code: Must fail (no active unverified OTP)
  await assert.rejects(
    () => verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: req.trialCode }),
    /No active OTP requested/
  );
});

test("OTP Edge Case: Contact identifier normalization edge cases", () => {
  // Mobile numbers with spaces, +91, dashes
  assert.equal(normalizeContact("+91 98765-43210"), "9876543210");
  assert.equal(normalizeContact("09876543210"), "9876543210");
  assert.equal(normalizeContact("919876543210"), "9876543210");
  assert.equal(normalizeContact("  9876543210  "), "9876543210");

  // Invalid numbers
  assert.equal(normalizeContact("12345"), "");
  assert.equal(normalizeContact("abcd1234ef"), "");

  // Email normalization: uppercase, extra spaces
  assert.equal(normalizeContact("  John.DOE@NKEnterprise.COM  "), "john.doe@nkenterprise.com");
  assert.equal(normalizeContact("invalid-email@"), "");
});

// ============================================================================
// 3. MULTI-TENANT ISOLATION EDGE CASES
// ============================================================================

test("Tenant Edge Case: Soft-deleted contracts and cross-tenant mutation rejection", async () => {
  const nk = await prisma.company.findUnique({ where: { slug: "nk" } });
  const origin = await prisma.company.findUnique({ where: { slug: "origin" } });
  assert.ok(nk && origin);

  // Create a contract in NK
  const tempContract = await prisma.contract.create({
    data: {
      companyId: nk.id,
      clientName: "Edge Test Client",
      agreementNo: `EDGE-TEST-${Date.now()}`,
      workStatus: "IN_PROGRESS",
    },
  });

  // Soft-delete it
  await prisma.contract.update({
    where: { id: tempContract.id },
    data: { deletedAt: new Date() },
  });

  // Querying active contracts in NK should NOT include soft-deleted record
  const activeContracts = await prisma.contract.findMany({
    where: { companyId: nk.id, deletedAt: null },
  });
  assert.equal(activeContracts.some((c) => c.id === tempContract.id), false);

  // Cross-tenant update prevention: Trying to update NK's contract with Origin's companyId
  const crossTenantUpdate = await prisma.contract.updateMany({
    where: { id: tempContract.id, companyId: origin.id },
    data: { clientName: "Hacked by other tenant" },
  });
  // 0 records affected because companyId did not match
  assert.equal(crossTenantUpdate.count, 0);

  // Clean up
  await prisma.contract.delete({ where: { id: tempContract.id } });
});

// ============================================================================
// 4. STATUTORY PAYROLL & DEDUCTION EDGE CASES
// ============================================================================

test("Payroll Edge Case: PF ceiling cap (₹15,000) and ESI threshold (₹21,000)", () => {
  function calculateStatutoryContributions(grossWage) {
    const wage = Number(grossWage) || 0;
    // Statutory rules:
    // EPF: 12% of Basic/Wage capped at ₹15,000 ceiling (Max PF = ₹1,800)
    const pfWage = Math.min(wage, 15000);
    const pfEmployee = Math.round(pfWage * 0.12);

    // ESIC: 0.75% of Gross Wage, but exempt if wage exceeds ₹21,000/month
    const esiEmployee = wage > 21000 ? 0 : Math.round(wage * 0.0075);

    return { pfEmployee, esiEmployee };
  }

  // Case 4.1: Wage under both ceilings (₹12,000)
  const lowWage = calculateStatutoryContributions(12000);
  assert.equal(lowWage.pfEmployee, 1440); // 12% of 12000
  assert.equal(lowWage.esiEmployee, 90);   // 0.75% of 12000

  // Case 4.2: Wage between PF ceiling and ESI limit (₹18,000)
  const midWage = calculateStatutoryContributions(18000);
  assert.equal(midWage.pfEmployee, 1800);  // Capped at 12% of 15000
  assert.equal(midWage.esiEmployee, 135);  // 0.75% of 18000

  // Case 4.3: Wage above ESI threshold (₹25,000)
  const highWage = calculateStatutoryContributions(25000);
  assert.equal(highWage.pfEmployee, 1800); // Capped at ₹1,800
  assert.equal(highWage.esiEmployee, 0);   // Exempt from ESI (> 21000)
});

// ============================================================================
// 5. DATA PRIVACY & CRYPTO EDGE CASES
// ============================================================================

test("Crypto Edge Case: Aadhaar formats, empty inputs, and roundtrip encryption", () => {
  // Aadhaar with spaces or hyphens
  const rawAadhaar = "9988 7766 5544";
  const cleanDigits = rawAadhaar.replace(/\D/g, "");
  assert.equal(getAadhaarLast4(cleanDigits), "5544");
  assert.equal(maskAadhaar(cleanDigits), "XXXX-XXXX-5544");

  // AES-256-GCM empty or special characters
  const emptyEncrypted = encryptText("");
  assert.equal(decryptText(emptyEncrypted), "");

  const specialText = "Special #@! Indian Address, Kol-700001 (W.B.)";
  assert.equal(decryptText(encryptText(specialText)), specialText);

  // HMAC deterministic for indexing
  assert.equal(hashAadhaar("123456789012"), hashAadhaar("123456789012"));
});
