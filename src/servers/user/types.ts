import type { UserRole } from "@prisma/client";
import type { infer as ZodInfer } from "zod";
import type { createUserSchema } from "./actions/create-user-schema";
import type { listUsersSchema } from "./queries/get-user-list-schema";
import type { updateUserEmailSchema } from "./actions/update-user-email-schema";
import type { updateUserNameSchema } from "./actions/update-user-name-schema";
import type { updateUserPasswordSchema } from "./actions/update-user-password-schema";
import type { updateUserRoleSchema } from "./actions/update-user-role-schema";

export type CreateUserInput = ZodInfer<typeof createUserSchema>;
export type UpdateUserNameInput = ZodInfer<typeof updateUserNameSchema>;
export type UpdateUserEmailInput = ZodInfer<typeof updateUserEmailSchema>;
export type UpdateUserRoleInput = ZodInfer<typeof updateUserRoleSchema>;
export type UpdateUserPasswordInput = ZodInfer<
  typeof updateUserPasswordSchema
>;
export type UserListQuery = ZodInfer<typeof listUsersSchema>;

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type UserDetail = UserListItem & {
  updatedAt: string;
};

export type UserListResult = {
  data: UserListItem[];
  total: number;
};
