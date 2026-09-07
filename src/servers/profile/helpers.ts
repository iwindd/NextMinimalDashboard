import { Prisma } from "@prisma/client";
import type { Profile } from "./types";

export const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export function isUniqueEmailError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function toProfile(user: {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  createdAt: Date;
  updatedAt: Date;
}): Profile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
