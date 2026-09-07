/*
  Warnings:

  - You are about to drop the column `contentHtml` on the `ProjectOriginSnapshot` table. All the data in the column will be lost.
  - Added the required column `caption` to the `ProjectOriginSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `ProjectOriginSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProjectOriginSnapshot" DROP COLUMN "contentHtml",
ADD COLUMN     "caption" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;
