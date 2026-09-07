import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  AuditResourceType,
  NewsRevisionStatus,
} from "@prisma/client";
import { requireManageNews } from "../authorization";
import { NewsNotFoundError } from "../exceptions";
import { NEWS_DETAIL_INCLUDE, toNewsDetail } from "../helpers";

export async function getNewsDetail(newsId: string) {
  const actor = await requireManageNews();
  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      ...(actor.role === "EDITOR" ? { authorId: actor.id } : {}),
    },
    include: NEWS_DETAIL_INCLUDE,
  });

  if (!news) throw new NewsNotFoundError();
  const unpublishedDraft =
    !news.publishedRevision &&
    news.workingRevision?.status === NewsRevisionStatus.DRAFT;
  const unreviewedDraft = unpublishedDraft && !news.workingRevision?.reviewedAt;
  if (news.deletedAt && !news.publishedRevision) {
    throw new NewsNotFoundError();
  }
  if (
    actor.role === "ADMIN" &&
    news.authorId !== actor.id &&
    unreviewedDraft
  ) {
    throw new NewsNotFoundError();
  }
  const archiveLog = news.archivedAt
    ? await prisma.auditLog.findFirst({
        where: {
          resourceType: AuditResourceType.NEWS,
          resourceId: news.id,
          action: AuditAction.NEWS_ARCHIVED,
        },
        orderBy: { createdAt: "desc" },
        select: { reason: true },
      })
    : null;

  return toNewsDetail(news, archiveLog?.reason ?? null, {
    reviewedDraftAsChangesRequested:
      actor.role === "ADMIN" && news.authorId !== actor.id,
  });
}
