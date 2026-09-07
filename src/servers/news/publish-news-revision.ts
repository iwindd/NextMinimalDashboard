import {
  FileAccess,
  NewsRevisionStatus,
} from "@prisma/client";
import type { prisma } from "@/lib/prisma";
import { setNewsRevisionFileAccess } from "./files/sync-news-revision-files";

type NewsTransaction = Pick<
  typeof prisma,
  "news" | "newsRevision" | "fileAsset" | "fileReference" | "newsRevisionFile"
>;

type PublishNewsRevisionInput = {
  newsId: string;
  revisionId: string;
  previousRevisionId: string | null;
  reviewedById: string | null;
};

export async function publishNewsRevision(
  transaction: NewsTransaction,
  input: PublishNewsRevisionInput,
) {
  const now = new Date();

  if (
    input.previousRevisionId &&
    input.previousRevisionId !== input.revisionId
  ) {
    await setNewsRevisionFileAccess(
      transaction,
      input.previousRevisionId,
      FileAccess.PRIVATE,
    );
    await transaction.newsRevision.update({
      where: { id: input.previousRevisionId },
      data: { status: NewsRevisionStatus.SUPERSEDED },
    });
  }

  await transaction.newsRevision.update({
    where: { id: input.revisionId },
    data: {
      status: NewsRevisionStatus.PUBLISHED,
      reviewedById: input.reviewedById,
      reviewedAt: input.reviewedById ? now : null,
      publishedAt: now,
      reviewReason: null,
    },
  });
  await setNewsRevisionFileAccess(
    transaction,
    input.revisionId,
    FileAccess.PUBLIC,
  );
  await transaction.news.update({
    where: { id: input.newsId },
    data: {
      publishedRevisionId: input.revisionId,
      workingRevisionId: null,
      archivedAt: null,
    },
  });

  return now;
}
