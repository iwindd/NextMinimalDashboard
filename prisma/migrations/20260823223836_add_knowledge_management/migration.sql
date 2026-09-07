-- CreateEnum
CREATE TYPE "KnowledgeRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('ARTICLE', 'GUIDE');

-- CreateEnum
CREATE TYPE "KnowledgeFilePurpose" AS ENUM ('COVER', 'BODY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_MEDIA_ATTACHED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_MEDIA_DETACHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'KNOWLEDGE';
ALTER TYPE "AuditResourceType" ADD VALUE 'KNOWLEDGE_CATEGORY';

-- AlterTable
ALTER TABLE "FileReference" ADD COLUMN     "knowledgeRevisionFileId" TEXT;

-- AlterTable
ALTER TABLE "Knowledge" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "publishedRevisionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workingRevisionId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeRevision" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "KnowledgeRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" "KnowledgeType" NOT NULL DEFAULT 'ARTICLE',
    "studyTimeMinutes" INTEGER,
    "authorPublisher" JSONB,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRevisionFile" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "purpose" "KnowledgeFilePurpose" NOT NULL,

    CONSTRAINT "KnowledgeRevisionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeViewSession" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeViewSession_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy Knowledge rows into the versioned publishing model before
-- removing the old flat-content columns. Existing rows represented published
-- content, so each becomes a published v1 revision.
INSERT INTO "KnowledgeCategory" ("id", "name", "normalizedName", "updatedAt")
SELECT
    (
      substr(md5('knowledge-category:' || lower(trim("category"))), 1, 8) || '-' ||
      substr(md5('knowledge-category:' || lower(trim("category"))), 9, 4) || '-' ||
      substr(md5('knowledge-category:' || lower(trim("category"))), 13, 4) || '-' ||
      substr(md5('knowledge-category:' || lower(trim("category"))), 17, 4) || '-' ||
      substr(md5('knowledge-category:' || lower(trim("category"))), 21, 12)
    )::uuid::text,
    min(trim("category")),
    lower(trim("category")),
    CURRENT_TIMESTAMP
FROM "Knowledge"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY lower(trim("category"));

INSERT INTO "FileAsset" ("id", "storage", "objectKey", "originalName", "mimeType", "byteSize")
SELECT
    (
      substr(md5('legacy-knowledge-image:' || k."imageUrl"), 1, 8) || '-' ||
      substr(md5('legacy-knowledge-image:' || k."imageUrl"), 9, 4) || '-' ||
      substr(md5('legacy-knowledge-image:' || k."imageUrl"), 13, 4) || '-' ||
      substr(md5('legacy-knowledge-image:' || k."imageUrl"), 17, 4) || '-' ||
      substr(md5('legacy-knowledge-image:' || k."imageUrl"), 21, 12)
    )::uuid::text,
    'PUBLIC',
    k."imageUrl",
    k."imageUrl",
    CASE
      WHEN lower(k."imageUrl") LIKE '%.png' THEN 'image/png'
      WHEN lower(k."imageUrl") LIKE '%.webp' THEN 'image/webp'
      ELSE 'image/jpeg'
    END,
    0
FROM "Knowledge" k
WHERE k."imageUrl" IS NOT NULL
  AND k."imageUrl" LIKE '/%'
  AND NOT EXISTS (
    SELECT 1 FROM "FileAsset" f WHERE f."objectKey" = k."imageUrl"
  )
GROUP BY k."imageUrl";

INSERT INTO "KnowledgeRevision" (
    "id", "knowledgeId", "version", "status", "title", "excerpt", "bodyHtml",
    "categoryId", "type", "studyTimeMinutes", "authorPublisher", "publishedAt", "createdAt", "updatedAt"
)
SELECT
    (
      substr(md5('knowledge-revision:' || k."id"), 1, 8) || '-' ||
      substr(md5('knowledge-revision:' || k."id"), 9, 4) || '-' ||
      substr(md5('knowledge-revision:' || k."id"), 13, 4) || '-' ||
      substr(md5('knowledge-revision:' || k."id"), 17, 4) || '-' ||
      substr(md5('knowledge-revision:' || k."id"), 21, 12)
    )::uuid::text,
    k."id",
    1,
    'PUBLISHED',
    k."title",
    k."description",
    '<p>' ||
      replace(replace(replace(coalesce(k."description", ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
      CASE WHEN k."imageUrl" IS NOT NULL AND k."imageUrl" <> ''
        THEN '</p><p><img src="' ||
          replace(replace(replace(replace(k."imageUrl", '&', '&amp;'), '"', '&quot;'), '<', '&lt;'), '>', '&gt;') ||
          '" alt="" /></p>'
        ELSE '</p>'
      END,
    (
      SELECT c."id" FROM "KnowledgeCategory" c
      WHERE c."normalizedName" = lower(trim(k."category"))
    ),
    (CASE WHEN trim(coalesce(k."type", '')) IN ('คู่มือ', 'GUIDE') THEN 'GUIDE' ELSE 'ARTICLE' END)::"KnowledgeType",
    CASE WHEN k."readTime" ~ '[0-9]+'
      THEN substring(k."readTime" FROM '[0-9]+')::integer
      ELSE NULL
    END,
    NULL,
    CASE
      WHEN k."publishedDate" ~ '^[0-9]{1,2} [^ ]+ [0-9]{4}$' THEN make_date(
        split_part(k."publishedDate", ' ', 3)::integer - 543,
        CASE split_part(k."publishedDate", ' ', 2)
          WHEN 'ม.ค.' THEN 1 WHEN 'ก.พ.' THEN 2 WHEN 'มี.ค.' THEN 3
          WHEN 'เม.ย.' THEN 4 WHEN 'พ.ค.' THEN 5 WHEN 'มิ.ย.' THEN 6
          WHEN 'ก.ค.' THEN 7 WHEN 'ส.ค.' THEN 8 WHEN 'ก.ย.' THEN 9
          WHEN 'ต.ค.' THEN 10 WHEN 'พ.ย.' THEN 11 WHEN 'ธ.ค.' THEN 12
        END,
        split_part(k."publishedDate", ' ', 1)::integer
      )
      ELSE k."createdAt"::date
    END,
    k."createdAt",
    k."createdAt"
FROM "Knowledge" k;

INSERT INTO "KnowledgeRevisionFile" ("id", "revisionId", "purpose")
SELECT
    (
      substr(md5('knowledge-cover:' || k."id"), 1, 8) || '-' ||
      substr(md5('knowledge-cover:' || k."id"), 9, 4) || '-' ||
      substr(md5('knowledge-cover:' || k."id"), 13, 4) || '-' ||
      substr(md5('knowledge-cover:' || k."id"), 17, 4) || '-' ||
      substr(md5('knowledge-cover:' || k."id"), 21, 12)
    )::uuid::text,
    r."id",
    'COVER'
FROM "Knowledge" k
JOIN "KnowledgeRevision" r ON r."knowledgeId" = k."id"
JOIN "FileAsset" f ON f."objectKey" = k."imageUrl"
WHERE k."imageUrl" LIKE '/%';

INSERT INTO "FileReference" ("id", "fileId", "access", "knowledgeRevisionFileId")
SELECT
    (
      substr(md5('knowledge-cover-reference:' || k."id"), 1, 8) || '-' ||
      substr(md5('knowledge-cover-reference:' || k."id"), 9, 4) || '-' ||
      substr(md5('knowledge-cover-reference:' || k."id"), 13, 4) || '-' ||
      substr(md5('knowledge-cover-reference:' || k."id"), 17, 4) || '-' ||
      substr(md5('knowledge-cover-reference:' || k."id"), 21, 12)
    )::uuid::text,
    f."id",
    'PUBLIC',
    rf."id"
FROM "Knowledge" k
JOIN "KnowledgeRevision" r ON r."knowledgeId" = k."id"
JOIN "KnowledgeRevisionFile" rf ON rf."revisionId" = r."id" AND rf."purpose" = 'COVER'
JOIN "FileAsset" f ON f."objectKey" = k."imageUrl";

UPDATE "Knowledge" k
SET
    "publishedRevisionId" = r."id",
    "updatedAt" = k."createdAt"
FROM "KnowledgeRevision" r
WHERE r."knowledgeId" = k."id";

ALTER TABLE "Knowledge" DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "publishedDate",
DROP COLUMN "readTime",
DROP COLUMN "title",
DROP COLUMN "type";

ALTER TABLE "Knowledge" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "KnowledgeRevision_status_updatedAt_idx" ON "KnowledgeRevision"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeRevision_categoryId_status_idx" ON "KnowledgeRevision"("categoryId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeRevision_type_status_idx" ON "KnowledgeRevision"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRevision_knowledgeId_version_key" ON "KnowledgeRevision"("knowledgeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCategory_normalizedName_key" ON "KnowledgeCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "KnowledgeCategory_name_idx" ON "KnowledgeCategory"("name");

-- CreateIndex
CREATE INDEX "KnowledgeRevisionFile_revisionId_purpose_idx" ON "KnowledgeRevisionFile"("revisionId", "purpose");

-- CreateIndex
CREATE INDEX "KnowledgeViewSession_knowledgeId_createdAt_idx" ON "KnowledgeViewSession"("knowledgeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeViewSession_knowledgeId_sessionHash_key" ON "KnowledgeViewSession"("knowledgeId", "sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "FileReference_knowledgeRevisionFileId_key" ON "FileReference"("knowledgeRevisionFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Knowledge_publishedRevisionId_key" ON "Knowledge"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Knowledge_workingRevisionId_key" ON "Knowledge"("workingRevisionId");

-- CreateIndex
CREATE INDEX "Knowledge_authorId_updatedAt_idx" ON "Knowledge"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "Knowledge_deletedAt_updatedAt_idx" ON "Knowledge"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Knowledge_archivedAt_updatedAt_idx" ON "Knowledge"("archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Knowledge_viewCount_idx" ON "Knowledge"("viewCount");

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "KnowledgeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "KnowledgeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevision" ADD CONSTRAINT "KnowledgeRevision_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "Knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevision" ADD CONSTRAINT "KnowledgeRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevision" ADD CONSTRAINT "KnowledgeRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevision" ADD CONSTRAINT "KnowledgeRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevisionFile" ADD CONSTRAINT "KnowledgeRevisionFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "KnowledgeRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeViewSession" ADD CONSTRAINT "KnowledgeViewSession_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "Knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_knowledgeRevisionFileId_fkey" FOREIGN KEY ("knowledgeRevisionFileId") REFERENCES "KnowledgeRevisionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
