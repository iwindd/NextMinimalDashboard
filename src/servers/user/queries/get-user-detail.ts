import { prisma } from "@/lib/prisma";
import { getUserDetailSchema } from "./get-user-detail-schema";
import { requireManageUsers } from "../authorization";
import { USER_DETAIL_SELECT, toUserDetail } from "../helpers";

export async function getUserDetail(userId: string) {
  await requireManageUsers();

  if (!getUserDetailSchema.safeParse({ userId }).success) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_DETAIL_SELECT,
  });

  return user ? toUserDetail(user) : null;
}
