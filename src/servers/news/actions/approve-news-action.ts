"use server";

import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  AuditResourceType,
  NewsFilePurpose,
  NewsRevisionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  NewsNotFoundError,
  NewsPolicyError,
  NewsReviewValidationError,
} from "../exceptions";
import { newsReviewSchema } from "../helpers";
import { publishNewsRevision } from "../publish-news-revision";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { approveNewsSchema } from "./approve-news-schema";
import { manageNewsActionClient } from "./client";

export const approveNewsAction = manageNewsActionClient
  .inputSchema(approveNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "ADMIN") {
        return returnActionError({
          code: "UNAUTHORIZED",
          message: "เฉพาะผู้ดูแลระบบเท่านั้นที่เผยแพร่ข่าวได้",
        });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: {
            workingRevision: {
              include: {
                files: {
                  where: { purpose: NewsFilePurpose.COVER },
                  include: { reference: true },
                },
              },
            },
            publishedRevision: true,
          },
        });
        if (!target) throw new NewsNotFoundError();
        if (target.deletedAt || !target.workingRevision)
          throw new NewsPolicyError("ไม่พบฉบับร่างที่เผยแพร่ได้");
        if (
          target.workingRevision.status === NewsRevisionStatus.CHANGES_REQUESTED
        ) {
          throw new NewsPolicyError("กรุณาส่งข่าวตรวจสอบอีกครั้งก่อนเผยแพร่");
        }
        if (!target.workingRevision.files[0]?.reference)
          throw new NewsPolicyError("กรุณาเพิ่มรูปปกก่อนเผยแพร่ข่าว");

        const validation = newsReviewSchema.safeParse({
          title: target.workingRevision.title,
          coverFileId: target.workingRevision.files[0].reference.fileId,
          bodyHtml: target.workingRevision.bodyHtml,
        });
        if (!validation.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of validation.error.issues) {
            const field = issue.path[0];
            if (typeof field === "string" && !fieldErrors[field]) {
              fieldErrors[field] = issue.message;
            }
          }
          throw new NewsReviewValidationError(fieldErrors);
        }
        const publishableStatuses: NewsRevisionStatus[] = [
          NewsRevisionStatus.DRAFT,
          NewsRevisionStatus.IN_REVIEW,
        ];
        if (!publishableStatuses.includes(target.workingRevision.status)) {
          throw new NewsPolicyError("สถานะข่าวนี้ไม่สามารถเผยแพร่ได้");
        }

        await publishNewsRevision(transaction, {
          newsId: target.id,
          revisionId: target.workingRevision.id,
          previousRevisionId: target.publishedRevision?.id ?? null,
          reviewedById: ctx.actor.id,
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_PUBLISHED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          after: {
            revisionId: target.workingRevision.id,
            status: NewsRevisionStatus.PUBLISHED,
          },
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
      if (error instanceof NewsReviewValidationError) {
        return returnActionError({
          code: "VALIDATION",
          message: error.message,
          fieldErrors: error.fieldErrors,
        });
      }
      if (error instanceof NewsNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: error.message });
      }
      if (error instanceof NewsPolicyError) {
        return returnActionError({ code: "POLICY", message: error.message });
      }
      throw error;
    }
  });
