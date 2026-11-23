import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { maskAadhaar } from "../../lib/crypto/index.ts";
import { ApplicantStatus, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { ApplicantDraftSchema, ApplicantSubmitSchema } from "./schema.ts";
import { formDataWithoutFiles } from "../../lib/applicantFormFields.ts";
import { firstZodMessage } from "../../lib/publicErrors.ts";
import type { OfficeAdmin } from "../../lib/officeAdmin.ts";
import { formPrefillFromApplicant } from "../candidates/services.ts";
import { allocateApplicationNo, ensureApplicantNumbers } from "../../lib/applicationNumbers.ts";
import { aadhaarDisplayOf, ensurePeople, findOrCreatePerson } from "../../lib/personIdentity.ts";
import { findOrCreateDutySite } from "../../lib/nkSites.ts";

export { ensureApplicantNumbers };

function scrubFormDataPii(form: Record<string, any>) {
  const next = { ...form };
  if (next.aadhaar) next.aadhaar = maskAadhaar(String(next.aadhaar));
  return next;
}

function extraPostKey(formData: unknown) {
  const fd = (formData || {}) as Record<string, any>;
  const other = String(fd.otherCategory || "").trim().toLowerCase().replace(/\s+/g, " ");
  const gem = String(fd.gemProfile || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (other && other !== "others") return other;
  if (gem && gem !== "others") return gem;
  return "";
}

function extraPostLabel(formData: unknown) {
  const fd = (formData || {}) as Record<string, any>;
  const other = String(fd.otherCategory || "").trim();
  const gem = String(fd.gemProfile || "").trim();
  if (other && other.toLowerCase() !== "others") return other;
  if (gem && gem.toLowerCase() !== "others") return gem;
  return "";
}

function isSamePost(
  row: { jobRoleId: string; roleCategoryId: string; formData: unknown },
  jobRoleId: string,
  roleCategoryId: string,
  extra: string,
) {
  if (row.jobRoleId !== jobRoleId || row.roleCategoryId !== roleCategoryId) return false;
  return extraPostKey(row.formData) === extra;
}

function digitsMobile(value?: string | null) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function sameApplicantIdentity(
  left: { candidateAccountId?: string | null; personId?: string | null; mobile?: string | null; fullName?: string | null },
  right: { candidateAccountId?: string | null; personId?: string | null; mobile?: string | null; fullName?: string | null },
) {
  if (left.candidateAccountId && right.candidateAccountId && left.candidateAccountId === right.candidateAccountId) {
    return true;
  }
  if (left.personId && right.personId && left.personId === right.personId) return true;
  const leftMobile = digitsMobile(left.mobile);
  const rightMobile = digitsMobile(right.mobile);
  const leftName = String(left.fullName || "").trim().toLowerCase();
  const rightName = String(right.fullName || "").trim().toLowerCase();
  return Boolean(leftMobile && leftMobile === rightMobile && leftName && leftName === rightName);
}

const LIVE_STATUSES = [ApplicantStatus.NEW, ApplicantStatus.SHORTLISTED, ApplicantStatus.APPROVED] as const;

async function hideConsumedDrafts(companyId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  await prisma.applicant.updateMany({
    where: { companyId, id: { in: unique }, status: ApplicantStatus.DRAFT, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await prisma.auditLog.createMany({
    data: unique.map((entityId) => ({
      companyId,
      entityType: "APPLICANT",
      entityId,
      action: "CONSUME_DRAFT",
      newValue: { hiddenBecause: "submitted" },
    })),
  });
}

async function consumeMatchingDrafts({
  companyId,
  keepId,
  candidateAccountId,
  personId,
  mobile,
  fullName,
  jobRoleId,
  roleCategoryId,
  extra,
}: {
  companyId: string;
  keepId?: string;
  candidateAccountId?: string | null;
  personId?: string | null;
  mobile?: string | null;
  fullName?: string | null;
  jobRoleId: string;
  roleCategoryId: string;
  extra: string;
}) {
  const or = [
    ...(candidateAccountId ? [{ candidateAccountId }] : []),
    ...(personId ? [{ personId }] : []),
    ...(digitsMobile(mobile) ? [{ mobile: digitsMobile(mobile) }] : []),
  ];
  if (!or.length) return;
  const drafts = await prisma.applicant.findMany({
    where: {
      companyId,
      status: ApplicantStatus.DRAFT,
      deletedAt: null,
      ...(keepId ? { NOT: { id: keepId } } : {}),
      OR: or,
    },
  });
  const identity = { candidateAccountId, personId, mobile, fullName };
  const leftover = drafts.filter(
    (row) => sameApplicantIdentity(row, identity) && isSamePost(row, jobRoleId, roleCategoryId, extra),
  );
  await hideConsumedDrafts(
    companyId,
    leftover.map((row) => row.id),
  );
}

async function consumeOrphanDrafts(companyId: string) {
  const drafts = await prisma.applicant.findMany({
    where: { companyId, status: ApplicantStatus.DRAFT, deletedAt: null },
    select: {
      id: true,
      candidateAccountId: true,
      personId: true,
      mobile: true,
      fullName: true,
      jobRoleId: true,
      roleCategoryId: true,
      formData: true,
    },
  });
  if (!drafts.length) return;
  const submitted = await prisma.applicant.findMany({
    where: { companyId, deletedAt: null, status: { in: [...LIVE_STATUSES] } },
    select: {
      candidateAccountId: true,
      personId: true,
      mobile: true,
      fullName: true,
      jobRoleId: true,
      roleCategoryId: true,
      formData: true,
    },
  });
  if (!submitted.length) return;
  const leftover = drafts.filter((draft) =>
    submitted.some(
      (row) =>
        sameApplicantIdentity(draft, row) &&
        isSamePost(draft, row.jobRoleId, row.roleCategoryId, extraPostKey(row.formData)),
    ),
  );
  await hideConsumedDrafts(
    companyId,
    leftover.map((row) => row.id),
  );
}

async function findOpenDraft({
  companyId,
  existingId,
  candidateAccountId,
  personId,
  mobile,
  fullName,
  jobRoleId,
  roleCategoryId,
  extra,
}: {
  companyId: string;
  existingId?: string;
  candidateAccountId?: string | null;
  personId?: string | null;
  mobile?: string | null;
  fullName?: string | null;
  jobRoleId: string;
  roleCategoryId: string;
  extra: string;
}) {
  if (existingId) {
    const byId = await prisma.applicant.findFirst({
      where: { id: existingId, companyId, deletedAt: null, status: ApplicantStatus.DRAFT },
    });
    if (byId) return byId;
  }
  const or = [
    ...(candidateAccountId ? [{ candidateAccountId }] : []),
    ...(personId ? [{ personId }] : []),
    ...(digitsMobile(mobile) ? [{ mobile: digitsMobile(mobile) }] : []),
  ];
  if (!or.length) return null;
  const drafts = await prisma.applicant.findMany({
    where: {
      companyId,
      status: ApplicantStatus.DRAFT,
      deletedAt: null,
      jobRoleId,
      roleCategoryId,
      OR: or,
    },
    orderBy: { createdAt: "asc" },
  });
  const identity = { candidateAccountId, personId, mobile, fullName };
  return (
    drafts.find((row) => sameApplicantIdentity(row, identity) && extraPostKey(row.formData) === extra) || null
  );
}

async function findSubmittedSamePost({
  companyId,
  candidateAccountId,
  personId,
  mobile,
  fullName,
  jobRoleId,
  roleCategoryId,
  extra,
  excludeId,
}: {
  companyId: string;
  candidateAccountId?: string | null;
  personId?: string | null;
  mobile?: string | null;
  fullName?: string | null;
  jobRoleId: string;
  roleCategoryId: string;
  extra: string;
  excludeId?: string;
}) {
  const or = [
    ...(candidateAccountId ? [{ candidateAccountId }] : []),
    ...(personId ? [{ personId }] : []),
    ...(digitsMobile(mobile) ? [{ mobile: digitsMobile(mobile) }] : []),
  ];
  if (!or.length) return null;
  const rows = await prisma.applicant.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: [...LIVE_STATUSES] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      OR: or,
    },
  });
  const identity = { candidateAccountId, personId, mobile, fullName };
  return rows.find((row) => sameApplicantIdentity(row, identity) && isSamePost(row, jobRoleId, roleCategoryId, extra)) || null;
}

async function restoreHiddenDifferentRoles(companyId: string) {
  const hidden = await prisma.applicant.findMany({
    where: { companyId, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!hidden.length) return;
  const ids = hidden.map((row) => row.id);
  const userDeleted = await prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: "APPLICANT",
      action: { in: ["SOFT_DELETE", "CONSUME_DRAFT"] },
      entityId: { in: ids },
    },
    select: { entityId: true },
  });
  const keepHidden = new Set(userDeleted.map((row) => row.entityId));
  const restoreIds = ids.filter((id) => !keepHidden.has(id));
  if (!restoreIds.length) return;
  await prisma.applicant.updateMany({
    where: { companyId, id: { in: restoreIds } },
    data: { deletedAt: null },
  });
}

function mergeApplicantDocuments(existing: unknown, incoming: unknown) {
  const byType = new Map<string, any>();
  for (const doc of Array.isArray(existing) ? existing : []) {
    const type = String(doc?.docType || "").toUpperCase();
    if (type) byType.set(type, doc);
  }
  for (const doc of Array.isArray(incoming) ? incoming : []) {
    const type = String(doc?.docType || "").toUpperCase();
    if (!type) continue;
    if (doc?.fileData || doc?.fileName) byType.set(type, doc);
  }
  return [...byType.values()];
}

function applicantWriteFields(input: z.infer<typeof ApplicantSubmitSchema>, formData: Record<string, any>, pvcStatus: VerificationStatus) {
  return {
    jobRoleId: input.jobRoleId,
    roleCategoryId: input.roleCategoryId,
    fullName: input.fullName.trim(),
    mobile: input.mobile.trim(),
    email: input.email ? input.email.trim().toLowerCase() : null,
    fatherOrHusband: input.fatherOrHusband?.trim() || null,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    gender: input.gender || null,
    presentAddress: input.presentAddress?.trim() || null,
    permanentAddress: input.permanentAddress?.trim() || null,
    pan: input.panNumber ? input.panNumber.trim().toUpperCase() : null,
    armsLicenseNo: input.armsLicenseNo?.trim() || null,
    armsExpiryDate: input.armsExpiryDate ? new Date(input.armsExpiryDate) : null,
    exServiceNo: input.exServiceNo?.trim() || null,
    pvcStatus,
    formData,
    documents: input.documents,
  };
}

export async function submitApplicant(
  rawInput: z.infer<typeof ApplicantSubmitSchema>,
  officeAdmin?: OfficeAdmin | null,
  existingId?: string,
) {
  const parsed = ApplicantSubmitSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  const input = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const fillerName = String(officeAdmin?.name || "").trim();
  const fillerPhone = String(officeAdmin?.phone || "").replace(/\D/g, "").slice(-10);
  if (officeAdmin) {
    if (fillerName.length < 2) throw new Error("Please enter the filling admin name.");
    if (fillerPhone.length !== 10) throw new Error("Please enter the filling admin 10-digit phone number.");
  }

  const filledByAdmin = officeAdmin
    ? {
        userId: officeAdmin.id,
        name: fillerName,
        phone: fillerPhone,
        email: officeAdmin.email,
        filledAt: new Date().toISOString(),
      }
    : null;

  // Candidate OTP is required unless an office admin is filling this form.
  let isVerified = Boolean(filledByAdmin);
  if (!isVerified && input.candidateAccountId) {
    const candidate = await prisma.candidateAccount.findUnique({
      where: { id: input.candidateAccountId },
    });
    if (candidate?.isVerified) {
      isVerified = true;
    }
  }

  if (!isVerified) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const identifiers = [input.mobile, input.email].filter(Boolean) as string[];
    const verifiedOtp = await prisma.applicantOtp.findFirst({
      where: {
        companyId: company.id,
        identifier: { in: identifiers },
        verifiedAt: { gte: oneHourAgo },
      },
      orderBy: { verifiedAt: "desc" },
    });

    if (!verifiedOtp) {
      throw new Error("OTP verification by email is required before submitting the application.");
    }
  }

  await ensureApplicantNumbers(company.id);
  await ensurePeople(company.id);
  const person = await findOrCreatePerson(company.id, input.aadhaarNumber);

  let pvcStatus: VerificationStatus = VerificationStatus.PENDING;
  const rawPolice = String(input.formData?.policeStatus || "").toLowerCase();
  if (rawPolice === "verified") {
    pvcStatus = VerificationStatus.VERIFIED;
  } else if (rawPolice === "rejected") {
    pvcStatus = VerificationStatus.REJECTED;
  }

  const incomingExtra = extraPostKey(input.formData);
  const identity = {
    candidateAccountId: input.candidateAccountId || null,
    personId: person.id,
    mobile: input.mobile.trim(),
    fullName: input.fullName.trim(),
  };
  const samePost = await findSubmittedSamePost({
    companyId: company.id,
    ...identity,
    jobRoleId: input.jobRoleId,
    roleCategoryId: input.roleCategoryId,
    extra: incomingExtra,
  });
  if (samePost && samePost.status !== ApplicantStatus.NEW) {
    throw new Error(
      "You already have an application for this same trade and category. Please choose a different trade or category.",
    );
  }

  const savedForm = {
    ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
    ...(filledByAdmin ? { filledByAdmin } : {}),
  };

  if (samePost) {
    const existingForm = (samePost.formData || {}) as Record<string, any>;
    const applicant = await prisma.applicant.update({
      where: { id: samePost.id },
      data: {
        ...applicantWriteFields(
          input,
          {
            ...savedForm,
            filledByAdmin: filledByAdmin || existingForm.filledByAdmin || undefined,
            applicationNo: samePost.applicationNo,
            officeApplicantId: existingForm.officeApplicantId || undefined,
            temporaryId: existingForm.temporaryId || undefined,
            shortlistSiteId: existingForm.shortlistSiteId || undefined,
            shortlistSiteName: existingForm.shortlistSiteName || undefined,
          },
          pvcStatus,
        ),
        personId: person.id,
        candidateAccountId: input.candidateAccountId || samePost.candidateAccountId,
        aadhaarEncrypted: null,
        aadhaarHash: null,
        aadhaarLast4: null,
        documents: mergeApplicantDocuments(samePost.documents, input.documents),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        userId: filledByAdmin?.userId || null,
        entityType: "APPLICANT",
        entityId: applicant.id,
        action: filledByAdmin ? "SUBMIT_BY_ADMIN" : "SUBMIT",
        newValue: {
          fullName: applicant.fullName,
          status: applicant.status,
          applicationNo: applicant.applicationNo,
          reusedExisting: true,
          ...(filledByAdmin ? { filledByAdmin } : {}),
        },
      },
    });
    await consumeMatchingDrafts({
      companyId: company.id,
      keepId: applicant.id,
      ...identity,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      extra: incomingExtra,
    });

    return { id: applicant.id, applicationNo: applicant.applicationNo, status: applicant.status };
  }

  const draftRow = await findOpenDraft({
    companyId: company.id,
    existingId,
    ...identity,
    jobRoleId: input.jobRoleId,
    roleCategoryId: input.roleCategoryId,
    extra: incomingExtra,
  });
  if (draftRow) {
    const applicationNo = draftRow.applicationNo || (await allocateApplicationNo(company));
    const existingForm = (draftRow.formData || {}) as Record<string, any>;
    const applicant = await prisma.applicant.update({
      where: { id: draftRow.id },
      data: {
        ...applicantWriteFields(
          input,
          {
            ...savedForm,
            filledByAdmin: filledByAdmin || existingForm.filledByAdmin || undefined,
            applicationNo,
            officeApplicantId: existingForm.officeApplicantId || undefined,
            temporaryId: existingForm.temporaryId || undefined,
            shortlistSiteId: existingForm.shortlistSiteId || undefined,
            shortlistSiteName: existingForm.shortlistSiteName || undefined,
          },
          pvcStatus,
        ),
        personId: person.id,
        candidateAccountId: input.candidateAccountId || draftRow.candidateAccountId,
        applicationNo,
        status: ApplicantStatus.NEW,
        aadhaarEncrypted: null,
        aadhaarHash: null,
        aadhaarLast4: null,
        documents: mergeApplicantDocuments(draftRow.documents, input.documents),
      },
    });
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        userId: filledByAdmin?.userId || null,
        entityType: "APPLICANT",
        entityId: applicant.id,
        action: filledByAdmin ? "SUBMIT_DRAFT_BY_ADMIN" : "SUBMIT_DRAFT",
        newValue: {
          fullName: applicant.fullName,
          status: applicant.status,
          applicationNo: applicant.applicationNo,
          ...(filledByAdmin ? { filledByAdmin } : {}),
        },
      },
    });
    await consumeMatchingDrafts({
      companyId: company.id,
      keepId: applicant.id,
      ...identity,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      extra: incomingExtra,
    });
    return { id: applicant.id, applicationNo, status: applicant.status };
  }

  const applicationNo = await allocateApplicationNo(company);

  const applicant = await prisma.applicant.create({
    data: {
      companyId: company.id,
      personId: person.id,
      candidateAccountId: input.candidateAccountId || null,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      fullName: input.fullName.trim(),
      mobile: input.mobile.trim(),
      email: input.email ? input.email.trim().toLowerCase() : null,
      fatherOrHusband: input.fatherOrHusband?.trim() || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender || null,
      presentAddress: input.presentAddress.trim(),
      permanentAddress: input.permanentAddress?.trim() || null,
      pan: input.panNumber ? input.panNumber.trim().toUpperCase() : null,
      armsLicenseNo: input.armsLicenseNo?.trim() || null,
      armsExpiryDate: input.armsExpiryDate ? new Date(input.armsExpiryDate) : null,
      exServiceNo: input.exServiceNo?.trim() || null,
      pvcStatus,
      applicationNo,
      formData: {
        ...savedForm,
        applicationNo,
      },
      documents: input.documents,
      status: ApplicantStatus.NEW,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: filledByAdmin?.userId || null,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: filledByAdmin ? "SUBMIT_BY_ADMIN" : "SUBMIT",
      newValue: {
        fullName: applicant.fullName,
        status: applicant.status,
        ...(filledByAdmin ? { filledByAdmin } : {}),
      },
    },
  });

  await consumeMatchingDrafts({
    companyId: company.id,
    keepId: applicant.id,
    ...identity,
    jobRoleId: input.jobRoleId,
    roleCategoryId: input.roleCategoryId,
    extra: incomingExtra,
  });
  return { id: applicant.id, applicationNo, status: applicant.status };
}

