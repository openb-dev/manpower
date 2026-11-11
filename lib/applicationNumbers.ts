import { prisma } from "@/lib/db";

function companyApplicantPrefix(slug: string, seqPrefix?: string | null) {
  if (slug === "nk") return "NK";
  const clean = String(seqPrefix || "NK").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean || "NK";
}

function applicantSerial(code: string | null | undefined) {
  const match = String(code || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export async function allocateApplicationNo(company: { id: string; slug: string }) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seq = await prisma.companySequence.upsert({
      where: { companyId: company.id },
      update: { nextApplicantNumber: { increment: 1 } },
      create: {
        companyId: company.id,
        prefix: companyApplicantPrefix(company.slug),
        nextNumber: 1,
        nextApplicantNumber: 2,
      },
    });
    const prefix = companyApplicantPrefix(company.slug, seq.prefix);
    const applicationNo = `${prefix}-${String(seq.nextApplicantNumber - 1).padStart(4, "0")}`;
    const clash = await prisma.applicant.findFirst({
      where: { companyId: company.id, applicationNo },
      select: { id: true },
    });
    if (!clash) return applicationNo;
  }
  throw new Error("Could not create Application ID. Please try again.");
}

export async function ensureApplicantNumbers(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, slug: true, sequence: true },
  });
  if (!company) return;

  const prefix = companyApplicantPrefix(company.slug, company.sequence?.prefix);
  const pending = await prisma.applicant.findMany({
    where: {
      companyId,
      OR: [{ applicationNo: null }, { applicationNo: "" }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, formData: true },
  });

  const numbered = await prisma.applicant.findMany({
    where: { companyId, applicationNo: { not: null } },
    select: { applicationNo: true },
  });
  let next = 1;
  for (const row of numbered) {
    next = Math.max(next, applicantSerial(row.applicationNo) + 1);
  }

  for (const row of pending) {
    const applicationNo = `${prefix}-${String(next).padStart(4, "0")}`;
    const formData =
      row.formData && typeof row.formData === "object" && !Array.isArray(row.formData)
        ? { ...(row.formData as Record<string, unknown>), applicationNo }
        : { applicationNo };
    await prisma.applicant.update({
      where: { id: row.id },
      data: { applicationNo, formData },
    });
    next += 1;
  }

  await prisma.companySequence.upsert({
    where: { companyId },
    update: { nextApplicantNumber: next },
    create: {
      companyId,
      prefix,
      nextNumber: 1,
      nextApplicantNumber: next,
    },
  });
}
