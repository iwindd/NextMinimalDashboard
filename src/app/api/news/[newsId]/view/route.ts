import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "simple-dashboard-news-session";

function hashSession(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ newsId: string }> },
) {
  const { newsId } = await params;
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const sessionValue = existingCookie || randomUUID();
  const sessionHash = hashSession(sessionValue);

  let counted = false;
  try {
    counted = await prisma.$transaction(async (transaction) => {
      const news = await transaction.news.findFirst({
        where: {
          id: newsId,
          deletedAt: null,
          archivedAt: null,
          publishedRevision: { is: { status: "PUBLISHED" } },
        },
        select: { id: true },
      });
      if (!news) return false;

      try {
        await transaction.newsViewSession.create({ data: { newsId, sessionHash } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
        throw error;
      }
      await transaction.news.update({ where: { id: newsId }, data: { viewCount: { increment: 1 } } });
      return true;
    });
  } catch {
    return NextResponse.json({ counted: false }, { status: 500 });
  }

  const response = NextResponse.json({ counted });
  if (!existingCookie) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}
