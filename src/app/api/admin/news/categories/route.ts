import { NextResponse } from "next/server";
import { getNewsCategories } from "@/servers/news-category/queries/get-news-categories";
import { listNewsCategoriesSchema } from "@/servers/news-category/queries/get-news-categories-schema";
import { NewsAuthorizationError } from "@/servers/news/exceptions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = listNewsCategoriesSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ message: "พารามิเตอร์การค้นหาไม่ถูกต้อง", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json(await getNewsCategories(parsed.data));
  } catch (error) {
    if (error instanceof NewsAuthorizationError) return NextResponse.json({ message: error.message }, { status: 403 });
    throw error;
  }
}
