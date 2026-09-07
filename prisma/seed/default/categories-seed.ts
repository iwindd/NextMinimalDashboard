import "dotenv/config";
import { pathToFileURL } from "node:url";
import {
  AuditAction,
  AuditResourceType,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import {
  CONTENT_CATEGORY_NAMES,
  seedContentCategories,
} from "../shared/content-categories";
import { seedRequestContext } from "../shared/request-context";
import { requireSeedAdmin } from "../shared/seed-users";

const REQUEST_CONTEXT = seedRequestContext("categories");

/** The subset of the News category delegate this seed uses. */
type CategoryDelegate = {
  findUnique(args: {
    where: { normalizedName: string };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  update(args: {
    where: { id: string };
    data: { name: string };
  }): Promise<unknown>;
  create(args: {
    data: { name: string; normalizedName: string; createdById: string };
    select: { id: true };
  }): Promise<{ id: string }>;
};

/**
 * News is the only retained content module, so its taxonomy is seeded here.
 */
const CATEGORY_MODULES: {
  label: string;
  delegate: (prisma: PrismaClient) => CategoryDelegate;
  action: AuditAction;
  resourceType: AuditResourceType;
}[] = [
  {
    label: "news",
    delegate: (prisma) => prisma.newsCategory,
    action: AuditAction.NEWS_CATEGORY_CREATED,
    resourceType: AuditResourceType.NEWS_CATEGORY,
  },
];

/**
 * Creates the News taxonomy.
 *
 * Idempotent: an existing category keeps its id and its original audit entry, so
 * re-running the default seed never orphans the content that points at it. Only a
 * category this run actually creates gets a `*_CATEGORY_CREATED` audit row.
 */
export async function runCategoriesSeed(
  prisma: PrismaClient,
  actor?: { id: string; role: UserRole },
) {
  console.log("Seeding content categories...");

  const author = actor ?? (await requireSeedAdmin(prisma));

  for (const module of CATEGORY_MODULES) {
    const delegate = module.delegate(prisma);

    await seedContentCategories(async ({ name, normalizedName }) => {
      const existing = await delegate.findUnique({
        where: { normalizedName },
        select: { id: true },
      });
      if (existing) {
        // Keep the display name in step with the taxonomy without touching the
        // creator or the original audit trail.
        await delegate.update({ where: { id: existing.id }, data: { name } });
        return existing.id;
      }

      const category = await delegate.create({
        data: { name, normalizedName, createdById: author.id },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: {
          actorUserId: author.id,
          actorRole: author.role,
          action: module.action,
          resourceType: module.resourceType,
          resourceId: category.id,
          after: { name },
          ...REQUEST_CONTEXT,
        },
      });
      return category.id;
    });
  }

  console.log(
    `News categories seed completed: ${CONTENT_CATEGORY_NAMES.length} categories.`,
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runCategoriesSeed(prisma);
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