function draftMobile(value?: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? digits : "";
}

export async function saveApplicantDraft(
  rawInput: z.infer<typeof ApplicantDraftSchema>,
  officeAdmin?: OfficeAdmin | null,
  existingId?: string,
) {
  const parsed = ApplicantDraftSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  const input = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");
  if (!officeAdmin && !input.candidateAccountId) {
    throw new Error("Please sign in before saving a draft.");
  }

  const fillerName = String(officeAdmin?.name || "").trim();
  const fillerPhone = String(officeAdmin?.phone || "").replace(/\D/g, "").slice(-10);
  const filledByAdmin = officeAdmin
    ? {
        userId: officeAdmin.id,
        name: fillerName || officeAdmin.name,
        phone: fillerPhone,
        email: officeAdmin.email,
        filledAt: new Date().toISOString(),
      }
    : null;

  const aadhaar = String(input.aadhaarNumber || "").replace(/\D/g, "");
  let personId: string | null = null;
  if (aadhaar.length === 12) {
    await ensurePeople(company.id);
    const person = await findOrCreatePerson(company.id, aadhaar);
    personId = person.id;
  }

  const incomingExtra = extraPostKey(input.formData);
  let existing =
    existingId
      ? await prisma.applicant.findFirst({
          where: { id: existingId, companyId: company.id, deletedAt: null },
        })
      : null;
  if (existing && existing.status !== ApplicantStatus.DRAFT) {
    throw new Error("This form is already submitted. Use Save changes.");
  }
  if (!existing) {
    existing = await findOpenDraft({
      companyId: company.id,
      candidateAccountId: input.candidateAccountId,
      personId,
      mobile: input.mobile,
      fullName: input.fullName,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      extra: incomingExtra,
    });
  }
  if (!existing) {
    const submittedTwin = await findSubmittedSamePost({
      companyId: company.id,
      candidateAccountId: input.candidateAccountId,
      personId,
      mobile: input.mobile,
      fullName: input.fullName,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      extra: incomingExtra,
    });
    if (submittedTwin) {
      return {
        id: submittedTwin.id,
        applicationNo: submittedTwin.applicationNo,
        status: submittedTwin.status,
      };
    }
  }

  const existingForm = ((existing?.formData || {}) as Record<string, any>) || {};
  const savedForm = {
    ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
    ...(filledByAdmin ? { filledByAdmin: { ...filledByAdmin, filledAt: existingForm.filledByAdmin?.filledAt || filledByAdmin.filledAt } } : {}),
    draftSavedAt: new Date().toISOString(),
    applicationNo: existing?.applicationNo || undefined,
    officeApplicantId: existingForm.officeApplicantId || undefined,
    temporaryId: existingForm.temporaryId || undefined,
    shortlistSiteId: existingForm.shortlistSiteId || undefined,
    shortlistSiteName: existingForm.shortlistSiteName || undefined,
  };

  const dob = input.dateOfBirth && /^\d{4}-\d{2}-\d{2}/.test(input.dateOfBirth) ? new Date(input.dateOfBirth) : null;
  const write = {
    jobRoleId: input.jobRoleId,
    roleCategoryId: input.roleCategoryId,
    fullName: String(input.fullName || "").trim() || "Draft",
    mobile: draftMobile(input.mobile),
    email: input.email ? String(input.email).trim().toLowerCase() : null,
    fatherOrHusband: input.fatherOrHusband?.trim() || null,
    dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob : null,
    gender: input.gender || null,
    presentAddress: input.presentAddress?.trim() || null,
    permanentAddress: input.permanentAddress?.trim() || null,
    pan: input.panNumber ? String(input.panNumber).trim().toUpperCase() : null,
    armsLicenseNo: input.armsLicenseNo?.trim() || null,
    exServiceNo: input.exServiceNo?.trim() || null,
    personId,
    formData: savedForm,
    documents: mergeApplicantDocuments(existing?.documents, input.documents),
    status: ApplicantStatus.DRAFT,
  };

  const applicant = existing
    ? await prisma.applicant.update({
        where: { id: existing.id },
        data: {
          ...write,
          candidateAccountId: input.candidateAccountId || existing.candidateAccountId,
        },
      })
    : await prisma.applicant.create({
        data: {
          companyId: company.id,
          candidateAccountId: input.candidateAccountId || null,
          ...write,
        },
      });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: filledByAdmin?.userId || null,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: filledByAdmin ? "SAVE_DRAFT_BY_ADMIN" : "SAVE_DRAFT",
      newValue: { fullName: applicant.fullName, status: applicant.status },
    },
  });

  return { id: applicant.id, applicationNo: applicant.applicationNo, status: applicant.status };
}

