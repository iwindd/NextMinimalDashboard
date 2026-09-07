"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, AuditResourceType, NewsRevisionStatus } from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { NewsNotFoundError, NewsPolicyError } from "../exceptions";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { manageNewsActionClient } from "./client";
import { requestNewsChangesSchema } from "./request-news-changes-schema";

export const requestNewsChangesAction = manageNewsActionClient
  .inputSchema(requestNewsChangesSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "ADMIN") {
        return returnActionError({ code: "UNAUTHORIZED", message: "เฉพาะผู้ดูแลระบบเท่านั้นที่ตีกลับข่าวได้" });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: { workingRevision: true },
        });
        if (!target || !target.workingRevision) throw new NewsNotFoundError();
        if (target.deletedAt || target.workingRevision.status !== NewsRevisionStatus.IN_REVIEW) {
          throw new NewsPolicyError("สถานะข่าวนี้ไม่สามารถตีกลับได้");
        }

        await transaction.newsRevision.update({
          where: { id: target.workingRevision.id },
          data: {
            status: NewsRevisionStatus.CHANGES_REQUESTED,
            reviewedById: ctx.actor.id,
            reviewedAt: new Date(),
            reviewReason: parsedInput.reason,
          },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_CHANGES_REQUESTED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          reason: parsedInput.reason,
          after: { revisionId: target.workingRevision.id, status: NewsRevisionStatus.CHANGES_REQUESTED },
        });
      });

      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${parsedInput.newsId}`);
      revalidateNewsNotificationCounts();
      return { id: parsedInput.newsId };
    } catch (error) {
      if (error instanceof NewsNotFoundError || error instanceof NewsPolicyError) {
        return returnActionError({ code: error instanceof NewsNotFoundError ? "NOT_FOUND" : "POLICY", message: error.message });
      }
      throw error;
    }
  });
