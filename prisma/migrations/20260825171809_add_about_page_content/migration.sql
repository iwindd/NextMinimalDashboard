-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_OBJECTIVE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_OBJECTIVE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_OBJECTIVE_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_OBJECTIVE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_GOAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_GOAL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_GOAL_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'ABOUT_GOAL_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_TIMELINE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_TIMELINE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_TIMELINE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'NETWORK_PARTNER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NETWORK_PARTNER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'NETWORK_PARTNER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_ORIGIN_SAVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'PROJECT_OBJECTIVE';
ALTER TYPE "AuditResourceType" ADD VALUE 'PROJECT_GOAL';
ALTER TYPE "AuditResourceType" ADD VALUE 'PROJECT_TIMELINE';
ALTER TYPE "AuditResourceType" ADD VALUE 'NETWORK_PARTNER';
ALTER TYPE "AuditResourceType" ADD VALUE 'PROJECT_ORIGIN';

-- CreateTable
CREATE TABLE "ProjectObjective" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGoal" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTimelineEntry" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "caption" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPartner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageFileId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOriginSnapshot" (
    "id" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOriginSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectObjective_deletedAt_sortOrder_idx" ON "ProjectObjective"("deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectGoal_deletedAt_sortOrder_idx" ON "ProjectGoal"("deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectTimelineEntry_deletedAt_sortOrder_idx" ON "ProjectTimelineEntry"("deletedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPartner_imageFileId_key" ON "NetworkPartner"("imageFileId");

-- CreateIndex
CREATE INDEX "NetworkPartner_deletedAt_joinedAt_idx" ON "NetworkPartner"("deletedAt", "joinedAt");

-- CreateIndex
CREATE INDEX "ProjectOriginSnapshot_createdAt_idx" ON "ProjectOriginSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "ProjectObjective" ADD CONSTRAINT "ProjectObjective_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGoal" ADD CONSTRAINT "ProjectGoal_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelineEntry" ADD CONSTRAINT "ProjectTimelineEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPartner" ADD CONSTRAINT "NetworkPartner_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPartner" ADD CONSTRAINT "NetworkPartner_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOriginSnapshot" ADD CONSTRAINT "ProjectOriginSnapshot_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
