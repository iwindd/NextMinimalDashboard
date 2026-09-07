import { z } from "zod";
import { newsIdSchema } from "../helpers";

export const requestNewsChangesSchema = newsIdSchema.extend({
  reason: z
    .string()
    .trim()
    .min(1, "กรุณาระบุเหตุผลที่ต้องแก้ไข")
    .max(500, "เหตุผลต้องไม่เกิน 500 ตัวอักษร"),
});
