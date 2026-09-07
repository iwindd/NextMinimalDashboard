import { z } from "zod";
import { reasonSchema } from "../helpers";

export const setUserStatusSchema = z.object({
  userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
  isActive: z.boolean(),
  reason: reasonSchema,
});
