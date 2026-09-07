-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_STATUS_CHANGED', 'USER_EMAIL_CHANGED', 'USER_NAME_CHANGED', 'USER_PASSWORD_RESET', 'USER_ROLE_CHANGED', 'PROFILE_NAME_CHANGED', 'PROFILE_EMAIL_CHANGED', 'PROFILE_PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM ('USER', 'PROFILE');

-- CreateEnum
CREATE TYPE "UserSecurityEvent" AS ENUM ('ACCOUNT_CREATED', 'ACCOUNT_ENABLED', 'ACCOUNT_DISABLED', 'EMAIL_CHANGED_BY_ADMIN', 'EMAIL_CHANGED_BY_SELF', 'PASSWORD_RESET_BY_ADMIN', 'PASSWORD_CHANGED_BY_SELF', 'ROLE_CHANGED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED');

-- CreateEnum
CREATE TYPE "UserSecuritySource" AS ENUM ('ADMIN', 'SELF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserSecurityOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "resourceType" "AuditResourceType" NOT NULL,
    "resourceId" TEXT,
    "targetUserId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSecurityLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "targetUserId" TEXT,
    "event" "UserSecurityEvent" NOT NULL,
    "source" "UserSecuritySource" NOT NULL,
    "outcome" "UserSecurityOutcome" NOT NULL,
    "metadata" JSONB,
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "AuditLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UserSecurityLog_createdAt_idx" ON "UserSecurityLog"("createdAt");

-- CreateIndex
CREATE INDEX "UserSecurityLog_actorUserId_createdAt_idx" ON "UserSecurityLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSecurityLog_targetUserId_createdAt_idx" ON "UserSecurityLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSecurityLog_event_createdAt_idx" ON "UserSecurityLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "UserSecurityLog_outcome_createdAt_idx" ON "UserSecurityLog"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurityLog" ADD CONSTRAINT "UserSecurityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurityLog" ADD CONSTRAINT "UserSecurityLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
