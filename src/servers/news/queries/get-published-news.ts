import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getFileUrl } from "@/servers/file-manager/helpers";
import { formatDate } from "@/utils/format";
import { getNewsRevisionCoverFile, sanitizeNewsBody } from "../helpers";

const PUBLISHED_INCLUDE = {
  publishedRevision: {
    include: {
      category: { select: { id: true, name: true } },
      files: {
        include: {
          reference: {
            include: { file: { select: { id: true } } },
          },
        },
      },
    },
  },
};

type PublishedNewsWithRelations = Prisma.NewsGetPayload<{ include: typeof PUBLISHED_INCLUDE }>;

const PUBLISHED_WHERE = {
  deletedAt: null,
  archivedAt: null,
  publishedRevision: { is: { status: "PUBLISHED" } },
} satisfies Prisma.NewsWhereInput;

export async function getPublishedNewsList() {
  const news = await prisma.news.findMany({
    where: PUBLISHED_WHERE,
    include: PUBLISHED_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return news;
}

/**
 * Memoized per request because the article route resolves it twice: once in
 * `generateMetadataui(` and once while rendering the page.
 */
export const getPublishedNewsDetail = cache(async (newsId: string) => {
  return prisma.news.findFirst({
    where: {
      id: newsId,
      deletedAt: null,
      archivedAt: null,
      publishedRevision: { is: { status: "PUBLISHED" } },
    },
    include: PUBLISHED_INCLUDE,
  });
});

export function toPublicNewsItem(news: PublishedNewsWithRelations | null) {
  if (!news) return null;
  const revision = news.publishedRevision;
  if (!revision) return null;
  const publishedAt = revision.publishedAt ?? revision.createdAt;
  const coverFile = getNewsRevisionCoverFile(revision);
  return {
    id: news.id,
    category: revision.category?.name ?? "ไม่ระบุหมวดหมู่",
    title: revision.title,
    description: revision.excerpt ?? "",
    imageUrl: coverFile ? getFileUrl(coverFile) : "/img/news1.png",
    publishedDate: formatDate(publishedAt),
    readTime: revision.readTimeMinutes ? `${revision.readTimeMinutes} นาที` : "",
    viewCount: news.viewCount,
    bodyHtml: sanitizeNewsBody(revision.bodyHtml),
    publishedAt: publishedAt.toISOString(),
  };
}
