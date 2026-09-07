import { z } from "zod";
import { emailSchema, reasonSchema } from "@/servers/user/helpers";

export const updateProfileEmailSchema = z.object({
  email: emailSchema,
  reason: reasonSchema,
});
