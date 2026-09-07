"use server";

import { returnActionError } from "@/lib/action-client";
import { revalidatePath } from "next/cache";
import {
  NewsNotFoundError,
  NewsPolicyError,
  NewsReviewValidationError,
} from "../exceptions";
import { saveNews } from "../save-news";
import { revalidateNewsNotificationCounts } from "../revalidate";
import { manageNewsActionClient } from "./client";
import { updateNewsSchema } from "./update-news-schema";

export const updateNewsAction = manageNewsActionClient
  .inputSchema(updateNewsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const result = await saveNews({
        input: parsedInput,
        actor: ctx.actor,
        requestContext: ctx.requestContext,
      });

      if (result.autoPublished) {
        revalidatePath("/");
        revalidatePath("/news");
        revalidatePath(`/news/${result.id}`);
      }
      revalidatePath("/admin/news");
      revalidatePath(`/admin/news/${result.id}`);
      revalidateNewsNotificationCounts();
      return { id: result.id, revisionId: result.revisionId };
    } catch (error) {
      if (error instanceof NewsNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: error.message });
      }
      if (error instanceof NewsPolicyError) {
        return returnActionError({ code: "POLICY", message: error.message });
      }
      if (error instanceof NewsReviewValidationError) {
        return returnActionError({
          code: "VALIDATION",
          message: error.message,
          fieldErrors: error.fieldErrors,
        });
      }
      throw error;
    }
  });
