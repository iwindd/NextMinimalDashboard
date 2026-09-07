import { NextResponse } from "next/server";
import { getUserList } from "@/servers/user/queries/get-user-list";
import { listUsersSchema } from "@/servers/user/queries/get-user-list-schema";
import { UserAuthorizationError } from "@/servers/user/exceptions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedQuery = listUsersSchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: "พารามิเตอร์การค้นหาไม่ถูกต้อง", issues: parsedQuery.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await getUserList(parsedQuery.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UserAuthorizationError) {
      return NextResponse.json(
        { message: "คุณไม่มีสิทธิ์ดูรายการผู้ใช้งาน" },
        { status: 403 },
      );
    }

    throw error;
  }
}
