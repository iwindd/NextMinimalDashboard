import { NewsRevisionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManageNews } from "../authorization";
import { NEWS_LIST_INCLUDE, toNewsListItem } from "../helpers";
import type {
  NewsListCounts,
  NewsListQuery,
  NewsListResult,
} from "../types";

type NewsStatusFilter =
  | "draft"
  | "in_review"
  | "republish"
  | "changes_requested"
  | "published"
  | "archived";

function buildStatusConditions(
  status: NewsStatusFilter,
  actor: Awaited<ReturnType<typeof requireManageNews>>,
): Prisma.NewsWhereInput[] {
  if (status === "draft") {
    return [
      { authorId: actor.id },
      { archivedAt: null },
      {
        OR: [
          {
            workingRevision: { is: { status: NewsRevisionStatus.DRAFT } },
          },
          {
            workingRevision: {
              is: { status: NewsRevisionStatus.CHANGES_REQUESTED },
            },
          },
        ],
      },
    ];
  }
  if (status === "published") {
    return [
      { archivedAt: null },
      { publishedRevision: { is: { status: NewsRevisionStatus.PUBLISHED } } },
      { workingRevision: { is: null } },
    ];
  }
  if (status === "republish") {
    return [
      { archivedAt: { not: null } },
      { workingRevision: { is: { status: NewsRevisionStatus.IN_REVIEW } } },
    ];
  }
  if (status === "archived") {
    return [
      { archivedAt: { not: null } },
      {
        NOT: {
          workingRevision: { is: { status: NewsRevisionStatus.IN_REVIEW } },
        },
      },
    ];
  }
  if (status === "in_review") {
    return [
      { workingRevision: { is: { status: NewsRevisionStatus.IN_REVIEW } } },
    ];
  }
  if (actor.role === "ADMIN") {
    return [
      { archivedAt: null },
      {
        OR: [
          {
            workingRevision: {
              is: { status: NewsRevisionStatus.CHANGES_REQUESTED },
            },
          },
          {
            AND: [
              { authorId: { not: actor.id } },
              {
                workingRevision: {
                  is: {
                    status: NewsRevisionStatus.DRAFT,
                    reviewedAt: { not: null },
                  },
                },
              },
            ],
          },
        ],
      },
    ];
  }
  return [
    { archivedAt: null },
    {
      workingRevision: {
        is: { status: NewsRevisionStatus.CHANGES_REQUESTED },
      },
    },
  ];
}

function buildDraftVisibilityCondition(
  actor: Awaited<ReturnType<typeof requireManageNews>>,
): Prisma.NewsWhereInput {
  if (actor.role === "EDITOR") {
    return {
      NOT: { workingRevision: { is: { status: NewsRevisionStatus.DRAFT } } },
    };
  }

  return {
    OR: [
      {
        NOT: { workingRevision: { is: { status: NewsRevisionStatus.DRAFT } } },
      },
      {
        AND: [
          { authorId: { not: actor.id } },
          {
            workingRevision: {
              is: {
                status: NewsRevisionStatus.DRAFT,
                reviewedAt: { not: null },
              },
            },
          },
        ],
      },
    ],
  };
}

