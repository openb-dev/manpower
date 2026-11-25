import { prisma } from "@/lib/db";

function mapRow(row: any) {
  return {
    id: row.id,
    companyId: row.companyId,
    departmentName: row.departmentName || "",
    officerName: row.officerName || "",
    designation: row.designation || "",
    contactOfficial: row.contactOfficial || "",
    contactPersonal: row.contactPersonal || "",
    whatsappNumber: row.whatsappNumber || "",
    emailOfficial: row.emailOfficial || "",
    emailPersonal: row.emailPersonal || "",
    websiteLink: row.websiteLink || "",
    officeAddress: row.officeAddress || "",
    location: row.location || "",
    remarks: row.remarks || "",
    sortOrder: row.sortOrder || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listClientDetails(companyId: string) {
  const rows = await prisma.clientDetail.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapRow);
}

export async function saveClientDetail(
  companyId: string,
  input: {
    id?: string;
    departmentName?: string;
    officerName?: string;
    designation?: string;
    contactOfficial?: string;
    contactPersonal?: string;
    whatsappNumber?: string;
    emailOfficial?: string;
    emailPersonal?: string;
    websiteLink?: string;
    officeAddress?: string;
    location?: string;
    remarks?: string;
    sortOrder?: number;
  },
) {
  const data = {
    departmentName: String(input.departmentName || "").trim(),
    officerName: String(input.officerName || "").trim(),
    designation: String(input.designation || "").trim(),
    contactOfficial: String(input.contactOfficial || "").trim(),
    contactPersonal: String(input.contactPersonal || "").trim(),
    whatsappNumber: String(input.whatsappNumber || "").replace(/\D/g, "").slice(-10),
    emailOfficial: String(input.emailOfficial || "").trim().toLowerCase(),
    emailPersonal: String(input.emailPersonal || "").trim().toLowerCase(),
    websiteLink: String(input.websiteLink || "").trim(),
    officeAddress: String(input.officeAddress || "").trim(),
    location: String(input.location || "").trim(),
    remarks: String(input.remarks || "").trim(),
    sortOrder: Number(input.sortOrder || 0),
  };

  if (!data.departmentName && !data.officerName) {
    throw new Error("Please enter Department Name or Officer Name.");
  }

  if (input.id) {
    const existing = await prisma.clientDetail.findFirst({
      where: { id: input.id, companyId, deletedAt: null },
    });
    if (!existing) throw new Error("Client detail not found.");
    const row = await prisma.clientDetail.update({
      where: { id: input.id },
      data,
    });
    return mapRow(row);
  }

  const count = await prisma.clientDetail.count({
    where: { companyId, deletedAt: null },
  });
  const row = await prisma.clientDetail.create({
    data: {
      companyId,
      ...data,
      sortOrder: data.sortOrder || count + 1,
    },
  });
  return mapRow(row);
}

export async function deleteClientDetail(companyId: string, id: string) {
  const existing = await prisma.clientDetail.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Client detail not found.");
  await prisma.clientDetail.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return { success: true };
}
