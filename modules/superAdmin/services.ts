import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import {
  isAssignableOfficeRole,
  officeRoleLabel,
  type AssignableOfficeRole,
} from "@/lib/officeRoles";

function mapUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: officeRoleLabel(row.role),
    companyId: row.companyId,
    companyName: row.company?.shortName || row.company?.legalName || null,
    companySlug: row.company?.slug || null,
    employeeId: row.employeeId || null,
    employeeName: row.employee?.fullName || null,
    employeeCode: row.employee?.employeeCode || null,
    active: row.active,
    projectIds: (row.projectAssignments || []).map((a: any) => a.contractId),
    projects: (row.projectAssignments || []).map((a: any) => ({
      id: a.contractId,
      label:
        a.contract?.workName ||
        a.contract?.clientName ||
        a.contract?.agreementNo ||
        "Project",
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const userInclude = {
  company: { select: { id: true, shortName: true, legalName: true, slug: true } },
  employee: { select: { id: true, fullName: true, employeeCode: true } },
  projectAssignments: {
    include: {
      contract: {
        select: { id: true, workName: true, clientName: true, agreementNo: true },
      },
    },
  },
} as const;

export async function listSuperAdminBook() {
  const [companies, users] = await Promise.all([
    prisma.company.findMany({
      where: { active: true },
      include: {
        sequence: true,
        _count: { select: { applicants: true, employees: true, contracts: true, users: true } },
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            workName: true,
            clientName: true,
            agreementNo: true,
            workStatus: true,
            contractType: true,
          },
          orderBy: { updatedAt: "desc" },
        },
        employees: {
          where: { status: "ACTIVE" },
          select: { id: true, fullName: true, employeeCode: true, mobile: true },
          orderBy: { fullName: "asc" },
          take: 500,
        },
      },
      orderBy: { shortName: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { not: Role.SUPER_ADMIN } },
      include: userInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  return {
    companies: companies.map((c) => ({
      id: c.id,
      slug: c.slug,
      shortName: c.shortName,
      legalName: c.legalName,
      prefix: c.sequence?.prefix || c.slug.toUpperCase(),
      applicants: c._count.applicants,
      employees: c._count.employees,
      contracts: c._count.contracts,
      users: c._count.users,
      projects: c.contracts.map((p) => ({
        id: p.id,
        label: p.workName || p.clientName || p.agreementNo || "Project",
        clientName: p.clientName,
        agreementNo: p.agreementNo,
        workStatus: p.workStatus,
        contractType: p.contractType,
      })),
      employeeOptions: c.employees.map((e) => ({
        id: e.id,
        label: `${e.fullName} (${e.employeeCode})`,
        mobile: e.mobile,
      })),
    })),
    users: users.map(mapUser),
  };
}

export async function saveOfficeUser(input: {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  companyId: string;
  employeeId?: string | null;
  projectIds?: string[];
  active?: boolean;
}) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").toLowerCase().trim();
  const role = String(input.role || "").trim();
  const companyId = String(input.companyId || "").trim();
  const projectIds = Array.from(new Set((input.projectIds || []).filter(Boolean)));

  if (!name) throw new Error("Please enter the person's name.");
  if (!email || !email.includes("@")) throw new Error("Please enter a valid email.");
  if (!isAssignableOfficeRole(role)) throw new Error("Please choose a valid office role.");
  if (!companyId) throw new Error("Please choose a company.");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found.");

  if (projectIds.length) {
    const ok = await prisma.contract.count({
      where: { companyId, deletedAt: null, id: { in: projectIds } },
    });
    if (ok !== projectIds.length) throw new Error("One or more selected projects are invalid.");
  }

  let employeeId: string | null = input.employeeId ? String(input.employeeId) : null;
  if (employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true },
    });
    if (!emp) throw new Error("Selected employee does not belong to this company.");
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail && existingEmail.id !== input.id) {
    throw new Error("This email is already used by another login.");
  }

  if (input.id) {
    const existing = await prisma.user.findUnique({ where: { id: input.id } });
    if (!existing || existing.role === Role.SUPER_ADMIN) throw new Error("User not found.");

    const data: any = {
      name,
      email,
      role: role as AssignableOfficeRole,
      companyId,
      employeeId,
      active: input.active !== false,
    };
    if (input.password && String(input.password).trim().length >= 6) {
      data.passwordHash = await bcrypt.hash(String(input.password).trim(), 10);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: input.id! }, data });
      await tx.userProjectAssignment.deleteMany({ where: { userId: input.id! } });
      if (projectIds.length) {
        await tx.userProjectAssignment.createMany({
          data: projectIds.map((contractId) => ({
            userId: input.id!,
            companyId,
            contractId,
          })),
        });
      }
    });

    const row = await prisma.user.findUnique({ where: { id: input.id }, include: userInclude });
    return mapUser(row);
  }

  const password = String(input.password || "").trim();
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as AssignableOfficeRole,
        companyId,
        employeeId,
        active: input.active !== false,
      },
    });
    if (projectIds.length) {
      await tx.userProjectAssignment.createMany({
        data: projectIds.map((contractId) => ({
          userId: user.id,
          companyId,
          contractId,
        })),
      });
    }
    return user;
  });

  const row = await prisma.user.findUnique({ where: { id: created.id }, include: userInclude });
  return mapUser(row);
}

export async function setOfficeUserActive(id: string, active: boolean) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role === Role.SUPER_ADMIN) throw new Error("User not found.");
  const row = await prisma.user.update({
    where: { id },
    data: { active },
    include: userInclude,
  });
  return mapUser(row);
}
