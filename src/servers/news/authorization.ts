import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NewsAuthorizationError } from "./exceptions";

export type NewsActor = {
  id: string;
  role: UserRole;
  isActive: boolean;
};

export async function getManageNewsActor(): Promise<NewsActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  return actor?.isActive && (actor.role === UserRole.ADMIN || actor.role === UserRole.EDITOR)
    ? actor
    : null;
}

export async function requireManageNews(): Promise<NewsActor> {
  const actor = await getManageNewsActor();
  if (!actor) throw new NewsAuthorizationError();
  return actor;
}
