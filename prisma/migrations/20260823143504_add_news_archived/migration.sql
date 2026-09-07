-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'NEWS_ARCHIVED';

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NewsRevision"
ALTER COLUMN "source" TYPE JSONB
USING CASE
  WHEN "source" IS NULL OR btrim("source") = '' THEN NULL
  ELSE jsonb_build_array(jsonb_build_object('url', '', 'title', "source"))
END;

-- CreateIndex
CREATE INDEX "News_archivedAt_updatedAt_idx" ON "News"("archivedAt", "updatedAt");
