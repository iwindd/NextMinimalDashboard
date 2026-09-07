import { AuditAction, AuditResourceType, type Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";
import type { AuditLogActor } from "../authorization";
import { AuditLogNotFoundError } from "../exceptions";
import { AUDIT_LOG_EXPORT_SELECT } from "../helpers";
import type { AuditLogExportFile, AuditLogExportUser } from "../types";

function toExportUser(
  user: {
    id: string;
    email: string;
    name: string;
    role: AuditLogExportUser["role"];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null,
): AuditLogExportUser | null {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Reads one audit record and records the download itself before returning the
 * payload. If the export cannot be audited, the caller must not deliver a file.
 */
export async function buildAuditLogExport({
  auditLogId,
  actor,
  scopeWhere,
}: {
  auditLogId: string;
  actor: AuditLogActor;
  scopeWhere?: Prisma.AuditLogWhereInput;
}): Promise<AuditLogExportFile> {
  const record = await prisma.auditLog.findFirst({
    where: { id: auditLogId, ...scopeWhere },
    select: AUDIT_LOG_EXPORT_SELECT,
  });

  if (!record) {
    throw new AuditLogNotFoundError();
  }

  const requestContext = await getRequestContext();
  await prisma.createAuditLog({
    actor: { id: actor.id, role: actor.role },
    target: record.targetUserId ? { id: record.targetUserId } : null,
    requestContext,
    action: AuditAction.AUDIT_LOG_EXPORTED,
    resourceType: AuditResourceType.AUDIT_LOG,
    resourceId: record.id,
    metadata: {
      exportedAction: record.action,
      exportedResourceType: record.resourceType,
      exportedResourceId: record.resourceId,
      includedBefore: record.before !== null,
      includedAfter: record.after !== null,
      includedMetadata: record.metadata !== null,
      includedActorUser: record.actorUser !== null,
      includedTargetUser: record.targetUser !== null,
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    auditLog: {
      id: record.id,
      actorUserId: record.actorUserId,
      actorRole: record.actorRole,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      targetUserId: record.targetUserId,
      before: record.before,
      after: record.after,
      metadata: record.metadata,
      reason: record.reason,
      requestId: record.requestId,
      ipHash: record.ipHash,
      userAgent: record.userAgent,
      createdAt: record.createdAt.toISOString(),
      actorUser: toExportUser(record.actorUser),
      targetUser: toExportUser(record.targetUser),
    },
  };
}
