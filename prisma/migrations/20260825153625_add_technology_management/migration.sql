/*
  Warnings:

  - You are about to drop the column `badge` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Technology` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Technology` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[technologyRevisionFileId]` on the table `FileReference` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publishedRevisionId]` on the table `Technology` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workingRevisionId]` on the table `Technology` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TechnologyRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TechnologyReadiness" AS ENUM ('READY', 'NOT_READY');

-- CreateEnum
CREATE TYPE "TechnologyFilePurpose" AS ENUM ('COVER', 'BODY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_CERTIFICATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_MEDIA_ATTACHED';
ALTER TYPE "AuditAction" ADD VALUE 'TECHNOLOGY_MEDIA_DETACHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'TECHNOLOGY';
ALTER TYPE "AuditResourceType" ADD VALUE 'TECHNOLOGY_CATEGORY';
ALTER TYPE "AuditResourceType" ADD VALUE 'TECHNOLOGY_CERTIFICATION';

-- AlterTable
ALTER TABLE "FileReference" ADD COLUMN     "technologyRevisionFileId" TEXT;

-- AlterTable
ALTER TABLE "Technology" DROP COLUMN "badge",
DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "region",
DROP COLUMN "status",
DROP COLUMN "title",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "publishedRevisionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workingRevisionId" TEXT;

-- CreateTable
CREATE TABLE "TechnologyRevision" (
    "id" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TechnologyRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "categoryId" TEXT,
    "readiness" "TechnologyReadiness",
    "sponsors" JSONB,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyCertification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyRevisionCertification" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,

    CONSTRAINT "TechnologyRevisionCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyTargetArea" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "provinceCode" TEXT,
    "districtCode" TEXT,
    "subDistrictCode" TEXT,
    "pathKey" TEXT NOT NULL,

    CONSTRAINT "TechnologyTargetArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyRevisionLocation" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "TechnologyRevisionLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyRevisionFile" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "purpose" "TechnologyFilePurpose" NOT NULL,

    CONSTRAINT "TechnologyRevisionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyViewSession" (
    "id" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnologyViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnologyRevision_status_updatedAt_idx" ON "TechnologyRevision"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TechnologyRevision_categoryId_status_idx" ON "TechnologyRevision"("categoryId", "status");

-- CreateIndex
CREATE INDEX "TechnologyRevision_readiness_status_idx" ON "TechnologyRevision"("readiness", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyRevision_technologyId_version_key" ON "TechnologyRevision"("technologyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyCategory_normalizedName_key" ON "TechnologyCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "TechnologyCategory_name_idx" ON "TechnologyCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyCertification_normalizedName_key" ON "TechnologyCertification"("normalizedName");

-- CreateIndex
CREATE INDEX "TechnologyCertification_name_idx" ON "TechnologyCertification"("name");

-- CreateIndex
CREATE INDEX "TechnologyRevisionCertification_certificationId_idx" ON "TechnologyRevisionCertification"("certificationId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyRevisionCertification_revisionId_certificationId_key" ON "TechnologyRevisionCertification"("revisionId", "certificationId");

-- CreateIndex
CREATE INDEX "TechnologyTargetArea_regionCode_provinceCode_districtCode_s_idx" ON "TechnologyTargetArea"("regionCode", "provinceCode", "districtCode", "subDistrictCode");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyTargetArea_revisionId_pathKey_key" ON "TechnologyTargetArea"("revisionId", "pathKey");

-- CreateIndex
CREATE INDEX "TechnologyRevisionLocation_locationId_idx" ON "TechnologyRevisionLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyRevisionLocation_revisionId_locationId_key" ON "TechnologyRevisionLocation"("revisionId", "locationId");

-- CreateIndex
CREATE INDEX "TechnologyRevisionFile_revisionId_purpose_idx" ON "TechnologyRevisionFile"("revisionId", "purpose");

-- CreateIndex
CREATE INDEX "TechnologyViewSession_technologyId_createdAt_idx" ON "TechnologyViewSession"("technologyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyViewSession_technologyId_sessionHash_key" ON "TechnologyViewSession"("technologyId", "sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "FileReference_technologyRevisionFileId_key" ON "FileReference"("technologyRevisionFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_publishedRevisionId_key" ON "Technology"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Technology_workingRevisionId_key" ON "Technology"("workingRevisionId");

-- CreateIndex
CREATE INDEX "Technology_authorId_updatedAt_idx" ON "Technology"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "Technology_deletedAt_updatedAt_idx" ON "Technology"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Technology_archivedAt_updatedAt_idx" ON "Technology"("archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Technology_viewCount_idx" ON "Technology"("viewCount");

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "TechnologyRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "TechnologyRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevision" ADD CONSTRAINT "TechnologyRevision_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevision" ADD CONSTRAINT "TechnologyRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TechnologyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevision" ADD CONSTRAINT "TechnologyRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevision" ADD CONSTRAINT "TechnologyRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyCategory" ADD CONSTRAINT "TechnologyCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyCertification" ADD CONSTRAINT "TechnologyCertification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevisionCertification" ADD CONSTRAINT "TechnologyRevisionCertification_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TechnologyRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevisionCertification" ADD CONSTRAINT "TechnologyRevisionCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "TechnologyCertification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyTargetArea" ADD CONSTRAINT "TechnologyTargetArea_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TechnologyRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyTargetArea" ADD CONSTRAINT "TechnologyTargetArea_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "Region"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyTargetArea" ADD CONSTRAINT "TechnologyTargetArea_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyTargetArea" ADD CONSTRAINT "TechnologyTargetArea_districtCode_fkey" FOREIGN KEY ("districtCode") REFERENCES "District"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyTargetArea" ADD CONSTRAINT "TechnologyTargetArea_subDistrictCode_fkey" FOREIGN KEY ("subDistrictCode") REFERENCES "SubDistrict"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevisionLocation" ADD CONSTRAINT "TechnologyRevisionLocation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TechnologyRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevisionLocation" ADD CONSTRAINT "TechnologyRevisionLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyRevisionFile" ADD CONSTRAINT "TechnologyRevisionFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TechnologyRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyViewSession" ADD CONSTRAINT "TechnologyViewSession_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_technologyRevisionFileId_fkey" FOREIGN KEY ("technologyRevisionFileId") REFERENCES "TechnologyRevisionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
