import type { NewsRevisionStatus } from "@prisma/client";
import type { z } from "zod";
import type { createNewsSchema } from "./actions/create-news-schema";
import type { listNewsSchema } from "./queries/get-news-list-schema";
import type { NewsCategoryItem } from "../news-category/types";
import type { NewsSourceItem } from "./helpers";

export type NewsDraftInput = z.infer<typeof createNewsSchema>;
export type NewsListQuery = z.infer<typeof listNewsSchema>;

export type NewsDraftListResult = {
  data: NewsListItem[];
  total: number;
};

export type NewsListItem = {
  id: string;
  title: string;
  excerpt: string | null;
  category: NewsCategoryItem | null;
  coverUrl: string | null;
  status: NewsRevisionStatus | null;
  author: { id: string; name: string } | null;
  viewCount: number;
  deletedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

export type NewsListResult = {
  data: NewsListItem[];
  total: number;
  counts: NewsListCounts;
};

export type NewsListCounts = {
  all: number;
  draft: number;
  in_review: number;
  published: number;
  archived: number;
  changes_requested: number;
};

export type NewsRevisionItem = {
  id: string;
  version: number;
  status: NewsRevisionStatus;
  title: string;
  excerpt: string | null;
  bodyHtml: string;
  category: NewsCategoryItem | null;
  coverFileId: string | null;
  coverUrl: string | null;
  readTimeMinutes: number | null;
  source: NewsSourceItem[];
  reviewReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsDetail = {
  id: string;
  author: { id: string; name: string } | null;
  viewCount: number;
  deletedAt: string | null;
  archivedAt: string | null;
  archiveNote: string | null;
  workingRevision: NewsRevisionItem | null;
  publishedRevision: NewsRevisionItem | null;
};
