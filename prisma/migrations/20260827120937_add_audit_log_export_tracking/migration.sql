-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AUDIT_LOG_EXPORTED';

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'AUDIT_LOG';

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_createdAt_idx" ON "AuditLog"("resourceType", "createdAt");
