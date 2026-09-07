import { NewsRevisionStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { sanitizeRichTextHtml } from "@/lib/rich-text-html";
import type { NewsCategoryItem } from "../news-category/types";
import { getFileUrl } from "../file-manager/helpers";
import type { NewsDetail, NewsListItem, NewsRevisionItem } from "./types";

const NEWS_REVISION_INCLUDE = {
  category: { select: { id: true, name: true } },
  files: {
    include: {
      reference: {
        include: { file: { select: { id: true } } },
      },
    },
  },
} satisfies Prisma.NewsRevisionInclude;

export const NEWS_LIST_INCLUDE = {
  author: { select: { id: true, name: true } },
  workingRevision: {
    include: NEWS_REVISION_INCLUDE,
  },
  publishedRevision: {
    include: NEWS_REVISION_INCLUDE,
  },
} satisfies Prisma.NewsInclude;

export type NewsListWithRelations = Prisma.NewsGetPayload<{ include: typeof NEWS_LIST_INCLUDE }>;

export const NEWS_DETAIL_INCLUDE = {
  author: { select: { id: true, name: true } },
  workingRevision: {
    include: NEWS_REVISION_INCLUDE,
  },
  publishedRevision: {
    include: NEWS_REVISION_INCLUDE,
  },
} satisfies Prisma.NewsInclude;

export type NewsDetailWithRelations = Prisma.NewsGetPayload<{ include: typeof NEWS_DETAIL_INCLUDE }>;
type NewsRevisionWithRelations = NonNullable<NewsDetailWithRelations["workingRevision"]>;

type NewsPresentationOptions = {
  reviewedDraftAsChangesRequested?: boolean;
};

const optionalUuid = z.uuid().optional().nullable();

const newsSourceItemSchema = z.object({
  url: z.url({ protocol: /^https?$/i, hostname: z.regexes.domain }),
  title: z.string().trim().min(1, "กรุณากรอกชื่อแหล่งข้อมูล").max(300, "ชื่อแหล่งข้อมูลต้องไม่เกิน 300 ตัวอักษร"),
});

export type NewsSourceItem = z.infer<typeof newsSourceItemSchema>;

const newsSourcesSchema = z.array(newsSourceItemSchema).max(50, "เพิ่มแหล่งข้อมูลได้ไม่เกิน 50 รายการ").default([]);

export const newsDraftFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "กรุณากรอกหัวข้อข่าว")
    .max(200, "หัวข้อข่าวต้องไม่เกิน 200 ตัวอักษร"),
  excerpt: z
    .string()
    .trim()
    .max(1000, "คำโปรยต้องไม่เกิน 1,000 ตัวอักษร")
    .optional()
    .nullable(),
  bodyHtml: z
    .string()
    .trim()
    .max(500_000, "เนื้อหาข่าวยาวเกินไป")
    .default(""),
  categoryId: optionalUuid,
  coverFileId: optionalUuid,
  readTimeMinutes: z
    .coerce
    .number()
    .int()
    .min(1, "เวลาอ่านต้องอย่างน้อย 1 นาที")
    .max(240, "เวลาอ่านต้องไม่เกิน 240 นาที")
    .optional()
    .nullable(),
  source: newsSourcesSchema,
});

export const newsIdSchema = z.object({ newsId: z.uuid() });

function hasNewsBodyContent(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim().length > 0;
}

export const newsReviewSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อข่าว"),
  coverFileId: z.uuid("กรุณาเพิ่มรูปปกข่าว"),
  bodyHtml: z.string().refine(hasNewsBodyContent, "กรุณากรอกเนื้อหาข่าว"),
});

export function sanitizeNewsBody(html: string) {
  return sanitizeRichTextHtml(html);
}

export function extractNewsFileIds(html: string) {
  const ids = new Set<string>();
  const pattern = /\/api\/files\/([0-9a-f-]{36})/gi;
  for (const match of html.matchAll(pattern)) ids.add(match[1]);
  return [...ids];
}

export function getNewsRevisionCoverFile(revision: {
  files: Array<{
    purpose: string;
    reference: { file: { id: string } } | null;
  }>;
}) {
  return revision.files.find((item) => item.purpose === "COVER")?.reference
    ?.file;
}

function toCategory(category: { id: string; name: string } | null): NewsCategoryItem | null {
  return category ? { id: category.id, name: category.name } : null;
}

export function normalizeNewsSources(value: unknown): NewsSourceItem[] {
  if (!value) return [];
  if (typeof value === "string") {
    const title = value.trim();
    return title ? [{ url: "", title }] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = "url" in item && typeof item.url === "string" ? item.url : "";
    const title = "title" in item && typeof item.title === "string" ? item.title : "";
    return url || title ? [{ url, title }] : [];
  });
}

function toNewsRevisionItem(
  revision: NewsRevisionWithRelations,
  options: NewsPresentationOptions = {},
): NewsRevisionItem {
  const coverFile = getNewsRevisionCoverFile(revision);
  const status =
    options.reviewedDraftAsChangesRequested &&
    revision.status === NewsRevisionStatus.DRAFT &&
    revision.reviewedAt
      ? NewsRevisionStatus.CHANGES_REQUESTED
      : revision.status;
  return {
    id: revision.id,
    version: revision.version,
    status,
    title: revision.title,
    excerpt: revision.excerpt,
    bodyHtml: revision.bodyHtml,
    category: toCategory(revision.category),
    coverFileId: coverFile?.id ?? null,
    coverUrl: coverFile ? getFileUrl(coverFile) : null,
    readTimeMinutes: revision.readTimeMinutes,
    source: normalizeNewsSources(revision.source),
    reviewReason: revision.reviewReason,
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    reviewedAt: revision.reviewedAt?.toISOString() ?? null,
    publishedAt: revision.publishedAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
  };
}

export function toNewsListItem(
  news: NewsListWithRelations,
  options: NewsPresentationOptions = {},
): NewsListItem {
  const revision = news.workingRevision ?? news.publishedRevision;
  const coverFile = revision ? getNewsRevisionCoverFile(revision) : null;
  const status = revision
    ? options.reviewedDraftAsChangesRequested &&
      revision.status === NewsRevisionStatus.DRAFT &&
      revision.reviewedAt
      ? NewsRevisionStatus.CHANGES_REQUESTED
      : revision.status
    : null;
  return {
    id: news.id,
    title: revision?.title ?? "ไม่มีฉบับร่าง",
    excerpt: revision?.excerpt ?? "",
    category: revision ? toCategory(revision.category) : null,
    coverUrl: coverFile ? getFileUrl(coverFile) : null,
    status,
    author: news.author,
    viewCount: news.viewCount,
    deletedAt: news.deletedAt?.toISOString() ?? null,
    archivedAt: news.archivedAt?.toISOString() ?? null,
    updatedAt: news.updatedAt.toISOString(),
    publishedAt: news.publishedRevision?.publishedAt?.toISOString() ?? null,
  };
}

export function toNewsDetail(
  news: NewsDetailWithRelations,
  archiveNote: string | null = null,
  options: NewsPresentationOptions = {},
): NewsDetail {
  return {
    id: news.id,
    author: news.author,
    viewCount: news.viewCount,
    deletedAt: news.deletedAt?.toISOString() ?? null,
    archivedAt: news.archivedAt?.toISOString() ?? null,
    archiveNote,
    workingRevision: news.workingRevision
      ? toNewsRevisionItem(news.workingRevision, options)
      : null,
    publishedRevision: news.publishedRevision
      ? toNewsRevisionItem(news.publishedRevision, options)
      : null,
  };
}
