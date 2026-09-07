import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestContext } from "@/lib/audit/request-context";
import { requireManageNews } from "@/servers/news/authorization";
import {
  NewsAuthorizationError,
  NewsNotFoundError,
  NewsPolicyError,
  NewsReviewValidationError,
} from "@/servers/news/exceptions";
import {
  type PendingNewsFiles,
  saveNews,
} from "@/servers/news/save-news";
import { updateNewsSchema } from "@/servers/news/actions/update-news-schema";
import { FileValidationError } from "@/servers/file-manager/exceptions";
import { revalidateNewsNotificationCounts } from "@/servers/news/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ newsId: string }> },
) {
  try {
    const actor = await requireManageNews();
    const { newsId } = await params;
    const formData = await request.formData();
    const payload = formData.get("payload");

    if (typeof payload !== "string") {
      return NextResponse.json(
        { serverError: { code: "VALIDATION", message: "ข้อมูลข่าวไม่ถูกต้อง" } },
        { status: 400 },
      );
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { serverError: { code: "VALIDATION", message: "ข้อมูลข่าวไม่ถูกต้อง" } },
        { status: 400 },
      );
    }

    const parsedInput = updateNewsSchema.safeParse({
      ...(parsedPayload && typeof parsedPayload === "object"
        ? parsedPayload
        : {}),
      newsId,
    });
    if (!parsedInput.success) {
      const flattened = parsedInput.error.flatten();
      return NextResponse.json(
        {
          validationErrors: {
            formErrors: flattened.formErrors,
            fieldErrors: flattened.fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const coverEntry = formData.get("coverFile");
    if (coverEntry !== null && !(coverEntry instanceof File)) {
      return NextResponse.json(
        {
          serverError: {
            code: "VALIDATION",
            message: "รูปปกข่าวไม่ถูกต้อง",
          },
        },
        { status: 400 },
      );
    }

    const bodyFiles = new Map<string, File>();
    for (const [name, value] of formData.entries()) {
      if (!name.startsWith("bodyFile:")) continue;
      if (!(value instanceof File)) {
        return NextResponse.json(
          {
            serverError: {
              code: "VALIDATION",
              message: "รูปภาพในเนื้อหาข่าวไม่ถูกต้อง",
            },
          },
          { status: 400 },
        );
      }
      bodyFiles.set(name.slice("bodyFile:".length), value);
    }

    const pendingFiles: PendingNewsFiles | undefined =
      coverEntry instanceof File || bodyFiles.size > 0
        ? {
            coverFile: coverEntry instanceof File ? coverEntry : undefined,
            bodyFiles,
          }
        : undefined;

    const result = await saveNews({
      input: parsedInput.data,
      actor,
      requestContext: await getRequestContext(),
      pendingFiles,
    });

    if (result.autoPublished) {
      revalidatePath("/");
      revalidatePath("/news");
      revalidatePath(`/news/${result.id}`);
    }
    revalidatePath("/admin/news");
    revalidatePath(`/admin/news/${result.id}`);
    revalidateNewsNotificationCounts();

    return NextResponse.json({
      data: { id: result.id, revisionId: result.revisionId },
    });
  } catch (error) {
    if (error instanceof NewsAuthorizationError) {
      return NextResponse.json(
        { serverError: { code: "UNAUTHORIZED", message: error.message } },
        { status: 403 },
      );
    }
    if (error instanceof NewsNotFoundError) {
      return NextResponse.json(
        { serverError: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof NewsPolicyError) {
      return NextResponse.json(
        { serverError: { code: "POLICY", message: error.message } },
        { status: 400 },
      );
    }
    if (error instanceof NewsReviewValidationError) {
      return NextResponse.json(
        {
          serverError: {
            code: "VALIDATION",
            message: error.message,
            fieldErrors: error.fieldErrors,
          },
        },
        { status: 400 },
      );
    }
    if (error instanceof FileValidationError) {
      return NextResponse.json(
        { serverError: { code: "VALIDATION", message: error.message } },
        { status: 400 },
      );
    }
    throw error;
  }
}
