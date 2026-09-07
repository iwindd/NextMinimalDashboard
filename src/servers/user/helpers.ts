import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { UserDetail } from "./types";

export const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const USER_DETAIL_SELECT = {
  ...USER_LIST_SELECT,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRoleSchema = z.enum(["ADMIN", "EDITOR"] as const);

export const nameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อผู้ใช้งาน")
  .max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร");

export const emailSchema = z
  .email("กรุณากรอกอีเมลให้ถูกต้อง")
  .trim()
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(128, "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร");

export const reasonSchema = z
  .string()
  .trim()
  .max(500, "เหตุผลต้องไม่เกิน 500 ตัวอักษร")
  .transform((value) => value || undefined)
  .optional();

export function isUniqueEmailError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function toUserListItem(user: {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toUserDetail(user: {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserDetail {
  return {
    ...toUserListItem(user),
    updatedAt: user.updatedAt.toISOString(),
  };
}
