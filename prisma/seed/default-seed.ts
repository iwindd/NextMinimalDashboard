import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { runCategoriesSeed } from "./default/categories-seed";
import { runUsersSeed } from "./default/users-seed";

/**
 * The baseline a fresh install needs to be usable, and nothing else: accounts,
 * the News taxonomy.
 *
 * Deliberately contains no News content. Run `npm run db:seed:mockup` for that.
 *
 * Safe to re-run.
 */
export async function runDefaultSeed(prisma: PrismaClient) {
  console.log("Starting default database seeding...");

  const admin = await runUsersSeed(prisma);

  await runCategoriesSeed(prisma, admin);

  console.log("Default database seeding completed successfully!");
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runDefaultSeed(prisma);
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
