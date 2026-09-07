import { prisma } from "@/lib/prisma";
import type { NewsCategoryListQuery } from "../types";
import { requireManageNews } from "@/servers/news/authorization";

export async function getNewsCategories(query: NewsCategoryListQuery) {
  await requireManageNews();
  const items = await prisma.newsCategory.findMany({
    where: query.search
      ? { name: { contains: query.search, mode: "insensitive" } }
      : undefined,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
    select: { id: true, name: true },
  });

  const hasMore = items.length > query.limit;
  const page = hasMore ? items.slice(0, query.limit) : items;
  return {
    data: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}
