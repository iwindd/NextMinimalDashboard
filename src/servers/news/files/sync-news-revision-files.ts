import {
  FileAccess,
  NewsFilePurpose,
  UserRole,
} from "@prisma/client";
import type { prisma } from "@/lib/prisma";
import { NewsPolicyError } from "../exceptions";
import type { NewsActor } from "../authorization";

type Transaction = Pick<
  typeof prisma,
  "fileAsset" | "fileReference" | "newsRevisionFile"
>;

export type NewsFileSnapshot = {
  fileId: string;
  purpose: NewsFilePurpose;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

export type NewsFileSyncResult = {
  before: NewsFileSnapshot[];
  after: NewsFileSnapshot[];
  attached: NewsFileSnapshot[];
  detached: NewsFileSnapshot[];
};

function snapshotKey(file: NewsFileSnapshot) {
  return `${file.fileId}:${file.purpose}`;
}

function snapshotFromFile(
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    byteSize: number;
  },
  purpose: NewsFilePurpose,
): NewsFileSnapshot {
  return {
    fileId: file.id,
    purpose,
    originalName: file.originalName,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
  };
}

async function getCurrentSnapshots(
  transaction: Transaction,
  revisionId: string,
): Promise<NewsFileSnapshot[]> {
  const current = await transaction.newsRevisionFile.findMany({
    where: { revisionId },
    include: {
      reference: {
        include: {
          file: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              byteSize: true,
            },
          },
        },
      },
    },
  });

  return current.flatMap((item) =>
    item.reference
      ? [snapshotFromFile(item.reference.file, item.purpose)]
      : [],
  );
}

export async function syncNewsRevisionFiles(
  transaction: Transaction,
  input: {
    revisionId: string;
    newsId: string;
    actor: NewsActor;
    coverFileId: string | null;
    bodyFileIds: string[];
    access?: FileAccess;
  },
): Promise<NewsFileSyncResult> {
  const bodyFileIds = [...new Set(input.bodyFileIds)];
  const fileIds = [
    ...new Set(
      [input.coverFileId, ...bodyFileIds].filter(
        (fileId): fileId is string => Boolean(fileId),
      ),
    ),
  ];

  const existingFiles =
    fileIds.length > 0
      ? await transaction.fileAsset.findMany({
          where: {
            id: { in: fileIds },
            ...(input.actor.role === UserRole.EDITOR
              ? {
                  OR: [
                    { createdById: input.actor.id },
                    {
                      references: {
                        some: {
                          newsRevisionFile: {
                            is: { revision: { newsId: input.newsId } },
                          },
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            byteSize: true,
          },
        })
      : [];

  if (existingFiles.length !== fileIds.length) {
    throw new NewsPolicyError("พบไฟล์ข่าวที่ไม่ถูกต้อง");
  }

  const fileById = new Map(existingFiles.map((file) => [file.id, file]));
  const before = await getCurrentSnapshots(transaction, input.revisionId);
  const after: NewsFileSnapshot[] = [
    ...(input.coverFileId
      ? [
          snapshotFromFile(
            fileById.get(input.coverFileId)!,
            NewsFilePurpose.COVER,
          ),
        ]
      : []),
    ...bodyFileIds.map((fileId) =>
      snapshotFromFile(fileById.get(fileId)!, NewsFilePurpose.BODY),
    ),
  ];

  const beforeKeys = new Set(before.map(snapshotKey));
  const afterKeys = new Set(after.map(snapshotKey));
  const attached = after.filter((file) => !beforeKeys.has(snapshotKey(file)));
  const detached = before.filter((file) => !afterKeys.has(snapshotKey(file)));

  await transaction.newsRevisionFile.deleteMany({
    where: { revisionId: input.revisionId },
  });

  const access = input.access ?? FileAccess.PRIVATE;
  const references = [
    ...(input.coverFileId
      ? [{ fileId: input.coverFileId, purpose: NewsFilePurpose.COVER }]
      : []),
    ...bodyFileIds.map((fileId) => ({
      fileId,
      purpose: NewsFilePurpose.BODY,
    })),
  ];

  for (const reference of references) {
    await transaction.newsRevisionFile.create({
      data: {
        revisionId: input.revisionId,
        purpose: reference.purpose,
        reference: {
          create: { fileId: reference.fileId, access },
        },
      },
    });
  }

  return { before, after, attached, detached };
}

export async function setNewsRevisionFileAccess(
  transaction: Transaction,
  revisionId: string,
  access: FileAccess,
) {
  await transaction.fileReference.updateMany({
    where: { newsRevisionFile: { revisionId } },
    data: { access },
  });
}
