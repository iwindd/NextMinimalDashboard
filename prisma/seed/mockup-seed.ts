import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { runNewsMockupSeed } from "./mockup/news-seed";
import { MOCKUP_CONTENT_COUNT } from "./shared/mockup-plan";

/**
 * Demonstration News content covering every lifecycle state in every category.
 *
 * Requires `npm run db:seed` to have run first — it reads the users, categories
 * and categories from there rather than creating its own.
 *
 * Destructive to previously seeded News content and its audit history.
 */
export async function runMockupSeed(prisma: PrismaClient) {
  console.log(
    `Starting mockup seeding: ${MOCKUP_CONTENT_COUNT} records per content module...`,
  );

  await runNewsMockupSeed(prisma);

  console.log("Mockup seeding completed successfully!");
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runMockupSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
