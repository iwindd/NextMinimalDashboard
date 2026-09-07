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
import { syncNewsRevisionFiles } from "../files/sync-news-revision-files";
import { manageNewsActionClient } from "./client";
import { newsReviewSchema } from "../helpers";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { submitNewsSchema } from "./submit-news-schema";

export const submitNewsAction = manageNewsActionClient
  .inputSchema(submitNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: {
            workingRevision: {
              include: {
                files: { include: { reference: true } },
              },
            },
            publishedRevision: {
              include: { files: { include: { reference: true } } },
            },
          },
        });
        if (
          !target ||
          (ctx.actor.role === "EDITOR" && target.authorId !== ctx.actor.id)
        ) {
          throw new NewsNotFoundError();
        }
        if (target.deletedAt) {
          throw new NewsPolicyError("ไม่พบฉบับร่างที่ส่งตรวจได้");
        }

        let workingRevision = target.workingRevision;
        if (!workingRevision && target.archivedAt && target.publishedRevision) {
          const latest = await transaction.newsRevision.findFirst({
            where: { newsId: target.id },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const revision = await transaction.newsRevision.create({
            data: {
              newsId: target.id,
              version: (latest?.version ?? 0) + 1,
              status: NewsRevisionStatus.DRAFT,
              title: target.publishedRevision.title,
              excerpt: target.publishedRevision.excerpt,
              bodyHtml: target.publishedRevision.bodyHtml,
              categoryId: target.publishedRevision.categoryId,
              readTimeMinutes: target.publishedRevision.readTimeMinutes,
              source: target.publishedRevision.source ?? undefined,
              createdById: ctx.actor.id,
            },
            select: { id: true },
          });
          const coverFileId =
            target.publishedRevision.files.find(
              (file) => file.purpose === NewsFilePurpose.COVER,
            )?.reference?.fileId ?? null;
          const bodyFileIds = target.publishedRevision.files
            .filter((file) => file.purpose === NewsFilePurpose.BODY)
            .map((file) => file.reference?.fileId)
            .filter((fileId): fileId is string => Boolean(fileId));
          await syncNewsRevisionFiles(transaction, {
            revisionId: revision.id,
            newsId: target.id,
            actor: ctx.actor,
            coverFileId,
            bodyFileIds,
          });
          await transaction.news.update({
            where: { id: target.id },
            data: { workingRevisionId: revision.id },
          });
          workingRevision = {
            ...target.publishedRevision,
            ...revision,
            status: NewsRevisionStatus.DRAFT,
            files: target.publishedRevision.files,
          };
        }

        if (!workingRevision) {
          throw new NewsPolicyError("ไม่พบฉบับร่างที่ส่งตรวจได้");
        }
        const submittableStatuses: NewsRevisionStatus[] = [
          NewsRevisionStatus.DRAFT,
          NewsRevisionStatus.CHANGES_REQUESTED,
        ];
        if (!submittableStatuses.includes(workingRevision.status)) {
          throw new NewsPolicyError("สถานะข่าวนี้ไม่สามารถส่งตรวจได้");
        }
        const validation = newsReviewSchema.safeParse({
          title: workingRevision.title,
          coverFileId:
            workingRevision.files.find(
              (file) => file.purpose === NewsFilePurpose.COVER,
            )?.reference?.fileId ?? null,
          bodyHtml: workingRevision.bodyHtml,
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

        await transaction.newsRevision.update({
          where: { id: workingRevision.id },
          data: {
            status: NewsRevisionStatus.IN_REVIEW,
            submittedAt: new Date(),
            reviewedById: null,
            reviewedAt: null,
            reviewReason: null,
          },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_SUBMITTED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          after: {
            revisionId: workingRevision.id,
            status: NewsRevisionStatus.IN_REVIEW,
          },
        });
      });

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
