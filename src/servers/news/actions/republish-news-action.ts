"use server";

import { AuditAction, AuditResourceType, FileAccess, NewsRevisionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { NewsNotFoundError, NewsPolicyError } from "../exceptions";
import { setNewsRevisionFileAccess } from "../files/sync-news-revision-files";
import { manageNewsActionClient } from "./client";
import { republishNewsSchema } from "./republish-news-schema";

export const republishNewsAction = manageNewsActionClient
  .inputSchema(republishNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      if (ctx.actor.role !== "ADMIN") {
        return returnActionError({
          code: "UNAUTHORIZED",
          message: "เฉพาะผู้ดูแลระบบเท่านั้นที่เผยแพร่ข่าวอีกครั้งได้",
        });
      }

      await prisma.$transaction(async (transaction) => {
        const target = await transaction.news.findUnique({
          where: { id: parsedInput.newsId },
          include: {
            publishedRevision: true,
            workingRevision: { select: { id: true } },
          },
        });
        if (!target) throw new NewsNotFoundError();
        if (target.deletedAt) throw new NewsPolicyError("ข่าวนี้ถูกลบแล้ว");
        if (!target.archivedAt || !target.publishedRevision) {
          throw new NewsPolicyError("ไม่พบข่าวที่จัดเก็บและเผยแพร่อีกครั้งได้");
        }
        if (target.publishedRevision.status !== NewsRevisionStatus.PUBLISHED) {
          throw new NewsPolicyError("ฉบับที่เผยแพร่เดิมไม่อยู่ในสถานะที่เผยแพร่ได้");
        }
        if (target.workingRevision) {
          throw new NewsPolicyError("ข่าวนี้มีฉบับร่างที่ต้องตรวจสอบก่อนเผยแพร่");
        }

        await setNewsRevisionFileAccess(
          transaction,
          target.publishedRevision.id,
          FileAccess.PUBLIC,
        );
        await transaction.news.update({
          where: { id: target.id },
          data: { archivedAt: null },
        });
        await transaction.createAuditLog({
          actor: ctx.actor,
          requestContext: ctx.requestContext,
          action: AuditAction.NEWS_PUBLISHED,
          resourceType: AuditResourceType.NEWS,
          resourceId: target.id,
          reason: "เผยแพร่ข่าวที่จัดเก็บอีกครั้งโดย ADMIN",
          after: {
            archived: false,
            revisionId: target.publishedRevision.id,
            status: NewsRevisionStatus.PUBLISHED,
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
