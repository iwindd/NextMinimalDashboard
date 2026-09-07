import {
  AuditAction,
  AuditResourceType,
  NewsFilePurpose,
} from "@prisma/client";
import type { RequestContext } from "@/lib/audit/request-context";
import type { prisma } from "@/lib/prisma";
import type { NewsActor } from "../authorization";
import {
  shouldDeleteFileOnRemove,
  type DetachedFileCleanup,
} from "@/servers/file-manager/files/file-delete-policy";
import type {
  NewsFileSnapshot,
  NewsFileSyncResult,
} from "./sync-news-revision-files";

type Transaction = Pick<typeof prisma, "createAuditLog">;

function getCreatedAuditLogId(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return undefined;
  }
  const id = value.id;
  return typeof id === "string" ? id : undefined;
}

function snapshotDetails(
  snapshot: NewsFileSnapshot,
  newsId: string,
  revisionId: string,
) {
  return {
    fileId: snapshot.fileId,
    newsId,
    revisionId,
    purpose: snapshot.purpose,
    originalName: snapshot.originalName,
    mimeType: snapshot.mimeType,
    byteSize: snapshot.byteSize,
  };
}

export async function auditNewsMediaChanges(
  transaction: Transaction,
  input: {
    newsId: string;
    revisionId: string;
    requestContext: RequestContext;
    actor: NewsActor;
    sync: NewsFileSyncResult;
  },
) {
  const cleanupTargets: DetachedFileCleanup[] = [];
  const deleteEnabled = shouldDeleteFileOnRemove();

  for (const file of input.sync.attached) {
    await transaction.createAuditLog({
      actor: input.actor,
      requestContext: input.requestContext,
      action: AuditAction.NEWS_MEDIA_ATTACHED,
      resourceType: AuditResourceType.FILE,
      resourceId: file.fileId,
      before: { attached: false },
      after: {
        attached: true,
        ...snapshotDetails(file, input.newsId, input.revisionId),
      },
      metadata: {
        newsId: input.newsId,
        revisionId: input.revisionId,
        purpose: file.purpose,
      },
    });
  }

  for (const file of input.sync.detached) {
    const metadata = {
      newsId: input.newsId,
      revisionId: input.revisionId,
      purpose: file.purpose,
    };
    const audit = await transaction.createAuditLog({
      actor: input.actor,
      requestContext: input.requestContext,
      action: AuditAction.NEWS_MEDIA_DETACHED,
      resourceType: AuditResourceType.FILE,
      resourceId: file.fileId,
      before: {
        attached: true,
        ...snapshotDetails(file, input.newsId, input.revisionId),
      },
      after: {
        attached: false,
        ...snapshotDetails(file, input.newsId, input.revisionId),
      },
      metadata: {
        ...metadata,
        storageDeletion: deleteEnabled ? "PENDING" : "SKIPPED_DISABLED",
      },
    });

    cleanupTargets.push({
      fileId: file.fileId,
      auditLogId: getCreatedAuditLogId(audit),
      metadata,
    });
  }

  return cleanupTargets;
}

export function getNewsFileIdByPurpose(
  snapshots: NewsFileSnapshot[],
  purpose: NewsFilePurpose,
) {
  return snapshots.find((file) => file.purpose === purpose)?.fileId ?? null;
}
