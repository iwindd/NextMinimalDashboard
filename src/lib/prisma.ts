import { PrismaClient } from '@prisma/client';
import { auditExtension } from './prisma-extensions/audit';
import { datatableExtension } from "./prisma-extensions/datatable";
import { userSecurityLogExtension } from './prisma-extensions/user-security-log';

function createPrisma() {
  return new PrismaClient()
    .$extends(datatableExtension)
    .$extends(auditExtension)
    .$extends(userSecurityLogExtension);
}

const globalForPrisma = global as unknown as {
  prisma: ReturnType<typeof createPrisma>;
};

export const prisma =
  globalForPrisma.prisma ||
  createPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
