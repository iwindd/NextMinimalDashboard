import { NewsRevisionStatus, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManageNews, type NewsActor } from "@/servers/news/authorization";
import type { AdminNotificationCounts } from "../types";

const NOTIFICATION_CACHE_SECONDS = 60;

function getCachedNewsReviewCount(actor: NewsActor) {
  const reviewStatus = actor.role === "EDITOR"
    ? NewsRevisionStatus.CHANGES_REQUESTED
    : NewsRevisionStatus.IN_REVIEW;
  const where: Prisma.NewsWhereInput = {
    AND: [
      actor.role === "EDITOR" ? { authorId: actor.id } : {},
      { deletedAt: null },
      { workingRevision: { is: { status: reviewStatus } } },
    ],
  };

  return unstable_cache(
    () => prisma.news.count({ where }),
    ["admin-notification-count", "news-review", actor.role, actor.id],
    {
      revalidate: NOTIFICATION_CACHE_SECONDS,
      tags: [
        `admin-notification-count:news:${actor.role}:${actor.id}`,
        "admin-notification-count:news",
      ],
    },
  )();
}

export async function getAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  const actor = await requireManageNews();
  return { news: await getCachedNewsReviewCount(actor) };
}
