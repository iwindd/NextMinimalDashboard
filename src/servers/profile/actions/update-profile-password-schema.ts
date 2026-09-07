import { z } from "zod";
import { passwordSchema, reasonSchema } from "@/servers/user/helpers";

export const updateProfilePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "กรุณากรอกรหัสผ่านเดิม"),
    password: passwordSchema,
    passwordConfirmation: z.string(),
    reason: reasonSchema,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "รหัสผ่านไม่ตรงกัน",
  });
