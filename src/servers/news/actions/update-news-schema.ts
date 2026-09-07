import { z } from "zod";
import { newsDraftFieldsSchema } from "../helpers";

export const updateNewsSchema = newsDraftFieldsSchema.extend({
  newsId: z.uuid(),
});
