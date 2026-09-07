"use server";

import { AuditAction, AuditResourceType, FileAccess } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { NewsNotFoundError, NewsPolicyError } from "../exceptions";
import { setNewsRevisionFileAccess } from "../files/sync-news-revision-files";
import { manageNewsActionClient } from "./client";
import { archiveNewsSchema } from "./archive-news-schema";

export const archiveNewsAction = manageNewsActionClient
  .inputSchema(archiveNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "ADMIN") {
        return returnActionError({
          code: "UNAUTHORIZED",
          message: "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดเก็บข่าวได้",
        });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: { publishedRevision: true },
        });
        if (!target) throw new NewsNotFoundError();
        if (target.deletedAt) throw new NewsPolicyError("ข่าวนี้ถูกลบแล้ว");
        if (!target.publishedRevision) {
          throw new NewsPolicyError("จัดเก็บได้เฉพาะข่าวที่เคยเผยแพร่แล้ว");
        }
        if (target.archivedAt) {
          throw new NewsPolicyError("ข่าวนี้ถูกจัดเก็บอยู่แล้ว");
        }

        const archivedAt = new Date();
        await setNewsRevisionFileAccess(
          transaction,
          target.publishedRevision.id,
          FileAccess.PRIVATE,
        );
        await transaction.news.update({
          where: { id: target.id },
          data: { archivedAt },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_ARCHIVED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          reason: parsedInput.note || undefined,
          after: {
            archived: true,
            archivedAt: archivedAt.toISOString(),
            revisionId: target.publishedRevision.id,
            ...(parsedInput.note ? { note: parsedInput.note } : {}),
          },
        });
      });

      revalidatePath("/");
      revalidatePath("/news");
      revalidatePath(`/news/${parsedInput.newsId}`);
      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${parsedInput.newsId}`);
      return { id: parsedInput.newsId };
    } catch (error) {
      if (error instanceof NewsNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: error.message });
      }
      if (error instanceof NewsPolicyError) {
        return returnActionError({ code: "POLICY", message: error.message });
      }
      throw error;
    }
  });
