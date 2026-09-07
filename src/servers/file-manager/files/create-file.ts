import { randomUUID } from "node:crypto";
import { AuditAction, AuditResourceType, FileStorage } from "@prisma/client";
import type { FileManagerActor } from "../authorization";
import { getFileUrl } from "../helpers";
import { deleteFile, getFileStorage, putFile } from "../storage";
import type { FileItem } from "../types";
import type { RequestContext } from "@/lib/audit/request-context";
import { prisma } from "@/lib/prisma";

type FileTransaction = Pick<typeof prisma, "fileAsset" | "createAuditLog">;

export type StoredFileObject = {
  storage: FileStorage;
  objectKey: string;
};

export async function createFileAssetInTransaction(
  transaction: FileTransaction,
  input: {
    actor: FileManagerActor;
    requestContext: RequestContext;
    storage: FileStorage;
    objectKey: string;
    originalName: string;
    mimeType: string;
    byteSize: number;
    metadata?: Record<string, string>;
  },
) {
  const created = await transaction.fileAsset.create({
    data: {
      storage: input.storage,
      objectKey: input.objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      createdById: input.actor.id,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      byteSize: true,
    },
  });

  await transaction.createAuditLog({
    actor: input.actor,
    requestContext: input.requestContext,
    action: AuditAction.FILE_UPLOADED,
    resourceType: AuditResourceType.FILE,
    resourceId: created.id,
    after: {
      storage: input.storage,
      objectKey: input.objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
    },
    metadata: input.metadata,
  });

  return created;
}

export async function createFile(input: {
  actor: FileManagerActor;
  requestContext: RequestContext;
  bytes: Uint8Array;
  originalName: string;
  mimeType: string;
  byteSize: number;
  extension: string;
}): Promise<FileItem> {
  const storage = getFileStorage();
  const objectKey = `files/${randomUUID()}${input.extension}`;
  await putFile({
    storage,
    objectKey,
    bytes: input.bytes,
    mimeType: input.mimeType,
  });

  try {
    const file = await prisma.$transaction((transaction) =>
      createFileAssetInTransaction(transaction, {
        actor: input.actor,
        requestContext: input.requestContext,
        storage,
        objectKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
      }),
    );

    return { ...file, url: getFileUrl(file) };
  } catch (error) {
    await deleteFile({ storage, objectKey }).catch(() => undefined);
    throw error;
  }
}
