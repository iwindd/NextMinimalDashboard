import { NextResponse } from "next/server";
import { NewsAuthorizationError } from "@/servers/news/exceptions";
import { getNewsDrafts } from "@/servers/news/queries/get-news-drafts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getNewsDrafts());
  } catch (error) {
    if (error instanceof NewsAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
