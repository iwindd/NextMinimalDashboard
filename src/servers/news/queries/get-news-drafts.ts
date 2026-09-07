import { NewsRevisionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManageNews } from "../authorization";
import { NEWS_LIST_INCLUDE, toNewsListItem } from "../helpers";
import type { NewsDraftListResult } from "../types";

export async function getNewsDrafts(): Promise<NewsDraftListResult> {
  const actor = await requireManageNews();
  const where = {
    authorId: actor.id,
    deletedAt: null,
    workingRevision: { is: { status: NewsRevisionStatus.DRAFT } },
  } satisfies Prisma.NewsWhereInput;
  const records = await prisma.news.findMany({
    where,
    include: NEWS_LIST_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  return {
    data: records.map((record) => toNewsListItem(record)),
    total: records.length,
  };
}
