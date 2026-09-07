import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogAuthorizationError } from "./exceptions";

export type AuditLogActor = {
  id: string;
  role: UserRole;
  isActive: boolean;
};

async function getSessionActor(): Promise<AuditLogActor | null> {
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

  return actor?.isActive ? actor : null;
}

/**
 * Any signed-in active user may read their own audit timeline. The scope is
 * always derived from the returned actor id, never from client input.
 */
export async function getOwnAuditLogsActor() {
  return getSessionActor();
}

export async function requireOwnAuditLogs() {
  const actor = await getOwnAuditLogsActor();
  if (!actor) throw new AuditLogAuthorizationError();
  return actor;
}

/**
 * Reading the system-wide timeline, or another user's timeline, is limited to
 * active administrators.
 */
export async function getViewAllAuditLogsActor() {
  const actor = await getSessionActor();
  return actor?.role === UserRole.ADMIN ? actor : null;
}

export async function requireViewAllAuditLogs() {
  const actor = await getViewAllAuditLogsActor();
  if (!actor) throw new AuditLogAuthorizationError();
  return actor;
}