export async function listApplicants({
  companyId,
  roleId,
  status,
  search,
  page = 1,
  limit = 20,
}: {
  companyId: string;
  roleId?: string;
  status?: ApplicantStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const tenantDb = getTenantPrisma(companyId);
  await consumeOrphanDrafts(companyId);
  await ensureApplicantNumbers(companyId);
  await ensurePeople(companyId);
  await restoreHiddenDifferentRoles(companyId);

  const where: any = {
    deletedAt: null,
  };

  if (roleId) where.jobRoleId = roleId;
  if (status) where.status = status;
  else where.status = { not: ApplicantStatus.DRAFT };
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
      { aadhaarLast4: { contains: search } },
      { person: { aadhaarLast4: { contains: search } } },
      { applicationNo: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    tenantDb.applicant.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        mobile: true,
        email: true,
        pan: true,
        aadhaarEncrypted: true,
        aadhaarLast4: true,
        formData: true,
        applicationNo: true,
        status: true,
        createdAt: true,
        jobRole: { select: { id: true, name: true, code: true } },
        roleCategory: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true } },
        person: { select: { aadhaarEncrypted: true, aadhaarLast4: true } },
      },
      orderBy: [{ createdAt: "asc" }, { applicationNo: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    tenantDb.applicant.count({ where }),
  ]);

  const safeItems = items.map(({ aadhaarEncrypted, aadhaarLast4, formData, person, ...app }) => ({
    ...app,
    applicationNo: app.applicationNo || String((formData as any)?.applicationNo || "") || null,
    officeApplicantId: String((formData as any)?.officeApplicantId || ""),
    temporaryId: String((formData as any)?.temporaryId || ""),
    shortlistSiteId: String((formData as any)?.shortlistSiteId || ""),
    shortlistSiteName: String((formData as any)?.shortlistSiteName || ""),
    preferredSiteName: String((formData as any)?.preferredSiteName || (formData as any)?.preferredSiteOther || ""),
    filledByAdmin: (formData as any)?.filledByAdmin || null,
    jobExtra: extraPostLabel(formData),
    aadhaarDisplay: aadhaarDisplayOf({ person, aadhaarEncrypted, aadhaarLast4 }),
  }));

  return { items: safeItems, total, page, totalPages: Math.ceil(total / limit) };
}

