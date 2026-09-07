"use server";

import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { AuditAction, AuditResourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NewsPolicyError } from "../exceptions";
import { auditNewsMediaChanges } from "../files/audit-news-media";
import { syncNewsRevisionFiles } from "../files/sync-news-revision-files";
import { extractNewsFileIds, sanitizeNewsBody } from "../helpers";
import { manageNewsActionClient } from "./client";
import { createNewsSchema } from "./create-news-schema";

export const createNewsAction = manageNewsActionClient
  .inputSchema(createNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const result = await prisma.$transaction(async (transaction) => {
        if (parsedInput.categoryId) {
          const category = await transaction.newsCategory.findUnique({
            where: { id: parsedInput.categoryId },
            select: { id: true },
          });
          if (!category) throw new NewsPolicyError("ไม่พบหมวดหมู่ข่าว");
        }
        const bodyHtml = sanitizeNewsBody(parsedInput.bodyHtml ?? "");
        const bodyFileIds = extractNewsFileIds(bodyHtml);

        const news = await transaction.news.create({
          data: { authorId: ctx.actor.id },
          select: { id: true },
        });
        const revision = await transaction.newsRevision.create({
          data: {
            newsId: news.id,
            version: 1,
            title: parsedInput.title,
            excerpt: parsedInput.excerpt || null,
            bodyHtml,
            categoryId: parsedInput.categoryId ?? null,
            readTimeMinutes: parsedInput.readTimeMinutes ?? null,
            source: parsedInput.source,
            createdById: ctx.actor.id,
          },
          select: { id: true },
        });

        const sync = await syncNewsRevisionFiles(transaction, {
          revisionId: revision.id,
          newsId: news.id,
          actor: ctx.actor,
          coverFileId: parsedInput.coverFileId ?? null,
          bodyFileIds,
        });

        if (sync) {
          await auditNewsMediaChanges(transaction, {
            newsId: news.id,
            revisionId: revision.id,
            requestContext: ctx.requestContext,
            actor: ctx.actor,
            sync,
          });
        }

        await transaction.news.update({
          where: { id: news.id },
          data: { workingRevisionId: revision.id },
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_CREATED,
          resourceType: AuditResourceType.NEWS,
          resourceId: news.id,
          after: {
            revisionId: revision.id,
            status: "DRAFT",
            title: parsedInput.title,
          },
        });

        return { id: news.id };
      });

      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${result.id}`);
      return result;
    } catch (error) {
      if (error instanceof NewsPolicyError) {
        return returnActionError({ code: "POLICY", message: error.message });
      }
      throw error;
    }
  });
