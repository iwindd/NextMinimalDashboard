import { randomUUID } from "node:crypto";
import {
  AuditAction,
  AuditResourceType,
  NewsFilePurpose,
  NewsRevisionStatus,
} from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/lib/audit/request-context";
import {
  createFileAssetInTransaction,
  type StoredFileObject,
} from "@/servers/file-manager/files/create-file";
import {
  getImageFileExtension,
  validateImageFile,
} from "@/servers/file-manager/helpers";
import { getFileStorage, putFile } from "@/servers/file-manager/storage";
import type { NewsActor } from "./authorization";
import {
  NewsNotFoundError,
  NewsPolicyError,
  NewsReviewValidationError,
} from "./exceptions";
import { cleanupDetachedFiles } from "@/servers/file-manager/files/cleanup-detached-files";
import type { DetachedFileCleanup } from "@/servers/file-manager/files/file-delete-policy";
import {
  auditNewsMediaChanges,
  getNewsFileIdByPurpose,
} from "./files/audit-news-media";
import {
  extractNewsFileIds,
  newsReviewSchema,
  sanitizeNewsBody,
} from "./helpers";
import {
  syncNewsRevisionFiles,
  type NewsFileSnapshot,
} from "./files/sync-news-revision-files";
import { publishNewsRevision } from "./publish-news-revision";
import { updateNewsSchema } from "./actions/update-news-schema";

type NewsUpdateInput = z.infer<typeof updateNewsSchema>;

export type PendingNewsFiles = {
  coverFile?: File;
  bodyFiles: Map<string, File>;
};

type NewsTransaction = Pick<
  typeof prisma,
  | "news"
  | "newsCategory"
  | "newsRevision"
  | "newsRevisionFile"
  | "fileAsset"
  | "fileReference"
  | "createAuditLog"
>;

type SaveNewsOptions = {
  input: NewsUpdateInput;
  actor: NewsActor;
  requestContext: RequestContext;
  pendingFiles?: PendingNewsFiles;
};

type SaveNewsTransactionOptions = SaveNewsOptions & {
  onObjectCreated?: (object: StoredFileObject) => void;
};

export type SaveNewsResult = {
  id: string;
  revisionId: string;
  autoPublished: boolean;
  cleanupTargets: DetachedFileCleanup[];
};

const NEWS_UPLOAD_MARKER = /__NEWS_UPLOAD_([A-Za-z0-9_-]+)__/g;

