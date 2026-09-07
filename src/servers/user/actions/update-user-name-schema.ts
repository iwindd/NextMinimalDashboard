import { z } from "zod";
import { nameSchema, reasonSchema } from "../helpers";

export const updateUserNameSchema = z.object({
  userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
  name: nameSchema,
  reason: reasonSchema,
});
