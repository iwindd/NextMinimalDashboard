"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuditResourceType,
  NewsRevisionStatus,
} from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { NewsNotFoundError, NewsPolicyError } from "../exceptions";
import { manageNewsActionClient } from "./client";
import { deleteNewsSchema } from "./delete-news-schema";

export const deleteNewsAction = manageNewsActionClient
  .inputSchema(deleteNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: { workingRevision: true, publishedRevision: true },
        });
        if (!target || target.authorId !== ctx.actor.id) {
          throw new NewsNotFoundError();
        }
        if (target.deletedAt) return;
        if (
          target.publishedRevision ||
          target.workingRevision?.status !== NewsRevisionStatus.DRAFT
        ) {
          throw new NewsPolicyError(
            "เจ้าของลบได้เฉพาะฉบับร่างที่ยังไม่เคยเผยแพร่",
          );
        }

        await transaction.news.update({
          where: { id: target.id },
          data: { deletedAt: new Date(), deletedById: ctx.actor.id },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_DELETED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          after: { deleted: true },
        });
      });

      revalidatePath("/");
      revalidatePath("/news");
      revalidatePath(`/news/${parsedInput.newsId}`);
      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${parsedInput.newsId}`);
      return { id: parsedInput.newsId };
    } catch (error) {
      if (error instanceof NewsNotFoundError || error instanceof NewsPolicyError) {
        return returnActionError({ code: error instanceof NewsNotFoundError ? "NOT_FOUND" : "POLICY", message: error.message });
      }
      throw error;
    }
  });
