import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { ensureSeedAdmin } from "../shared/seed-users";

/**
 * The default seed's only account: the Admin. Editor accounts are created by
 * the mockup seed, since they exist only to author mockup content.
 */
export async function runUsersSeed(prisma: PrismaClient) {
  console.log("Seeding development users...");
  const admin = await ensureSeedAdmin(prisma);
  console.log(`Users seed completed: ${admin.email}.`);
  return admin;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runUsersSeed(prisma);
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
