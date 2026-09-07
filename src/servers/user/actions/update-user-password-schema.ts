import { z } from "zod";
import { passwordSchema, reasonSchema } from "../helpers";

export const updateUserPasswordSchema = z
  .object({
    userId: z.uuid("ไม่พบผู้ใช้งานที่ถูกต้อง"),
    password: passwordSchema,
    passwordConfirmation: z.string(),
    reason: reasonSchema,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "รหัสผ่านไม่ตรงกัน",
  });
