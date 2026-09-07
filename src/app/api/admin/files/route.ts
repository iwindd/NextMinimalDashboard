import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/audit/request-context";
import { requireFileManagerActor } from "@/servers/file-manager/authorization";
import {
  FileAuthorizationError,
  FileValidationError,
} from "@/servers/file-manager/exceptions";
import { createFile } from "@/servers/file-manager/files/create-file";
import {
  getUploadFileExtension,
  UPLOAD_FILE_KINDS,
  type UploadFileKind,
  validateUploadFile,
} from "@/servers/file-manager/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireFileManagerActor();
    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) {
      throw new FileValidationError("กรุณาเลือกไฟล์รูปภาพ");
    }

    // Callers that omit `kind` keep the historical image-only behaviour.
    const kindEntry = formData.get("kind");
    const kind: UploadFileKind = UPLOAD_FILE_KINDS.includes(
      kindEntry as UploadFileKind,
    )
      ? (kindEntry as UploadFileKind)
      : "image";

    const bytes = new Uint8Array(await entry.arrayBuffer());
    validateUploadFile(entry, bytes, kind);
    const extension = getUploadFileExtension(entry.type);
    if (!extension) {
      throw new FileValidationError("รองรับเฉพาะไฟล์ JPG, PNG, WebP และ PDF");
    }

    const file = await createFile({
      actor,
      requestContext: await getRequestContext(),
      bytes,
      originalName: entry.name,
      mimeType: entry.type,
      byteSize: entry.size,
      extension,
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    if (error instanceof FileAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof FileValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
