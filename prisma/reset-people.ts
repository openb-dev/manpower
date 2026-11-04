import { PrismaClient } from "@prisma/client";
import { clearPeopleData, seedDemoPeople } from "./demo-people.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("Removing existing applicants, employees, and related records...");
  await clearPeopleData(prisma);

  const companies = await prisma.company.findMany({
    include: { sequence: true },
    orderBy: { slug: "asc" },
  });

  for (const company of companies) {
    const prefix = company.sequence?.prefix || company.slug.toUpperCase().slice(0, 3);
    await seedDemoPeople(prisma, company.id, company.slug, prefix);
    console.log(`[OK] ${company.shortName}: 5 complete people, 2 employees, dummy documents`);
  }

  const applicants = await prisma.applicant.count();
  const employees = await prisma.employee.count();
  console.log(`Done. ${applicants} applicants and ${employees} employees remain.`);
}

main()
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
