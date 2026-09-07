import { z } from "zod";
import { reasonSchema, userRoleSchema } from "../helpers";

export const updateUserRoleSchema = z.object({
  userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
  role: userRoleSchema,
  reason: reasonSchema,
});
