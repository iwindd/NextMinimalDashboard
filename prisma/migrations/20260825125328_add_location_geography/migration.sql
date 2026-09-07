/*
  Warnings:

  - You are about to drop the column `name` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `tag` on the `Location` table. All the data in the column will be lost.
  - Added the required column `title` to the `Location` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Location` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LOCATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOCATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LOCATION_VISIBILITY_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LOCATION_DELETED';

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'LOCATION';

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "name",
DROP COLUMN "region",
DROP COLUMN "tag",
ADD COLUMN     "address1" TEXT,
ADD COLUMN     "address2" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "districtCode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "subDistrictCode" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Region" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Province" (
    "code" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "District" (
    "code" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "localCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SubDistrict" (
    "code" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "localCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "postalCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubDistrict_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Region_isActive_sortOrder_idx" ON "Region"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Region_name_idx" ON "Region"("name");

-- CreateIndex
CREATE INDEX "Province_regionCode_name_idx" ON "Province"("regionCode", "name");

-- CreateIndex
CREATE INDEX "District_provinceCode_name_idx" ON "District"("provinceCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "District_provinceCode_localCode_key" ON "District"("provinceCode", "localCode");

-- CreateIndex
CREATE INDEX "SubDistrict_districtCode_name_idx" ON "SubDistrict"("districtCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SubDistrict_districtCode_localCode_key" ON "SubDistrict"("districtCode", "localCode");

-- CreateIndex
CREATE INDEX "Location_createdById_createdAt_idx" ON "Location"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Location_regionCode_isActive_deletedAt_updatedAt_idx" ON "Location"("regionCode", "isActive", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Location_provinceCode_districtCode_subDistrictCode_idx" ON "Location"("provinceCode", "districtCode", "subDistrictCode");

-- CreateIndex
CREATE INDEX "Location_deletedAt_updatedAt_idx" ON "Location"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Location_title_idx" ON "Location"("title");

-- AddForeignKey
ALTER TABLE "Province" ADD CONSTRAINT "Province_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "Region"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubDistrict" ADD CONSTRAINT "SubDistrict_districtCode_fkey" FOREIGN KEY ("districtCode") REFERENCES "District"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "Region"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_districtCode_fkey" FOREIGN KEY ("districtCode") REFERENCES "District"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_subDistrictCode_fkey" FOREIGN KEY ("subDistrictCode") REFERENCES "SubDistrict"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
