-- AlterTable
ALTER TABLE "LearningSeries" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LearningSeriesViewSession" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningSeriesViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningSeriesViewSession_seriesId_createdAt_idx" ON "LearningSeriesViewSession"("seriesId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSeriesViewSession_seriesId_sessionHash_key" ON "LearningSeriesViewSession"("seriesId", "sessionHash");

-- CreateIndex
CREATE INDEX "LearningSeries_viewCount_idx" ON "LearningSeries"("viewCount");

-- AddForeignKey
ALTER TABLE "LearningSeriesViewSession" ADD CONSTRAINT "LearningSeriesViewSession_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "LearningSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
