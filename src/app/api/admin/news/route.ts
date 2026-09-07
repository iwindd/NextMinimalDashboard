import { NextResponse } from "next/server";
import { getNewsList } from "@/servers/news/queries/get-news-list";
import {
  getListNewsQueryInput,
  listNewsSchema,
} from "@/servers/news/queries/get-news-list-schema";
import { NewsAuthorizationError } from "@/servers/news/exceptions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = listNewsSchema.safeParse(
    getListNewsQueryInput(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ message: "พารามิเตอร์การค้นหาไม่ถูกต้อง", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json(await getNewsList(parsed.data));
  } catch (error) {
    if (error instanceof NewsAuthorizationError) return NextResponse.json({ message: error.message }, { status: 403 });
    throw error;
  }
}
