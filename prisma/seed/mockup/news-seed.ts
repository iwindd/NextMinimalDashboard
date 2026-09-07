import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  AuditAction,
  AuditResourceType,
  NewsFilePurpose,
  NewsRevisionStatus,
  type Prisma,
  PrismaClient,
} from "@prisma/client";
import { buildLifecycleAuditRows } from "../shared/audit-rows";
import { insertInBatches, runUpdatesInBatches } from "../shared/bulk";
import {
  CONTENT_CATEGORY_NAMES,
  loadContentCategories,
  requireSeedCategoryId,
} from "../shared/content-categories";
import {
  isLivePublished,
  planLifecycle,
  type PlannedRevision,
} from "../shared/lifecycle";
import {
  buildMockupSlots,
  createSetLabeller,
  MOCKUP_CONTENT_COUNT,
  setTitle,
} from "../shared/mockup-plan";
import { assignPublishYears, withPublishYear } from "../shared/publish-schedule";
import { pickIndex } from "../shared/random";
import { seedRequestContext } from "../shared/request-context";
import { createSeedFileResolver } from "../shared/seed-files";
import { ensureMockupUsers } from "../shared/seed-users";
import newsTemplates from "./data/news.json";

const REQUEST_CONTEXT = seedRequestContext("news");
const REVIEW_REASON = "ขอให้ปรับปรุงรายละเอียดก่อนเผยแพร่";
const ARCHIVE_NOTE = "จัดเก็บเพื่อทบทวนข้อมูลก่อนเผยแพร่อีกครั้ง";
const DELETE_REASON = "ยกเลิกร่างที่ไม่ได้ใช้";
const MAX_SEEDED_VIEWS = 24;

const AUDIT_ACTIONS = {
  CREATED: AuditAction.NEWS_CREATED,
  SUBMITTED: AuditAction.NEWS_SUBMITTED,
  CHANGES_REQUESTED: AuditAction.NEWS_CHANGES_REQUESTED,
  PUBLISHED: AuditAction.NEWS_PUBLISHED,
  SUPERSEDED: AuditAction.NEWS_UPDATED,
  ARCHIVED: AuditAction.NEWS_ARCHIVED,
  DELETED: AuditAction.NEWS_DELETED,
} as const;

/**
 * News has no domain axis beyond the lifecycle and the category, so the mockup
 * varies whether the record cites a source instead.
 */
const NEWS_VARIANTS = [true, false] as const;

type NewsVariant = (typeof NEWS_VARIANTS)[number];

/**
 * Removes previously seeded News content, its categories' audit trail and the
 * file assets only News referenced.
 *
 * Categories themselves belong to the default seed and are left in place.
 */
async function clearNewsMockupData(prisma: PrismaClient) {
  const [newsRecords, files] = await Promise.all([
    prisma.news.findMany({ select: { id: true } }),
    prisma.fileAsset.findMany({
      where: { references: { some: { newsRevisionFileId: { not: null } } } },
      select: { id: true },
    }),
  ]);

  const resourceIds = [
    ...newsRecords.map(({ id }) => id),
    ...files.map(({ id }) => id),
  ];
  if (resourceIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { resourceId: { in: resourceIds } },
    });
  }

  await prisma.news.deleteMany({});
  // Deleting the records above cascades their FileReference rows, so an image
  // another module still points at keeps a reference and survives.
  if (files.length > 0) {
    await prisma.fileAsset.deleteMany({
      where: {
        id: { in: files.map(({ id }) => id) },
        references: { none: {} },
      },
    });
  }
}

