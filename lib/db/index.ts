import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

/**
 * Tenant-scoped Prisma Client.
 * Automatically injects `companyId` into where clauses and create payloads
 * for all multi-tenant models.
 */
const tenantClients = new Map<string, ReturnType<typeof prisma.$extends>>();

export function getTenantPrisma(companyId: string) {
  if (!companyId) {
    throw new Error("Multi-tenancy violation: companyId is required to scope database queries.");
  }

  const cached = tenantClients.get(companyId);
  if (cached) return cached;

  const client = prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.where = { ...(args.where || {}), companyId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.where = { ...(args.where || {}), companyId };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.where = { ...(args.where || {}), companyId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.data = { ...(args.data as any), companyId };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.where = { ...(args.where || {}), companyId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if ("companyId" in (prisma as any)[model].fields) {
            args.where = { ...(args.where || {}), companyId };
          }
          return query(args);
        },
      },
    },
  });
  tenantClients.set(companyId, client);
  return client;
}
