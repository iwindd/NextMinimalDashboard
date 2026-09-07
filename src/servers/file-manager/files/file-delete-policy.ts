import type { RequestContext } from "@/lib/audit/request-context";
import type { AuditActor } from "@/lib/prisma-extensions/audit";

export type DetachedFileCleanup = {
  fileId: string;
  /**
   * Audit row that recorded the detachment. Its `metadata.storageDeletion` is
   * patched with the outcome so the detach event and the physical deletion stay
   * linked. Paths without a detach event leave this unset and rely on the
   * FILE_DELETED entry alone.
   */
  auditLogId?: string;
  metadata?: Record<string, string>;
};

export type FileCleanupContext = {
  actor: AuditActor;
  requestContext: RequestContext;
  /** Subsystem that released the file, e.g. `NEWS`. */
  source: string;
};

/**
 * Single switch for permanent deletion across every subsystem that stores
 * uploads used by the retained News module.
 *
 * Deletion is on unless the variable is explicitly set to something other than
 * "true", which keeps existing deployments behaving the same way now that the
 * per-subsystem flags are merged into this one.
 *
 * This module deliberately carries no Prisma or storage import so the audit
 * writers can read the flag without pulling in a database client.
 */
export function shouldDeleteFileOnRemove() {
  const configured = process.env.FILE_MANAGER_DELETE_ON_REMOVE;
  return configured === undefined || configured.trim().toLowerCase() === "true";
}
