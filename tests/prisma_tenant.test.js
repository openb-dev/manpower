process.env.NODE_ENV = "test";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma, getTenantPrisma } from "../lib/db/index.ts";
import { requestApplicantOtp, verifyApplicantOtp } from "../modules/otp/services.ts";
import { submitApplicant, listApplicants } from "../modules/applicants/services.ts";
import { approveApplicantAndCreateEmployee, listEmployees } from "../modules/employees/services.ts";

test("Database: Companies and Sequences are seeded", async () => {
  const companies = await prisma.company.findMany({
    include: { sequence: true, jobRoles: true },
  });
  assert.equal(companies.length, 4);

  const nk = companies.find((c) => c.slug === "nk");
  assert.ok(nk);
  assert.equal(nk.sequence?.prefix, "NK");
  assert.ok(nk.jobRoles.length >= 3);
});

test("Database: OTP request and verification flow", async () => {
  const testPhone = "9876" + Math.floor(100000 + Math.random() * 900000);
  const reqRes = await requestApplicantOtp({
    companySlug: "nk",
    identifier: testPhone,
  });
  assert.equal(reqRes.success, true);
  assert.ok(reqRes.trialCode);

  const verifyRes = await verifyApplicantOtp({
    companySlug: "nk",
    identifier: testPhone,
    code: reqRes.trialCode,
  });
  assert.equal(verifyRes.verified, true);
});

test("Database: Submit applicant and verify tenant isolation", async () => {
  const nk = await prisma.company.findUnique({
    where: { slug: "nk" },
    include: { jobRoles: { include: { categories: true } } },
  });
  const origin = await prisma.company.findUnique({
    where: { slug: "origin" },
  });
  assert.ok(nk && origin);

  const role = nk.jobRoles[0];
  const cat = role.categories[0];

  const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
  const applicantPhone = `912345${randomSuffix}`;
  const testAadhaar = `88887777${randomSuffix}`;

  // Pre-verify OTP for applicant
  const otpRes = await requestApplicantOtp({ companySlug: "nk", identifier: applicantPhone });
  await verifyApplicantOtp({ companySlug: "nk", identifier: applicantPhone, code: otpRes.trialCode });

  // Submit
  const submitRes = await submitApplicant({
    companySlug: "nk",
    jobRoleId: role.id,
    roleCategoryId: cat.id,
    fullName: "Ramesh Kumar",
    mobile: applicantPhone,
    presentAddress: "Kolkata, Sector V",
    aadhaarNumber: testAadhaar,
    formData: { religion: "Hindu", height: 172 },
    documents: [],
  });
  assert.ok(submitRes.id);

  // Tenant Isolation Check:
  // Querying NK tenant sees applicant
  const nkList = await listApplicants({ companyId: nk.id });
  const foundInNk = nkList.items.find((a) => a.id === submitRes.id);
  assert.ok(foundInNk);
  assert.equal(foundInNk.aadhaarDisplay, `XXXX-XXXX-${randomSuffix}`); // Masked in UI

  // Querying Origin tenant MUST NOT see applicant
  const originList = await listApplicants({ companyId: origin.id });
  const foundInOrigin = originList.items.find((a) => a.id === submitRes.id);
  assert.equal(foundInOrigin, undefined);
});

test("Database: Approve applicant and atomically generate sequential employee code", async () => {
  const nk = await prisma.company.findUnique({
    where: { slug: "nk" },
    include: { jobRoles: { include: { categories: true } } },
  });
  const admin = await prisma.user.findFirst({
    where: { companyId: nk.id },
  });
  assert.ok(nk && admin);

  const role = nk.jobRoles[0];
  const cat = role.categories[0];

  const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
  const testPhone = `998877${randomSuffix}`;
  const testAadhaar = `77776666${randomSuffix}`;

  const otp = await requestApplicantOtp({ companySlug: "nk", identifier: testPhone });
  await verifyApplicantOtp({ companySlug: "nk", identifier: testPhone, code: otp.trialCode });

  const applicant = await submitApplicant({
    companySlug: "nk",
    jobRoleId: role.id,
    roleCategoryId: cat.id,
    fullName: "Suresh Mondal",
    mobile: testPhone,
    presentAddress: "Salt Lake, Kolkata",
    aadhaarNumber: testAadhaar,
    formData: { height: 175 },
    documents: [],
  });

  const employee = await approveApplicantAndCreateEmployee({
    companyId: nk.id,
    userId: admin.id,
    applicantId: applicant.id,
    basicRate: 15500,
    divisorDays: 26,
    remark: "All physical certificates verified.",
  });

  assert.ok(employee);
  assert.match(employee.employeeCode, /^NK-\d{4}$/);
  assert.equal(employee.status, "ACTIVE");

  // Applicant status is updated to APPROVED
  const updatedApp = await prisma.applicant.findUnique({
    where: { id: applicant.id },
  });
  assert.equal(updatedApp.status, "APPROVED");

  // Audit log is written
  const audit = await prisma.auditLog.findFirst({
    where: { companyId: nk.id, entityId: employee.id },
  });
  assert.ok(audit);
  assert.equal(audit.action, "APPROVE_AND_CONVERT");
});
