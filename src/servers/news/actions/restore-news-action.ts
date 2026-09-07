"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, AuditResourceType, FileAccess } from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { NewsNotFoundError } from "../exceptions";
import { setNewsRevisionFileAccess } from "../files/sync-news-revision-files";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { manageNewsActionClient } from "./client";
import { restoreNewsSchema } from "./restore-news-schema";

export const restoreNewsAction = manageNewsActionClient
  .inputSchema(restoreNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "ADMIN") {
        return returnActionError({ code: "UNAUTHORIZED", message: "เฉพาะผู้ดูแลระบบเท่านั้นที่กู้คืนข่าวได้" });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
        });
        if (!target) throw new NewsNotFoundError();
        if (!target.deletedAt) return;

        await transaction.news.update({
          where: { id: target.id },
          data: { deletedAt: null, deletedById: null },
        });
        if (target.publishedRevisionId) {
          await setNewsRevisionFileAccess(
            transaction,
            target.publishedRevisionId,
            FileAccess.PUBLIC,
          );
        }
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_RESTORED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          after: { deleted: false },
        });
      });

      revalidatePath("/");
      revalidatePath("/news");
      revalidatePath(`/news/${parsedInput.newsId}`);
      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${parsedInput.newsId}`);
      revalidateNewsNotificationCounts();
      return { id: parsedInput.newsId };
    } catch (error) {
      if (error instanceof NewsNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: error.message });
      }
      throw error;
    }
  });
