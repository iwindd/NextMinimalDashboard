import { z } from "zod";

export const getSourceTitleSchema = z.object({
  url: z.url({ protocol: /^https?$/i }),
});
