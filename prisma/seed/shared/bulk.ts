import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The mockup seed writes on the order of ten thousand rows per module, so it
 * builds plain row arrays in memory and inserts them with `createMany` instead of
 * awaiting one round trip per record.
 */
const BULK_CHUNK_SIZE = 1_000;

function chunk<T>(items: readonly T[], size = BULK_CHUNK_SIZE): T[][] {
  if (size <= 0) throw new Error("ขนาด batch ต้องมากกว่า 0");
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

/** Runs `handler` over the rows in batches, in order. */
export async function insertInBatches<T>(
  rows: readonly T[],
  handler: (batch: T[]) => Promise<unknown>,
  size = BULK_CHUNK_SIZE,
) {
  for (const batch of chunk(rows, size)) {
    if (batch.length > 0) await handler(batch);
  }
  return rows.length;
}

/**
 * A parent's `publishedRevisionId` and `workingRevisionId` can only be set once
 * its revisions exist, and `createMany` cannot express a per-row update, so these
 * are the one place the mockup seed still issues one statement per record. They
 * are grouped into interactive transactions to keep the round trips down.
 */
const UPDATE_BATCH_SIZE = 100;

export async function runUpdatesInBatches(
  prisma: PrismaClient,
  updates: Prisma.PrismaPromise<unknown>[],
  size = UPDATE_BATCH_SIZE,
) {
  for (const batch of chunk(updates, size)) {
    if (batch.length > 0) await prisma.$transaction(batch);
  }
  return updates.length;
}