function buildWhere(
  query: NewsListQuery,
  actor: Awaited<ReturnType<typeof requireManageNews>>,
): Prisma.NewsWhereInput {
  const search = query.search.trim();
  const owner = actor.role === "EDITOR" ? { authorId: actor.id } : {};
  const statuses: NewsStatusFilter[] =
    query.status === "all" ? [] : query.status;

  const visibility = buildDraftVisibilityCondition(actor);
  const conditions: Prisma.NewsWhereInput[] = [owner, { deletedAt: null }];
  const includesDraft = statuses.includes("draft");
  if (statuses.length === 0 || !includesDraft) conditions.push(visibility);

  if (query.categoryIds.length > 0) {
    const categoryId = { in: query.categoryIds };
    conditions.push({
      OR: [
        { workingRevision: { is: { categoryId } } },
        { publishedRevision: { is: { categoryId } } },
      ],
    });
  }
  if (statuses.length === 1) {
    conditions.push(...buildStatusConditions(statuses[0], actor));
  } else if (statuses.length > 1) {
    if (!includesDraft) {
      conditions.push({
        OR: statuses.map((status) => ({
          AND: buildStatusConditions(status, actor),
        })),
      });
    } else {
      conditions.push({
        OR: statuses.map((status) => ({
          AND: [
            ...(status === "draft" ? [] : [visibility]),
            ...buildStatusConditions(status, actor),
          ],
        })),
      });
    }
  }
  if (search) {
    conditions.push({
      OR: [
        { workingRevision: { is: { title: { contains: search, mode: "insensitive" } } } },
        { workingRevision: { is: { excerpt: { contains: search, mode: "insensitive" } } } },
        { publishedRevision: { is: { title: { contains: search, mode: "insensitive" } } } },
        { publishedRevision: { is: { excerpt: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }

  return { AND: conditions };
}

async function getNewsCounts(
  query: NewsListQuery,
  actor: Awaited<ReturnType<typeof requireManageNews>>,
): Promise<NewsListCounts> {
  const [all, draft, inReview, published, archived, changesRequested] =
    await Promise.all([
      prisma.news.count({
        where: buildWhere({ ...query, status: "all" }, actor),
      }),
      prisma.news.count({
        where: buildWhere({ ...query, status: ["draft"] }, actor),
      }),
      prisma.news.count({
        where: buildWhere({ ...query, status: ["in_review"] }, actor),
      }),
      prisma.news.count({
        where: buildWhere({ ...query, status: ["published"] }, actor),
      }),
      prisma.news.count({
        where: buildWhere({ ...query, status: ["archived"] }, actor),
      }),
      prisma.news.count({
        where: buildWhere({ ...query, status: ["changes_requested"] }, actor),
      }),
    ]);

  return {
    all,
    draft,
    in_review: inReview,
    published,
    archived,
    changes_requested: changesRequested,
  };
}

function buildOrderBy(query: NewsListQuery): Prisma.NewsOrderByWithRelationInput {
  return { [query.sortBy]: query.sortDirection } as Prisma.NewsOrderByWithRelationInput;
}

type NewsSortSnapshot = {
  id: string;
  updatedAt: Date;
  archivedAt: Date | null;
  workingRevision: { status: NewsRevisionStatus; reviewedAt: Date | null } | null;
  publishedRevision: { status: NewsRevisionStatus } | null;
};

function getStatusPriority(record: NewsSortSnapshot) {
  if (record.workingRevision?.status === NewsRevisionStatus.IN_REVIEW) {
    return record.archivedAt ? 2 : 1;
  }
  if (
    !record.archivedAt &&
    record.publishedRevision?.status === NewsRevisionStatus.PUBLISHED
  ) {
    return 3;
  }
  if (record.archivedAt) return 4;
  if (record.workingRevision?.status === NewsRevisionStatus.CHANGES_REQUESTED) {
    return 5;
  }
  if (
    record.workingRevision?.status === NewsRevisionStatus.DRAFT &&
    record.workingRevision.reviewedAt
  ) {
    return 5;
  }
  return 6;
}

async function getStatusSortedNews(
  where: Prisma.NewsWhereInput,
  query: NewsListQuery,
) {
  const snapshots = await prisma.news.findMany({
    where,
    select: {
      id: true,
      updatedAt: true,
      archivedAt: true,
      workingRevision: { select: { status: true, reviewedAt: true } },
      publishedRevision: { select: { status: true } },
    },
  });

  const sorted = [...snapshots].sort((left, right) => {
    const priorityDifference =
      getStatusPriority(left) - getStatusPriority(right);
    const direction = query.sortDirection === "asc" ? 1 : -1;
    if (priorityDifference !== 0) return priorityDifference * direction;

    const updatedDifference =
      right.updatedAt.getTime() - left.updatedAt.getTime();
    return updatedDifference !== 0
      ? updatedDifference * direction
      : left.id.localeCompare(right.id) * direction;
  });
  const skip = (query.page - 1) * query.pageSize;
  const ids = sorted.slice(skip, skip + query.pageSize).map((record) => record.id);
  if (ids.length === 0) return { ids, total: sorted.length };

  const records = await prisma.news.findMany({
    where: { id: { in: ids } },
    include: NEWS_LIST_INCLUDE,
  });
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return {
    ids,
    total: sorted.length,
    records: ids.flatMap((id) => {
      const record = recordsById.get(id);
      return record ? [record] : [];
    }),
  };
}

export async function getNewsList(query: NewsListQuery): Promise<NewsListResult> {
  const actor = await requireManageNews();
  const where = buildWhere(query, actor);
  const presentationOptions = {
    reviewedDraftAsChangesRequested: actor.role === "ADMIN",
  };
  if (query.sortBy === "status") {
    const [sorted, counts] = await Promise.all([
      getStatusSortedNews(where, query),
      getNewsCounts(query, actor),
    ]);
    return {
      data:
        sorted.records?.map((record) =>
          toNewsListItem(record, presentationOptions),
        ) ?? [],
      total: sorted.total,
      counts,
    };
  }
  const skip = (query.page - 1) * query.pageSize;

  const [data, total, counts] = await Promise.all([
    prisma.news.findMany({
      where,
      include: NEWS_LIST_INCLUDE,
      orderBy: buildOrderBy(query),
      skip,
      take: query.pageSize,
    }),
    prisma.news.count({ where }),
    getNewsCounts(query, actor),
  ]);

  return {
    data: data.map((record) => toNewsListItem(record, presentationOptions)),
    total,
    counts,
  };
}
