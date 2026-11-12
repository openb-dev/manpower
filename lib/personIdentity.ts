import { prisma } from "./db/index.ts";
import { decryptText, encryptText, formatAadhaar, getAadhaarLast4, hashAadhaar } from "./crypto/index.ts";

type AadhaarSource = {
  person?: { aadhaarEncrypted?: string | null; aadhaarLast4?: string | null } | null;
  aadhaarEncrypted?: string | null;
  aadhaarLast4?: string | null;
};

export function aadhaarDisplayOf(row: AadhaarSource) {
  return formatAadhaar(
    decryptText(row.person?.aadhaarEncrypted || row.aadhaarEncrypted) ||
      row.person?.aadhaarLast4 ||
      row.aadhaarLast4,
  );
}

export async function findOrCreatePerson(companyId: string, aadhaarNumber: string) {
  const aadhaarHash = hashAadhaar(aadhaarNumber);
  const existing = await prisma.person.findUnique({
    where: { companyId_aadhaarHash: { companyId, aadhaarHash } },
  });
  if (existing) {
    if (!existing.aadhaarEncrypted) {
      return prisma.person.update({
        where: { id: existing.id },
        data: {
          aadhaarEncrypted: encryptText(aadhaarNumber),
          aadhaarLast4: getAadhaarLast4(aadhaarNumber),
        },
      });
    }
    return existing;
  }
  try {
    return await prisma.person.create({
      data: {
        companyId,
        aadhaarHash,
        aadhaarEncrypted: encryptText(aadhaarNumber),
        aadhaarLast4: getAadhaarLast4(aadhaarNumber),
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return prisma.person.findUniqueOrThrow({
        where: { companyId_aadhaarHash: { companyId, aadhaarHash } },
      });
    }
    throw error;
  }
}

export async function ensurePeople(companyId: string) {
  const pending = await prisma.applicant.findMany({
    where: { companyId, personId: null },
    select: { id: true, aadhaarHash: true, aadhaarEncrypted: true, aadhaarLast4: true },
  });
  const byHash = new Map<string, typeof pending>();
  for (const row of pending) {
    const hash = String(row.aadhaarHash || "").trim();
    if (!hash) continue;
    const list = byHash.get(hash) || [];
    list.push(row);
    byHash.set(hash, list);
  }

  for (const [aadhaarHash, rows] of byHash) {
    const source = rows.find((row) => row.aadhaarEncrypted) || rows[0];
    let person = await prisma.person.findUnique({
      where: { companyId_aadhaarHash: { companyId, aadhaarHash } },
    });
    if (!person) {
      person = await prisma.person.create({
        data: {
          companyId,
          aadhaarHash,
          aadhaarEncrypted: source.aadhaarEncrypted || "",
          aadhaarLast4: source.aadhaarLast4,
        },
      });
    }
    await prisma.applicant.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: {
        personId: person.id,
        aadhaarEncrypted: null,
        aadhaarHash: null,
        aadhaarLast4: null,
      },
    });
  }

  const employees = await prisma.employee.findMany({
    where: { companyId, personId: null },
    select: {
      id: true,
      aadhaarHash: true,
      aadhaarEncrypted: true,
      aadhaarLast4: true,
      applicant: { select: { personId: true } },
    },
  });

  for (const employee of employees) {
    let personId = employee.applicant?.personId || null;
    if (!personId && employee.aadhaarHash) {
      let person = await prisma.person.findUnique({
        where: { companyId_aadhaarHash: { companyId, aadhaarHash: employee.aadhaarHash } },
      });
      if (!person) {
        person = await prisma.person.create({
          data: {
            companyId,
            aadhaarHash: employee.aadhaarHash,
            aadhaarEncrypted: employee.aadhaarEncrypted || "",
            aadhaarLast4: employee.aadhaarLast4,
          },
        });
      }
      personId = person.id;
    }
    if (!personId) continue;
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        personId,
        aadhaarEncrypted: null,
        aadhaarHash: null,
        aadhaarLast4: null,
      },
    });
  }
}
