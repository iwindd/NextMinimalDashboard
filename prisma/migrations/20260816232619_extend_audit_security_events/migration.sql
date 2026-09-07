-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserSecurityEvent" ADD VALUE 'NAME_CHANGED_BY_ADMIN';
ALTER TYPE "UserSecurityEvent" ADD VALUE 'NAME_CHANGED_BY_SELF';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "metadata" JSONB;
