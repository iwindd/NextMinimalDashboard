import { FileStorage } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  canAccessPrivateFile,
  getFileManagerActor,
} from "@/servers/file-manager/authorization";
import { buildContentDisposition } from "@/servers/file-manager/helpers";
import { getFileForDelivery } from "@/servers/file-manager/queries/get-file-for-delivery";
import { getFile } from "@/servers/file-manager/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const delivery = await getFileForDelivery(fileId);
  if (!delivery) return new NextResponse("Not found", { status: 404 });

  if (!delivery.isPublic) {
    const actor = await getFileManagerActor();
    if (!actor || !(await canAccessPrivateFile(actor, fileId))) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const { file } = delivery;
  if (file.storage === FileStorage.PUBLIC) {
    // Legacy PUBLIC objects live under the web root and are permanently
    // addressable. Never disclose their raw path through an authorized private
    // request; revocable uploads must use LOCAL or S3 storage instead.
    if (!delivery.isPublic) {
      return new NextResponse("Not found", { status: 404 });
    }

    const publicPath = file.objectKey.startsWith("/")
      ? file.objectKey
      : `/${file.objectKey}`;

    // Fix self-host redirect: `new URL(publicPath, request.url)` inherits
    // the Host seen by the Node process. Behind a reverse proxy (nginx ->
    // localhost:3006) that Host is often `localhost:3006`, so the redirect
    // becomes `https://localhost:3006/img/...` which the browser cannot
    // reach (ERR_CONNECTION_REFUSED). Prefer X-Forwarded-* headers and fall
    // back to a relative Location so the browser resolves against the visible
    // origin (https://app-tech.wing-online.com).
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const host =
      forwardedHost ?? request.headers.get("host")?.split(",")[0]?.trim() ?? "";
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const proto =
      forwardedProto ?? new URL(request.url).protocol.replace(":", "") ?? "https";
    const isLocalHost =
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    let location: string | URL = publicPath;
    if (host && !isLocalHost) {
      try {
        location = new URL(publicPath, `${proto}://${host}`).toString();
      } catch {
        location = publicPath;
      }
    }

    if (typeof location === "string" && location.startsWith("/")) {
      return new NextResponse(null, {
        status: 307,
        headers: {
          Location: location,
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      });
    }

    return NextResponse.redirect(location as string | URL, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }

  const isDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const body = await getFile(file).catch(() => null);
  if (!body) {
    return new NextResponse(isDownload ? "ไม่พบไฟล์ที่ร้องขอ" : "Not found", {
      status: 404,
    });
  }


  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Content-Length": String(body.byteLength),
    "Cache-Control": isDownload
      ? "private, no-store"
      : delivery.isPublic
        ? "public, max-age=0, must-revalidate"
        : "private, no-store",
  };
  if (isDownload) {
    headers["Content-Disposition"] = buildContentDisposition(file.originalName);
  }

  const response = new NextResponse(body, { headers });
  return response;
}
