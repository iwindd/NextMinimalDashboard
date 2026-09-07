import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserAuthorizationError } from "./exceptions";

export async function getManageUsersActor() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  return actor?.isActive && actor.role === UserRole.ADMIN ? actor : null;
}

export async function requireManageUsers() {
  const actor = await getManageUsersActor();
  if (!actor) throw new UserAuthorizationError();
  return actor;
}