export async function addApplicantRemark({
  companyId,
  userId,
  applicantId,
  remark,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
  remark: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const applicant = await tenantDb.applicant.findFirst({
    where: { id: applicantId, deletedAt: null },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  const created = await prisma.applicantRemark.create({
    data: {
      applicantId,
      userId,
      remark: remark.trim(),
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      entityType: "APPLICANT",
      entityId: applicantId,
      action: "ADD_REMARK",
      newValue: { remark: remark.trim() },
    },
  });

  return created;
}

export async function updateApplicantStatus({
  companyId,
  userId,
  applicantId,
  newStatus,
  remark,
  siteId,
  temporaryId,
  otherSiteName,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
  newStatus: ApplicantStatus;
  remark: string;
  siteId?: string;
  temporaryId?: string;
  otherSiteName?: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const applicant = await tenantDb.applicant.findFirst({
    where: { id: applicantId, deletedAt: null },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  if (applicant.status === ApplicantStatus.APPROVED) {
    throw new Error("Cannot change status of an already approved applicant.");
  }
  if (applicant.status === ApplicantStatus.DRAFT) {
    throw new Error("This is a draft. Please complete and submit the form first.");
  }

  const existingForm = (applicant.formData || {}) as Record<string, any>;
  let nextForm = existingForm;
  if (newStatus === ApplicantStatus.SHORTLISTED) {
    const tid = String(temporaryId || "").trim();
    if (!tid) throw new Error("Please enter the Temporary ID (TID).");
    const site = await findOrCreateDutySite({
      companyId,
      siteId,
      otherName: otherSiteName,
    });

    const taken = await prisma.applicant.findFirst({
      where: {
        companyId,
        deletedAt: null,
        id: { not: applicantId },
        formData: { path: ["temporaryId"], equals: tid },
      },
      select: { id: true, fullName: true },
    });
    if (taken) throw new Error("This Temporary ID (TID) is already used. Please type a different one.");

    nextForm = {
      ...existingForm,
      temporaryId: tid,
      shortlistSiteId: site.id,
      shortlistSiteName: site.name,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.applicant.update({
      where: { id: applicantId },
      data: { status: newStatus, formData: nextForm },
    });

    await tx.applicantRemark.create({
      data: {
        applicantId,
        userId,
        remark: `Status changed to ${newStatus}: ${remark.trim()}`,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "APPLICANT",
        entityId: applicantId,
        action: `STATUS_${newStatus}`,
        oldValue: { status: applicant.status },
        newValue: {
          status: newStatus,
          remark,
          ...(newStatus === ApplicantStatus.SHORTLISTED
            ? {
                temporaryId: nextForm.temporaryId,
                shortlistSiteId: nextForm.shortlistSiteId,
                shortlistSiteName: nextForm.shortlistSiteName,
              }
            : {}),
        },
      },
    });

    return res;
  });

  return updated;
}

export async function saveOfficeApplicantId({
  companyId,
  applicantId,
  officeApplicantId,
}: {
  companyId: string;
  applicantId: string;
  officeApplicantId: string;
}) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    include: { employee: { select: { id: true, employeeCode: true } } },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");
  if (applicant.status !== ApplicantStatus.APPROVED) {
    throw new Error("Employee ID number can be entered only after the applicant is approved.");
  }

  const employeeIdNo = String(officeApplicantId || "").trim();
  if (!employeeIdNo) throw new Error("Please enter the employee ID number.");

  const formData = {
    ...((applicant.formData as Record<string, unknown>) || {}),
    officeApplicantId: employeeIdNo,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicant.update({
        where: { id: applicantId },
        data: { formData },
      });
      if (applicant.employee?.id && applicant.employee.employeeCode !== employeeIdNo) {
        await tx.employee.update({
          where: { id: applicant.employee.id },
          data: { employeeCode: employeeIdNo },
        });
      }
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error("This employee ID number is already used.");
    }
    throw error;
  }

  return { officeApplicantId: employeeIdNo, employeeCode: employeeIdNo };
}

export async function getApplicantForOwnEdit({
  companyId,
  applicantId,
  candidateId,
}: {
  companyId: string;
  applicantId: string;
  candidateId: string;
}) {
  if (!applicantId || !/^[0-9a-f-]{36}$/i.test(applicantId)) {
    throw new Error("Application not found.");
  }
  const row = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId,
      candidateAccountId: candidateId,
      deletedAt: null,
    },
    select: {
      id: true,
      applicationNo: true,
      status: true,
      jobRoleId: true,
      roleCategoryId: true,
      fullName: true,
      mobile: true,
      email: true,
      fatherOrHusband: true,
      dateOfBirth: true,
      gender: true,
      pan: true,
      aadhaarEncrypted: true,
      exServiceNo: true,
      armsLicenseNo: true,
      formData: true,
      documents: true,
      person: { select: { aadhaarEncrypted: true } },
    },
  });
  if (!row) throw new Error("Application not found.");
  return {
    id: row.id,
    applicationNo: row.applicationNo,
    status: row.status,
    jobRoleId: row.jobRoleId,
    roleCategoryId: row.roleCategoryId,
    prefill: formPrefillFromApplicant({
      ...row,
      aadhaarEncrypted: row.person?.aadhaarEncrypted || row.aadhaarEncrypted,
    }),
  };
}

export async function getApplicantForAdminEdit({
  companyId,
  applicantId,
}: {
  companyId: string;
  applicantId: string;
}) {
  if (!applicantId || !/^[0-9a-f-]{36}$/i.test(applicantId)) {
    throw new Error("Applicant not found in this company.");
  }
  await ensureApplicantNumbers(companyId);
  await ensurePeople(companyId);
  const row = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    select: {
      id: true,
      applicationNo: true,
      status: true,
      jobRoleId: true,
      roleCategoryId: true,
      fullName: true,
      mobile: true,
      email: true,
      fatherOrHusband: true,
      dateOfBirth: true,
      gender: true,
      pan: true,
      aadhaarEncrypted: true,
      exServiceNo: true,
      armsLicenseNo: true,
      formData: true,
      documents: true,
      person: { select: { aadhaarEncrypted: true } },
    },
  });
  if (!row) throw new Error("Applicant not found in this company.");
  return {
    id: row.id,
    applicationNo: row.applicationNo,
    status: row.status,
    jobRoleId: row.jobRoleId,
    roleCategoryId: row.roleCategoryId,
    prefill: formPrefillFromApplicant({
      ...row,
      aadhaarEncrypted: row.person?.aadhaarEncrypted || row.aadhaarEncrypted,
    }),
  };
}

