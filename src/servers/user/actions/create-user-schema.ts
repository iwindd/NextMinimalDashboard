import { z } from "zod";
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  reasonSchema,
  userRoleSchema,
} from "../helpers";

export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    role: userRoleSchema,
    reason: reasonSchema,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "รหัสผ่านไม่ตรงกัน",
  });
