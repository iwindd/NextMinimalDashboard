import { z } from "zod";

export const getUserDetailSchema = z.object({
  userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
});
