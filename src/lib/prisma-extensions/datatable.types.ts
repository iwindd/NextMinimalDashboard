import type { Prisma } from "@prisma/client";

export type DatatableQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

export type DatatableSearchLeaf = {
  mode?: Prisma.QueryMode;
  hasSome?: string[];
};

export type DatatableSearchConfig = {
  [key: string]: DatatableSearchLeaf | DatatableSearchConfig;
};