export async function runNewsMockupSeed(prisma: PrismaClient) {
  console.log(`Seeding ${MOCKUP_CONTENT_COUNT} mockup news records...`);

  // Prerequisites are read before anything is deleted, so a run against a
  // database that has not had the default seed applied fails without destroying
  // the content that is already there.
  const { admin: adminUser, editors } = await ensureMockupUsers(prisma);
  const categories = await loadContentCategories("ข่าว", async (normalizedName) => {
    const category = await prisma.newsCategory.findUnique({
      where: { normalizedName },
      select: { id: true },
    });
    return category?.id ?? null;
  });

  await clearNewsMockupData(prisma);

  const ensureSeedFile = createSeedFileResolver(prisma);
  const fileIds = new Map<string, string>();
  for (const template of newsTemplates) {
    fileIds.set(
      template.imageUrl,
      await ensureSeedFile({
        objectKey: template.imageUrl,
        mimeType: "image/png",
        byteSize: 0,
        createdById: adminUser.id,
      }),
    );
  }

  const slots = buildMockupSlots<NewsVariant>({
    categories: CONTENT_CATEGORY_NAMES,
    variants: NEWS_VARIANTS,
  });
  const plans = slots.map((slot) => planLifecycle(slot.state));
  const years = assignPublishYears(plans.map(isLivePublished));
  const labelFor = createSetLabeller();

  const parents: Prisma.NewsCreateManyInput[] = [];
  const revisions: Prisma.NewsRevisionCreateManyInput[] = [];
  const revisionFiles: Prisma.NewsRevisionFileCreateManyInput[] = [];
  const references: Prisma.FileReferenceCreateManyInput[] = [];
  const viewSessions: Prisma.NewsViewSessionCreateManyInput[] = [];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const pointerUpdates: Prisma.PrismaPromise<unknown>[] = [];

  slots.forEach((slot, index) => {
    const plan = plans[index];
    // Every category has templates, so a record's text always matches its
    // category instead of borrowing an unrelated headline.
    const categoryTemplates = newsTemplates.filter(
      (template) => template.category === slot.category,
    );
    const template = categoryTemplates[index % categoryTemplates.length];
    const author = editors[index % editors.length];
    const categoryId = requireSeedCategoryId(categories, slot.category);
    const fileId = fileIds.get(template.imageUrl) as string;

    const publishedAt = withPublishYear(
      new Date(template.publishedAt),
      years[index],
    );
    const archivedAt = plan.archived ? new Date(publishedAt) : null;
    const deletedAt = plan.deleted ? new Date(publishedAt) : null;
    const { occurrence } = labelFor(template.title);
    const title = setTitle(template.title, occurrence);
    const viewCount =
      isLivePublished(plan) || plan.archived
        ? pickIndex(MAX_SEEDED_VIEWS + 1)
        : 0;

    const newsId = randomUUID();
    parents.push({
      id: newsId,
      authorId: author.id,
      viewCount,
      archivedAt,
      deletedAt,
      deletedById: plan.deleted ? author.id : null,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    });

    for (let session = 0; session < viewCount; session += 1) {
      viewSessions.push({
        newsId,
        sessionHash: `seed-${newsId}-${session}`,
        createdAt: new Date(publishedAt.getTime() + session * 60_000),
      });
    }

    const revisionIds = new Map<number, string>();
    for (const planned of plan.revisions) {
      const revisionId = randomUUID();
      revisionIds.set(planned.version, revisionId);
      revisions.push(
        buildRevisionRow({
          revisionId,
          newsId,
          planned,
          title,
          template,
          categoryId,
          authorId: author.id,
          reviewerId: adminUser.id,
          publishedAt,
          citesSource: slot.variant,
        }),
      );

      const revisionFileId = randomUUID();
      revisionFiles.push({
        id: revisionFileId,
        revisionId,
        purpose: NewsFilePurpose.COVER,
      });
      references.push({
        fileId,
        // Only the revision the public site currently serves may expose its
        // cover publicly; drafts, archived records and superseded history stay
        // private so the delivery route hides them from anonymous visitors.
        access: planned.live ? "PUBLIC" : "PRIVATE",
        newsRevisionFileId: revisionFileId,
      });
    }

    pointerUpdates.push(
      prisma.news.update({
        where: { id: newsId },
        data: {
          publishedRevisionId:
            plan.publishedVersion === null
              ? null
              : (revisionIds.get(plan.publishedVersion) as string),
          workingRevisionId:
            plan.workingVersion === null
              ? null
              : (revisionIds.get(plan.workingVersion) as string),
        },
      }),
    );

    auditRows.push(
      ...buildLifecycleAuditRows({
        plan,
        resourceId: newsId,
        resourceType: AuditResourceType.NEWS,
        actions: AUDIT_ACTIONS,
        author,
        admin: adminUser,
        revisionIds,
        requestContext: REQUEST_CONTEXT,
        reviewReason: REVIEW_REASON,
        archiveNote: plan.archiveNote ? ARCHIVE_NOTE : undefined,
        deleteReason: DELETE_REASON,
        startedAt: publishedAt,
        archivedAt,
        deletedAt,
      }),
    );
  });

  await insertInBatches(parents, (data) => prisma.news.createMany({ data }));
  await insertInBatches(revisions, (data) =>
    prisma.newsRevision.createMany({ data }),
  );
  await insertInBatches(revisionFiles, (data) =>
    prisma.newsRevisionFile.createMany({ data }),
  );
  await insertInBatches(references, (data) =>
    prisma.fileReference.createMany({ data }),
  );
  await runUpdatesInBatches(prisma, pointerUpdates);
  await insertInBatches(viewSessions, (data) =>
    prisma.newsViewSession.createMany({ data }),
  );
  await insertInBatches(auditRows, (data) =>
    prisma.auditLog.createMany({ data }),
  );

  console.log(
    `News mockup seed completed: ${parents.length} records, ${revisions.length} revisions, ${auditRows.length} audit entries.`,
  );
}

function buildRevisionRow(input: {
  revisionId: string;
  newsId: string;
  planned: PlannedRevision;
  title: string;
  template: (typeof newsTemplates)[number];
  categoryId: string;
  authorId: string;
  reviewerId: string;
  publishedAt: Date;
  citesSource: boolean;
}): Prisma.NewsRevisionCreateManyInput {
  const { planned, template } = input;
  // A superseded revision was published before it was replaced, so it keeps its
  // original `publishedAt`.
  const isPublished =
    planned.status === NewsRevisionStatus.PUBLISHED ||
    planned.status === NewsRevisionStatus.SUPERSEDED;

  return {
    id: input.revisionId,
    newsId: input.newsId,
    version: planned.version,
    status: planned.status,
    // A later revision is an edit in progress, so its title says so.
    title: planned.version > 1 ? `${input.title} (ฉบับแก้ไข)` : input.title,
    excerpt: template.description,
    bodyHtml: `<p>${template.description}</p>`,
    categoryId: input.categoryId,
    readTimeMinutes: template.readTimeMinutes,
    source: input.citesSource
      ? [{ url: "https://www.arda.or.th", title: template.source }]
      : [],
    createdById: input.authorId,
    reviewedById: planned.reviewed ? input.reviewerId : null,
    reviewedAt: planned.reviewed ? input.publishedAt : null,
    reviewReason: planned.hasReviewReason ? REVIEW_REASON : null,
    submittedAt: planned.submitted ? input.publishedAt : null,
    publishedAt: isPublished ? input.publishedAt : null,
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runNewsMockupSeed(prisma);
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
