import { z } from "zod";
import { nameSchema, reasonSchema } from "@/servers/user/helpers";

export const updateProfileNameSchema = z.object({
  name: nameSchema,
  reason: reasonSchema,
});