export async function updateApplicant(
  applicantId: string,
  rawInput: z.infer<typeof ApplicantSubmitSchema>,
  officeAdmin?: OfficeAdmin | null,
) {
  if (!officeAdmin) throw new Error("Only office admin can edit an application.");
  const parsed = ApplicantSubmitSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  const input = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const existing = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId: company.id, deletedAt: null },
  });
  if (!existing) throw new Error("Applicant not found in this company.");

  const fillerName = String(officeAdmin.name || "").trim();
  const fillerPhone = String(officeAdmin.phone || "").replace(/\D/g, "").slice(-10);
  if (fillerName.length < 2) throw new Error("Please enter the filling admin name.");
  if (fillerPhone.length !== 10) throw new Error("Please enter the filling admin 10-digit phone number.");

  await ensurePeople(company.id);
  const person = await findOrCreatePerson(company.id, input.aadhaarNumber);
  const incomingExtra = extraPostKey(input.formData);
  const existingSameAadhaar = await prisma.applicant.findMany({
    where: {
      companyId: company.id,
      personId: person.id,
      deletedAt: null,
      status: { in: [ApplicantStatus.NEW, ApplicantStatus.SHORTLISTED, ApplicantStatus.APPROVED] },
      NOT: { id: applicantId },
    },
    select: { jobRoleId: true, roleCategoryId: true, formData: true },
  });
  const sameTradeAndCategory = existingSameAadhaar.some((row) =>
    isSamePost(row, input.jobRoleId, input.roleCategoryId, incomingExtra),
  );
  if (sameTradeAndCategory) {
    throw new Error(
      "You already have an application for this same trade and category. Please choose a different trade or category.",
    );
  }

  let pvcStatus: VerificationStatus = VerificationStatus.PENDING;
  const rawPolice = String(input.formData?.policeStatus || "").toLowerCase();
  if (rawPolice === "verified") pvcStatus = VerificationStatus.VERIFIED;
  else if (rawPolice === "rejected") pvcStatus = VerificationStatus.REJECTED;

  const existingForm = (existing.formData || {}) as Record<string, any>;
  const filledByAdmin = {
    userId: officeAdmin.id,
    name: fillerName,
    phone: fillerPhone,
    email: officeAdmin.email,
    filledAt: existingForm.filledByAdmin?.filledAt || new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  };

  const wasDraft = existing.status === ApplicantStatus.DRAFT;
  const applicationNo = existing.applicationNo || (wasDraft ? await allocateApplicationNo(company) : existing.applicationNo);
  const applicant = await prisma.applicant.update({
    where: { id: applicantId },
    data: {
      ...applicantWriteFields(
        input,
        {
          ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
          filledByAdmin,
          applicationNo,
          officeApplicantId: existingForm.officeApplicantId || undefined,
          temporaryId: existingForm.temporaryId || undefined,
          shortlistSiteId: existingForm.shortlistSiteId || undefined,
          shortlistSiteName: existingForm.shortlistSiteName || undefined,
        },
        pvcStatus,
      ),
      personId: person.id,
      applicationNo,
      status: wasDraft ? ApplicantStatus.NEW : existing.status,
      aadhaarEncrypted: null,
      aadhaarHash: null,
      aadhaarLast4: null,
      documents: mergeApplicantDocuments(existing.documents, input.documents),
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: officeAdmin.id,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: "EDIT_BY_ADMIN",
      newValue: {
        fullName: applicant.fullName,
        applicationNo: applicant.applicationNo,
        editedBy: fillerName,
      },
    },
  });

  if (wasDraft) {
    await consumeMatchingDrafts({
      companyId: company.id,
      keepId: applicant.id,
      candidateAccountId: existing.candidateAccountId,
      personId: person.id,
      mobile: applicant.mobile,
      fullName: applicant.fullName,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      extra: incomingExtra,
    });
  }

  return { id: applicant.id, applicationNo: applicant.applicationNo, status: applicant.status };
}

export async function softDeleteApplicant({
  companyId,
  userId,
  applicantId,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
}) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    include: { employee: { select: { id: true } } },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  await prisma.$transaction(async (tx) => {
    await tx.applicant.update({
      where: { id: applicantId },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "APPLICANT",
        entityId: applicantId,
        action: "SOFT_DELETE",
        oldValue: { status: applicant.status, applicationNo: applicant.applicationNo },
        newValue: { deletedAt: new Date() },
      },
    });
  });

  return { success: true, hadEmployee: Boolean(applicant.employee) };
}
