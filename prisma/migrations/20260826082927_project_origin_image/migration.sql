-- AlterTable
ALTER TABLE "ProjectOriginSnapshot" ADD COLUMN     "imageFileId" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectOriginSnapshot" ADD CONSTRAINT "ProjectOriginSnapshot_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
