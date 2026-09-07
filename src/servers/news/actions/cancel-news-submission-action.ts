"use server";

import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  AuditResourceType,
  NewsRevisionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NewsNotFoundError, NewsPolicyError } from "../exceptions";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { cancelNewsSubmissionSchema } from "./cancel-news-submission-schema";
import { manageNewsActionClient } from "./client";

export const cancelNewsSubmissionAction = manageNewsActionClient
  .inputSchema(cancelNewsSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "EDITOR") {
        return returnActionError({
          code: "UNAUTHORIZED",
          message: "เฉพาะ EDITOR เท่านั้นที่ยกเลิกการส่งตรวจสอบได้",
        });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: { workingRevision: true },
        });
        if (
          !target ||
          target.authorId !== ctx.actor.id ||
          !target.workingRevision
        ) {
          throw new NewsNotFoundError();
        }
        if (
          target.deletedAt ||
          target.workingRevision.status !== NewsRevisionStatus.IN_REVIEW
        ) {
          throw new NewsPolicyError(
            "สถานะข่าวนี้ไม่สามารถยกเลิกการส่งตรวจสอบได้",
          );
        }

        await transaction.newsRevision.update({
          where: { id: target.workingRevision.id },
          data: {
            status: NewsRevisionStatus.DRAFT,
            reviewedById: null,
            reviewedAt: null,
            reviewReason: null,
          },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_UPDATED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          reason: "ยกเลิกการส่งตรวจสอบ",
          after: {
            revisionId: target.workingRevision.id,
            status: NewsRevisionStatus.DRAFT,
          },
        });
      });

      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${parsedInput.newsId}`);
      revalidateNewsNotificationCounts();
      return { id: parsedInput.newsId };
    } catch (error) {
      if (
        error instanceof NewsNotFoundError ||
        error instanceof NewsPolicyError
      ) {
        return returnActionError({
          code: error instanceof NewsNotFoundError ? "NOT_FOUND" : "POLICY",
          message: error.message,
        });
      }
      throw error;
    }
  });
