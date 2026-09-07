/*
  Warnings:

  - A unique constraint covering the columns `[publishedRevisionId]` on the table `News` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workingRevisionId]` on the table `News` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NewsRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "NewsFilePurpose" AS ENUM ('COVER', 'BODY');

-- CreateEnum
CREATE TYPE "FileStorage" AS ENUM ('PUBLIC', 'LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "FileAccess" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'NEWS_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_CHANGES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_MEDIA_UPLOADED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'NEWS';
ALTER TYPE "AuditResourceType" ADD VALUE 'NEWS_CATEGORY';
ALTER TYPE "AuditResourceType" ADD VALUE 'NEWS_MEDIA';

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "publishedRevisionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workingRevisionId" TEXT;

-- CreateTable
CREATE TABLE "NewsRevision" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "NewsRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "categoryId" TEXT,
    "readTimeMinutes" INTEGER,
    "source" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsRevisionFile" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "purpose" "NewsFilePurpose" NOT NULL,

    CONSTRAINT "NewsRevisionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsViewSession" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "storage" "FileStorage" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileReference" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "access" "FileAccess" NOT NULL DEFAULT 'PRIVATE',
    "newsRevisionFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileReference_pkey" PRIMARY KEY ("id")
);

-- Migrate the legacy News rows before removing their old columns. The old
-- records represented published content, so each becomes a published v1
-- revision and keeps its image when the image is a local public path.
INSERT INTO "NewsCategory" ("id", "name", "normalizedName", "updatedAt")
SELECT
    (
      substr(md5('news-category:' || lower(trim("category"))), 1, 8) || '-' ||
      substr(md5('news-category:' || lower(trim("category"))), 9, 4) || '-' ||
      substr(md5('news-category:' || lower(trim("category"))), 13, 4) || '-' ||
      substr(md5('news-category:' || lower(trim("category"))), 17, 4) || '-' ||
      substr(md5('news-category:' || lower(trim("category"))), 21, 12)
    )::uuid::text,
    min(trim("category")),
    lower(trim("category")),
    CURRENT_TIMESTAMP
FROM "News"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY lower(trim("category"));

INSERT INTO "FileAsset" ("id", "storage", "objectKey", "originalName", "mimeType", "byteSize")
SELECT
    (
      substr(md5('legacy-news-image:' || "imageUrl"), 1, 8) || '-' ||
      substr(md5('legacy-news-image:' || "imageUrl"), 9, 4) || '-' ||
      substr(md5('legacy-news-image:' || "imageUrl"), 13, 4) || '-' ||
      substr(md5('legacy-news-image:' || "imageUrl"), 17, 4) || '-' ||
      substr(md5('legacy-news-image:' || "imageUrl"), 21, 12)
    )::uuid::text,
    'PUBLIC',
    "imageUrl",
    "imageUrl",
    CASE
      WHEN lower("imageUrl") LIKE '%.png' THEN 'image/png'
      WHEN lower("imageUrl") LIKE '%.webp' THEN 'image/webp'
      ELSE 'image/jpeg'
    END,
    0
FROM "News"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" LIKE '/%'
GROUP BY "imageUrl";

INSERT INTO "NewsRevision" (
    "id", "newsId", "version", "status", "title", "excerpt", "bodyHtml",
    "categoryId", "readTimeMinutes", "publishedAt", "createdAt", "updatedAt"
)
SELECT
    (
      substr(md5('news-revision:' || n."id"), 1, 8) || '-' ||
      substr(md5('news-revision:' || n."id"), 9, 4) || '-' ||
      substr(md5('news-revision:' || n."id"), 13, 4) || '-' ||
      substr(md5('news-revision:' || n."id"), 17, 4) || '-' ||
      substr(md5('news-revision:' || n."id"), 21, 12)
    )::uuid::text,
    n."id",
    1,
    'PUBLISHED',
    n."title",
    n."description",
    '<p>' ||
      replace(replace(replace(coalesce(n."description", ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
      CASE WHEN n."imageUrl" IS NOT NULL AND n."imageUrl" <> ''
        THEN '</p><p><img src="' ||
          replace(replace(replace(replace(n."imageUrl", '&', '&amp;'), '"', '&quot;'), '<', '&lt;'), '>', '&gt;') ||
          '" alt="" /></p>'
        ELSE '</p>'
      END,
    (
      SELECT c."id" FROM "NewsCategory" c
      WHERE c."normalizedName" = lower(trim(n."category"))
    ),
    CASE WHEN n."readTime" ~ '[0-9]+'
      THEN substring(n."readTime" FROM '[0-9]+')::integer
      ELSE NULL
    END,
    CASE
      WHEN n."publishedDate" ~ '^[0-9]{1,2} [^ ]+ [0-9]{4}$' THEN make_date(
        split_part(n."publishedDate", ' ', 3)::integer - 543,
        CASE split_part(n."publishedDate", ' ', 2)
          WHEN 'ม.ค.' THEN 1 WHEN 'ก.พ.' THEN 2 WHEN 'มี.ค.' THEN 3
          WHEN 'เม.ย.' THEN 4 WHEN 'พ.ค.' THEN 5 WHEN 'มิ.ย.' THEN 6
          WHEN 'ก.ค.' THEN 7 WHEN 'ส.ค.' THEN 8 WHEN 'ก.ย.' THEN 9
          WHEN 'ต.ค.' THEN 10 WHEN 'พ.ย.' THEN 11 WHEN 'ธ.ค.' THEN 12
        END,
        split_part(n."publishedDate", ' ', 1)::integer
      )
      ELSE n."createdAt"::date
    END,
    n."createdAt",
    n."createdAt"
FROM "News" n;

INSERT INTO "NewsRevisionFile" ("id", "revisionId", "purpose")
SELECT
    (
      substr(md5('news-cover:' || n."id"), 1, 8) || '-' ||
      substr(md5('news-cover:' || n."id"), 9, 4) || '-' ||
      substr(md5('news-cover:' || n."id"), 13, 4) || '-' ||
      substr(md5('news-cover:' || n."id"), 17, 4) || '-' ||
      substr(md5('news-cover:' || n."id"), 21, 12)
    )::uuid::text,
    r."id",
    'COVER'
FROM "News" n
JOIN "NewsRevision" r ON r."newsId" = n."id"
JOIN "FileAsset" f ON f."objectKey" = n."imageUrl"
WHERE n."imageUrl" LIKE '/%';

INSERT INTO "FileReference" ("id", "fileId", "access", "newsRevisionFileId")
SELECT
    (
      substr(md5('news-cover-reference:' || n."id"), 1, 8) || '-' ||
      substr(md5('news-cover-reference:' || n."id"), 9, 4) || '-' ||
      substr(md5('news-cover-reference:' || n."id"), 13, 4) || '-' ||
      substr(md5('news-cover-reference:' || n."id"), 17, 4) || '-' ||
      substr(md5('news-cover-reference:' || n."id"), 21, 12)
    )::uuid::text,
    f."id",
    'PUBLIC',
    rf."id"
FROM "News" n
JOIN "NewsRevision" r ON r."newsId" = n."id"
JOIN "NewsRevisionFile" rf ON rf."revisionId" = r."id" AND rf."purpose" = 'COVER'
JOIN "FileAsset" f ON f."objectKey" = n."imageUrl";

UPDATE "News" n
SET
    "publishedRevisionId" = r."id",
    "updatedAt" = n."createdAt"
FROM "NewsRevision" r
WHERE r."newsId" = n."id";

ALTER TABLE "News" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "News" DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "publishedDate",
DROP COLUMN "readTime",
DROP COLUMN "title";

-- CreateIndex
CREATE INDEX "NewsRevision_status_updatedAt_idx" ON "NewsRevision"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "NewsRevision_categoryId_status_idx" ON "NewsRevision"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsRevision_newsId_version_key" ON "NewsRevision"("newsId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_normalizedName_key" ON "NewsCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "NewsCategory_name_idx" ON "NewsCategory"("name");

-- CreateIndex
CREATE INDEX "NewsRevisionFile_revisionId_purpose_idx" ON "NewsRevisionFile"("revisionId", "purpose");

-- CreateIndex
CREATE INDEX "NewsViewSession_newsId_createdAt_idx" ON "NewsViewSession"("newsId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsViewSession_newsId_sessionHash_key" ON "NewsViewSession"("newsId", "sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_objectKey_key" ON "FileAsset"("objectKey");

-- CreateIndex
CREATE INDEX "FileAsset_createdById_createdAt_idx" ON "FileAsset"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileReference_newsRevisionFileId_key" ON "FileReference"("newsRevisionFileId");

-- CreateIndex
CREATE INDEX "FileReference_fileId_access_idx" ON "FileReference"("fileId", "access");

-- CreateIndex
CREATE UNIQUE INDEX "News_publishedRevisionId_key" ON "News"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "News_workingRevisionId_key" ON "News"("workingRevisionId");

-- CreateIndex
CREATE INDEX "News_authorId_updatedAt_idx" ON "News"("authorId", "updatedAt");

-- CreateIndex
CREATE INDEX "News_deletedAt_updatedAt_idx" ON "News"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "News_viewCount_idx" ON "News"("viewCount");

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "NewsRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_workingRevisionId_fkey" FOREIGN KEY ("workingRevisionId") REFERENCES "NewsRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRevision" ADD CONSTRAINT "NewsRevision_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRevision" ADD CONSTRAINT "NewsRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRevision" ADD CONSTRAINT "NewsRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRevision" ADD CONSTRAINT "NewsRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsCategory" ADD CONSTRAINT "NewsCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsRevisionFile" ADD CONSTRAINT "NewsRevisionFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NewsRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsViewSession" ADD CONSTRAINT "NewsViewSession_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_newsRevisionFileId_fkey" FOREIGN KEY ("newsRevisionFileId") REFERENCES "NewsRevisionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
