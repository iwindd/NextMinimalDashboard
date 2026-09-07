import { AuditAction, AuditResourceType, FileStorage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "../storage";
import {
  shouldDeleteFileOnRemove,
  type DetachedFileCleanup,
  type FileCleanupContext,
} from "./file-delete-policy";

type CleanupStatus =
  | "DELETED"
  | "SKIPPED_REFERENCED"
  | "SKIPPED_IN_USE"
  | "SKIPPED_LEGACY_PUBLIC"
  | "NOT_FOUND"
  | "FAILED";

async function updateCleanupAudit(
  target: DetachedFileCleanup,
  status: CleanupStatus,
  error?: string,
) {
  if (!target.auditLogId) return;

  try {
    await prisma.auditLog.update({
      where: { id: target.auditLogId },
      data: {
        metadata: {
          ...(target.metadata ?? {}),
          storageDeletion: status,
          ...(error ? { error } : {}),
        },
      },
    });
  } catch (auditError) {
    console.error("Failed to update detached file cleanup audit", {
      auditLogId: target.auditLogId,
      status,
      error: auditError,
    });
  }
}

/**
 * Records the permanent deletion as a first-class audit entry. The FileAsset row
 * is gone by then, so the identifying details are copied into `before`.
 */
async function auditFileDeleted(
  context: FileCleanupContext,
  target: DetachedFileCleanup,
  file: {
    id: string;
    storage: string;
    objectKey: string;
    originalName: string;
    mimeType: string;
    byteSize: number;
  },
) {
  try {
    await prisma.createAuditLog({
      actor: context.actor,
      requestContext: context.requestContext,
      action: AuditAction.FILE_DELETED,
      resourceType: AuditResourceType.FILE,
      resourceId: file.id,
      before: {
        storage: file.storage,
        objectKey: file.objectKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
      },
      after: { deleted: true },
      metadata: { ...(target.metadata ?? {}), source: context.source },
    });
  } catch (error) {
    console.error("Failed to record a permanent file deletion", {
      fileId: file.id,
      error,
    });
  }
}

/**
 * Deletes the stored objects behind files that no live record uses any more and
 * records every outcome.
 *
 * Must run after the transaction that released the references has committed,
 * because storage deletion cannot be rolled back. It never throws: a failed
 * deletion leaves an auditable trail instead of failing the content change.
 */
export async function cleanupDetachedFiles(
  targets: DetachedFileCleanup[],
  context: FileCleanupContext,
) {
  if (targets.length === 0) return;
  if (!shouldDeleteFileOnRemove()) return;

  const seen = new Set<string>();

  for (const target of targets) {
    if (seen.has(target.fileId)) continue;
    seen.add(target.fileId);

    try {
      const file = await prisma.fileAsset.findUnique({
        where: { id: target.fileId },
        select: {
          id: true,
          storage: true,
          objectKey: true,
          originalName: true,
          mimeType: true,
          byteSize: true,
          references: { select: { id: true }, take: 1 },
        },
      });

      if (!file) {
        await updateCleanupAudit(target, "NOT_FOUND");
        continue;
      }

      if (file.references.length > 0) {
        await updateCleanupAudit(target, "SKIPPED_REFERENCED");
        continue;
      }

      // Legacy PUBLIC objects are seeded assets under the web root, outside the
      // LOCAL/S3 stores `deleteFile` knows how to address. Deleting one would
      // either throw (no bucket configured) or silently succeed against a key
      // that never existed and then drop the FileAsset row while the bytes stay
      // served from `public/`. The delivery route treats PUBLIC as permanently
      // addressable for the same reason, so cleanup leaves them alone.
      if (file.storage === FileStorage.PUBLIC) {
        await updateCleanupAudit(target, "SKIPPED_LEGACY_PUBLIC");
        continue;
      }

      await deleteFile({ storage: file.storage, objectKey: file.objectKey });
      await prisma.fileAsset.deleteMany({
        where: { id: file.id, references: { none: {} } },
      });
      await updateCleanupAudit(target, "DELETED");
      await auditFileDeleted(context, target, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete a detached file", {
        fileId: target.fileId,
        source: context.source,
        error,
      });
      await updateCleanupAudit(target, "FAILED", message);
    }
  }
}
