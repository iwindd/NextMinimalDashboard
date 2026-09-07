import type { z } from "zod";
import type { listNewsCategoriesSchema } from "./queries/get-news-categories-schema";

export type NewsCategoryListQuery = z.infer<typeof listNewsCategoriesSchema>;

export type NewsCategoryItem = {
  id: string;
  name: string;
};
