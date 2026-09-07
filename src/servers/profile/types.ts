import type { UserRole } from "@prisma/client";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};
