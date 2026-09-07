import { FileStorage, type PrismaClient } from "@prisma/client";

export type SeedFileInput = {
  objectKey: string;
  mimeType: string;
  byteSize: number;
  createdById: string;
};

/**
 * Seed images live under `public/` and are shared by several modules, so they are
 * `FileStorage.PUBLIC`: permanently addressable, and deliberately skipped by the
 * detached file cleanup (see `cleanupDetachedFiles`).
 *
 * The returned function caches by object key so one run upserts each image once,
 * and normalizes the metadata so the format and size labels stay truthful no
 * matter which module created the row first.
 */
export function createSeedFileResolver(prisma: PrismaClient) {
  const cache = new Map<string, string>();

  return async function ensureSeedFile(input: SeedFileInput) {
    const cached = cache.get(input.objectKey);
    if (cached) return cached;

    const file = await prisma.fileAsset.upsert({
      where: { objectKey: input.objectKey },
      update: {
        storage: FileStorage.PUBLIC,
        originalName: input.objectKey.split("/").at(-1) ?? "seed-file",
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        createdById: input.createdById,
      },
      create: {
        storage: FileStorage.PUBLIC,
        objectKey: input.objectKey,
        originalName: input.objectKey.split("/").at(-1) ?? "seed-file",
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        createdById: input.createdById,
      },
      select: { id: true },
    });

    cache.set(input.objectKey, file.id);
    return file.id;
  };
}
