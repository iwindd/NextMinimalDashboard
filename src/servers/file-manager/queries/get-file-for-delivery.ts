import { FileAccess } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const fileIdSchema = z.uuid();

export async function getFileForDelivery(fileId: string) {
  if (!fileIdSchema.safeParse(fileId).success) return null;

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    include: {
      references: {
        select: {
          id: true,
          access: true,
          newsRevisionFile: {
            select: { revision: { select: { newsId: true } } },
          },
        },
      },
    },
  });
  if (!file) return null;

  const publicReferences = file.references.filter(
    (reference) => reference.access === FileAccess.PUBLIC,
  );

  return {
    file,
    isPublic: publicReferences.length > 0,
    newsId: publicReferences.find((reference) => reference.newsRevisionFile)
      ?.newsRevisionFile?.revision.newsId ?? null,
  };
}
