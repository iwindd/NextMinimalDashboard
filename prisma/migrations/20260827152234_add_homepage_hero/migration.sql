-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'HOME_HERO_SAVED';

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'HOME_HERO';

-- CreateTable
CREATE TABLE "HomeHeroSnapshot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "imageFileId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeHeroSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeHeroSnapshot_createdAt_idx" ON "HomeHeroSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "HomeHeroSnapshot" ADD CONSTRAINT "HomeHeroSnapshot_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeHeroSnapshot" ADD CONSTRAINT "HomeHeroSnapshot_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
