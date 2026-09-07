import { z } from "zod";
import { emailSchema, reasonSchema } from "../helpers";

export const updateUserEmailSchema = z.object({
  userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
  email: emailSchema,
  reason: reasonSchema,
});
