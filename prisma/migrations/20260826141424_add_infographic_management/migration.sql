-- CreateEnum
CREATE TYPE "InfographicRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InfographicFilePurpose" AS ENUM ('COVER', 'ASSET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_MEDIA_ATTACHED';
ALTER TYPE "AuditAction" ADD VALUE 'INFOGRAPHIC_MEDIA_DETACHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'INFOGRAPHIC';
ALTER TYPE "AuditResourceType" ADD VALUE 'INFOGRAPHIC_CATEGORY';

-- AlterTable
ALTER TABLE "FileReference" ADD COLUMN     "infographicRevisionFileId" TEXT;

-- CreateTable
CREATE TABLE "Infographic" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "publishedRevisionId" TEXT,
    "workingRevisionId" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Infographic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfographicRevision" (
    "id" TEXT NOT NULL,
    "infographicId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "InfographicRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "sizeLabel" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfographicRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfographicCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfographicCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfographicRevisionFile" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "purpose" "InfographicFilePurpose" NOT NULL,

    CONSTRAINT "InfographicRevisionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfographicDownloadSession" (
    "id" TEXT NOT NULL,
    "infographicId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfographicDownloadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Infographic_publishedRevisionId_key" ON "Infographic"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Infographic_workingRevisionId_key" ON "Infographic"("workingRevisionId");

-- CreateIndex
CREATE INDEX "Infographic_authorId_updatedAt_idx" ON "Infographic"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "Infographic_deletedAt_updatedAt_idx" ON "Infographic"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Infographic_archivedAt_updatedAt_idx" ON "Infographic"("archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Infographic_downloadCount_idx" ON "Infographic"("downloadCount");

-- CreateIndex
CREATE INDEX "InfographicRevision_infographicId_status_idx" ON "InfographicRevision"("infographicId", "status");

-- CreateIndex
CREATE INDEX "InfographicRevision_status_updatedAt_idx" ON "InfographicRevision"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "InfographicRevision_categoryId_status_idx" ON "InfographicRevision"("categoryId", "status");

-- CreateIndex
CREATE INDEX "InfographicRevision_status_publishedAt_idx" ON "InfographicRevision"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InfographicRevision_infographicId_version_key" ON "InfographicRevision"("infographicId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "InfographicCategory_normalizedName_key" ON "InfographicCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "InfographicCategory_name_idx" ON "InfographicCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InfographicRevisionFile_revisionId_purpose_key" ON "InfographicRevisionFile"("revisionId", "purpose");

-- CreateIndex
CREATE INDEX "InfographicDownloadSession_infographicId_createdAt_idx" ON "InfographicDownloadSession"("infographicId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InfographicDownloadSession_infographicId_sessionHash_key" ON "InfographicDownloadSession"("infographicId", "sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "FileReference_infographicRevisionFileId_key" ON "FileReference"("infographicRevisionFileId");

-- AddForeignKey
ALTER TABLE "Infographic" ADD CONSTRAINT "Infographic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infographic" ADD CONSTRAINT "Infographic_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infographic" ADD CONSTRAINT "Infographic_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "InfographicRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infographic" ADD CONSTRAINT "Infographic_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "InfographicRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicRevision" ADD CONSTRAINT "InfographicRevision_infographicId_fkey" FOREIGN KEY ("infographicId") REFERENCES "Infographic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicRevision" ADD CONSTRAINT "InfographicRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InfographicCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicRevision" ADD CONSTRAINT "InfographicRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicRevision" ADD CONSTRAINT "InfographicRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicCategory" ADD CONSTRAINT "InfographicCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicRevisionFile" ADD CONSTRAINT "InfographicRevisionFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "InfographicRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfographicDownloadSession" ADD CONSTRAINT "InfographicDownloadSession_infographicId_fkey" FOREIGN KEY ("infographicId") REFERENCES "Infographic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_infographicRevisionFileId_fkey" FOREIGN KEY ("infographicRevisionFileId") REFERENCES "InfographicRevisionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