async function createPendingNewsFile(
  transaction: NewsTransaction,
  input: {
    file: File;
    actor: NewsActor;
    requestContext: RequestContext;
    newsId: string;
    purpose: NewsFilePurpose;
    onObjectCreated?: (object: StoredFileObject) => void;
  },
) {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  validateImageFile(input.file, bytes);
  const extension = getImageFileExtension(input.file.type);
  if (!extension) {
    throw new NewsPolicyError("รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
  }

  const storage = getFileStorage();
  const objectKey = `files/${randomUUID()}${extension}`;
  await putFile({
    storage,
    objectKey,
    bytes,
    mimeType: input.file.type,
  });
  input.onObjectCreated?.({ storage, objectKey });

  return createFileAssetInTransaction(transaction, {
    actor: input.actor,
    requestContext: input.requestContext,
    storage,
    objectKey,
    originalName: input.file.name,
    mimeType: input.file.type,
    byteSize: input.file.size,
    metadata: {
      newsId: input.newsId,
      purpose: input.purpose,
    },
  });
}

async function resolvePendingFiles(
  transaction: NewsTransaction,
  input: SaveNewsTransactionOptions & { newsId: string },
) {
  let bodyHtml = input.input.bodyHtml ?? "";
  let coverFileId = input.input.coverFileId ?? null;

  if (!input.pendingFiles) {
    return { bodyHtml, coverFileId };
  }

  if (input.pendingFiles.coverFile && coverFileId) {
    throw new NewsPolicyError("ไม่สามารถส่งรูปปกใหม่พร้อมรูปปกเดิมได้");
  }

  if (input.pendingFiles.coverFile) {
    const created = await createPendingNewsFile(transaction, {
      file: input.pendingFiles.coverFile,
      actor: input.actor,
      requestContext: input.requestContext,
      newsId: input.newsId,
      purpose: NewsFilePurpose.COVER,
      onObjectCreated: input.onObjectCreated,
    });
    coverFileId = created.id;
  }

  const markerKeys = [
    ...new Set(
      Array.from(bodyHtml.matchAll(NEWS_UPLOAD_MARKER), (match) => match[1]),
    ),
  ];
  const replacements = new Map<string, string>();

  for (const key of markerKeys) {
    const file = input.pendingFiles.bodyFiles.get(key);
    if (!file) {
      throw new NewsPolicyError("ไม่พบไฟล์รูปภาพในเนื้อหาข่าว");
    }

    const created = await createPendingNewsFile(transaction, {
      file,
      actor: input.actor,
      requestContext: input.requestContext,
      newsId: input.newsId,
      purpose: NewsFilePurpose.BODY,
      onObjectCreated: input.onObjectCreated,
    });
    replacements.set(
      `__NEWS_UPLOAD_${key}__`,
      `/api/files/${created.id}`,
    );
  }

  for (const [marker, url] of replacements) {
    bodyHtml = bodyHtml.replaceAll(marker, url);
  }

  return { bodyHtml, coverFileId };
}

function buildMediaState(
  revisionId: string | null,
  title: string | null,
  snapshots: NewsFileSnapshot[],
) {
  return {
    revisionId,
    title,
    coverFileId: getNewsFileIdByPurpose(snapshots, NewsFilePurpose.COVER),
    bodyFileIds: snapshots
      .filter((file) => file.purpose === NewsFilePurpose.BODY)
      .map((file) => file.fileId),
  };
}

async function saveNewsInTransaction(
  transaction: NewsTransaction,
  input: SaveNewsTransactionOptions,
): Promise<SaveNewsResult> {
  const target = await transaction.news.findUnique({
    where: { id: input.input.newsId },
    include: { workingRevision: true, publishedRevision: true },
  });
  if (
    !target ||
    (input.actor.role === "EDITOR" && target.authorId !== input.actor.id)
  ) {
    throw new NewsNotFoundError();
  }
  if (target.deletedAt) throw new NewsPolicyError("ข่าวนี้ถูกลบแล้ว");

  const autoPublish = Boolean(
    target.publishedRevision &&
      !target.archivedAt &&
      target.workingRevision?.status !== NewsRevisionStatus.CHANGES_REQUESTED,
  );

  if (input.input.categoryId) {
    const category = await transaction.newsCategory.findUnique({
      where: { id: input.input.categoryId },
      select: { id: true },
    });
    if (!category) throw new NewsPolicyError("ไม่พบหมวดหมู่ข่าว");
  }

  let revisionId = target.workingRevision?.id;
  if (
    target.workingRevision?.status === NewsRevisionStatus.IN_REVIEW &&
    input.actor.role !== "ADMIN"
  ) {
    throw new NewsPolicyError("ข่าวที่ส่งตรวจแล้วไม่สามารถแก้ไขได้");
  }
  if (
    target.workingRevision?.status === NewsRevisionStatus.CHANGES_REQUESTED &&
    input.actor.role === "ADMIN"
  ) {
    throw new NewsPolicyError(
      "ข่าวที่รอแก้ไขต้องให้ผู้เขียนส่งตรวจสอบอีกครั้งก่อนดำเนินการต่อ",
    );
  }
  if (
    target.workingRevision &&
    ([NewsRevisionStatus.PUBLISHED, NewsRevisionStatus.SUPERSEDED] as NewsRevisionStatus[]).includes(
      target.workingRevision.status,
    )
  ) {
    throw new NewsPolicyError("revision ที่เผยแพร่แล้วไม่สามารถแก้ไขได้");
  }

  const resolved = await resolvePendingFiles(transaction, {
    ...input,
    newsId: target.id,
  });
  const bodyHtml = sanitizeNewsBody(resolved.bodyHtml);
  const bodyFileIds = extractNewsFileIds(bodyHtml);

  if (autoPublish) {
    const validation = newsReviewSchema.safeParse({
      title: input.input.title,
      coverFileId: resolved.coverFileId,
      bodyHtml,
    });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      throw new NewsReviewValidationError(fieldErrors);
    }
  }

  if (!revisionId) {
    if (!target.publishedRevision) {
      throw new NewsPolicyError("ไม่พบฉบับที่กำลังแก้ไข");
    }
    const latest = await transaction.newsRevision.findFirst({
      where: { newsId: target.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const revision = await transaction.newsRevision.create({
      data: {
        newsId: target.id,
        version: (latest?.version ?? 0) + 1,
        status: NewsRevisionStatus.DRAFT,
        title: input.input.title,
        excerpt: input.input.excerpt || null,
        bodyHtml,
        categoryId: input.input.categoryId ?? null,
        readTimeMinutes: input.input.readTimeMinutes ?? null,
        source: input.input.source,
        createdById: input.actor.id,
      },
      select: { id: true },
    });
    revisionId = revision.id;
    await transaction.news.update({
      where: { id: target.id },
      data: { workingRevisionId: revision.id },
    });
  } else {
    await transaction.newsRevision.update({
      where: { id: revisionId },
      data: {
        title: input.input.title,
        excerpt: input.input.excerpt || null,
        bodyHtml,
        categoryId: input.input.categoryId ?? null,
        readTimeMinutes: input.input.readTimeMinutes ?? null,
        source: input.input.source,
      },
    });
  }

  const sync = (await syncNewsRevisionFiles(transaction, {
    revisionId,
    newsId: target.id,
    actor: input.actor,
    coverFileId: resolved.coverFileId,
    bodyFileIds,
  })) ?? {
    before: [],
    after: [],
    attached: [],
    detached: [],
  };
  const cleanupTargets = await auditNewsMediaChanges(transaction, {
    newsId: target.id,
    revisionId,
    requestContext: input.requestContext,
    actor: input.actor,
    sync,
  });

  const previousRevision = target.workingRevision ?? target.publishedRevision;
  await transaction.createAuditLog({
    actor: input.actor,
    requestContext: input.requestContext,
    action: AuditAction.NEWS_UPDATED,
    resourceType: AuditResourceType.NEWS,
    resourceId: target.id,
    before: buildMediaState(
      previousRevision?.id ?? null,
      previousRevision?.title ?? null,
      sync.before,
    ),
    after: buildMediaState(revisionId, input.input.title, sync.after),
  });

  let autoPublished = false;
  if (autoPublish) {
    await publishNewsRevision(transaction, {
      newsId: target.id,
      revisionId,
      previousRevisionId: target.publishedRevision?.id ?? null,
      reviewedById: null,
    });
    await transaction.createAuditLog({
      actor: input.actor,
      requestContext: input.requestContext,
      action: AuditAction.NEWS_PUBLISHED,
      resourceType: AuditResourceType.NEWS,
      resourceId: target.id,
      reason: "เผยแพร่อัตโนมัติหลังบันทึก",
      after: {
        revisionId,
        status: NewsRevisionStatus.PUBLISHED,
      },
    });
    autoPublished = true;
  }

  return {
    id: target.id,
    revisionId,
    autoPublished,
    cleanupTargets,
  };
}

export async function saveNews(input: SaveNewsOptions) {
  const createdObjects: StoredFileObject[] = [];
  let committed = false;

  try {
    const result = await prisma.$transaction((transaction) =>
      saveNewsInTransaction(transaction, {
        ...input,
        onObjectCreated: (object) => createdObjects.push(object),
      }),
    );
    committed = true;
    try {
      await cleanupDetachedFiles(result.cleanupTargets, {
        actor: input.actor,
        requestContext: input.requestContext,
        source: "NEWS",
      });
    } catch (cleanupError) {
      console.error("Failed to finish detached news media cleanup", {
        targets: result.cleanupTargets,
        error: cleanupError,
      });
    }
    return result;
  } catch (error) {
    if (!committed && createdObjects.length > 0) {
      const { deleteFile } = await import("@/servers/file-manager/storage");
      await Promise.all(
        createdObjects.map((object) =>
          deleteFile(object).catch((cleanupError) => {
            console.error("Failed to clean up an uncommitted news media object", {
              object,
              error: cleanupError,
            });
          }),
        ),
      );
    }
    throw error;
  }
}
