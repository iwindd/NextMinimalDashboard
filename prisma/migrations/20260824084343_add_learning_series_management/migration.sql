-- CreateEnum
CREATE TYPE "LearningRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'SUPERSEDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_CATEGORY_CREATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'LEARNING';
ALTER TYPE "AuditResourceType" ADD VALUE 'LEARNING_CATEGORY';

-- CreateTable
CREATE TABLE "LearningSeries" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "publishedRevisionId" TEXT,
    "workingRevisionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSeriesRevision" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "LearningRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSeriesRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEpisode" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "episodeLabel" TEXT,
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "metadataVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningSeries_publishedRevisionId_key" ON "LearningSeries"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSeries_workingRevisionId_key" ON "LearningSeries"("workingRevisionId");

-- CreateIndex
CREATE INDEX "LearningSeries_authorId_updatedAt_idx" ON "LearningSeries"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningSeries_deletedAt_updatedAt_idx" ON "LearningSeries"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningSeries_archivedAt_updatedAt_idx" ON "LearningSeries"("archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningSeriesRevision_status_updatedAt_idx" ON "LearningSeriesRevision"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningSeriesRevision_categoryId_status_idx" ON "LearningSeriesRevision"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSeriesRevision_seriesId_version_key" ON "LearningSeriesRevision"("seriesId", "version");

-- CreateIndex
CREATE INDEX "LearningEpisode_revisionId_youtubeVideoId_idx" ON "LearningEpisode"("revisionId", "youtubeVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEpisode_revisionId_sortOrder_key" ON "LearningEpisode"("revisionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCategory_normalizedName_key" ON "LearningCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "LearningCategory_name_idx" ON "LearningCategory"("name");

-- AddForeignKey
ALTER TABLE "LearningSeries" ADD CONSTRAINT "LearningSeries_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeries" ADD CONSTRAINT "LearningSeries_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeries" ADD CONSTRAINT "LearningSeries_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "LearningSeriesRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeries" ADD CONSTRAINT "LearningSeries_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "LearningSeriesRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeriesRevision" ADD CONSTRAINT "LearningSeriesRevision_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "LearningSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeriesRevision" ADD CONSTRAINT "LearningSeriesRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LearningCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeriesRevision" ADD CONSTRAINT "LearningSeriesRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSeriesRevision" ADD CONSTRAINT "LearningSeriesRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEpisode" ADD CONSTRAINT "LearningEpisode_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "LearningSeriesRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCategory" ADD CONSTRAINT "LearningCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
