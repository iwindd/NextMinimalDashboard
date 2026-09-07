import { NextResponse } from "next/server";
import { getAdminNotificationCounts } from "@/servers/admin-notifications/queries/get-admin-notification-counts";
import { NewsAuthorizationError } from "@/servers/news/exceptions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAdminNotificationCounts());
  } catch (error) {
    if (error instanceof NewsAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    throw error;
  }
}
