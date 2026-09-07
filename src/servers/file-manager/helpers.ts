import { FileValidationError } from "./exceptions";
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_NAME_LENGTH,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
  MIN_UPLOAD_FILE_SIZE_BYTES,
} from "@/utils/file";

const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

const UPLOAD_MIME_EXTENSIONS = {
  ...IMAGE_MIME_EXTENSIONS,
  "application/pdf": ".pdf",
} as const;

const IMAGE_FILE_MIME_TYPES = Object.keys(
  IMAGE_MIME_EXTENSIONS,
) as Array<keyof typeof IMAGE_MIME_EXTENSIONS>;

export function isSupportedImageMimeType(
  mimeType: string,
): mimeType is (typeof IMAGE_FILE_MIME_TYPES)[number] {
  return IMAGE_FILE_MIME_TYPES.includes(
    mimeType as (typeof IMAGE_FILE_MIME_TYPES)[number],
  );
}

const DOCUMENT_FILE_MIME_TYPES = Object.keys(
  UPLOAD_MIME_EXTENSIONS,
) as Array<keyof typeof UPLOAD_MIME_EXTENSIONS>;

export const UPLOAD_FILE_KINDS = ["image", "document"] as const;

export type UploadFileKind = (typeof UPLOAD_FILE_KINDS)[number];

type UploadProfile = {
  mimeTypes: readonly string[];
  minSize: number;
  maxSize: number;
  maxNameLength: number | null;
  mimeMessage: string;
  sizeMessage: string;
  signatureMessage: string;
};

/**
 * The `image` profile reproduces the historical `validateImageFile` behaviour
 * byte for byte: upper size bound only and no file-name length limit.
 */
const UPLOAD_PROFILES: Record<UploadFileKind, UploadProfile> = {
  image: {
    mimeTypes: IMAGE_FILE_MIME_TYPES,
    minSize: 0,
    maxSize: MAX_IMAGE_FILE_SIZE_BYTES,
    maxNameLength: null,
    mimeMessage: "รองรับเฉพาะไฟล์ JPG, PNG และ WebP",
    sizeMessage: `ไฟล์รูปภาพต้องมีขนาดไม่เกิน ${MAX_IMAGE_FILE_SIZE_MB} MB`,
    signatureMessage: "ไฟล์รูปภาพไม่ถูกต้อง",
  },
  document: {
    mimeTypes: DOCUMENT_FILE_MIME_TYPES,
    minSize: MIN_UPLOAD_FILE_SIZE_BYTES,
    maxSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    maxNameLength: MAX_UPLOAD_FILE_NAME_LENGTH,
    mimeMessage: "รองรับเฉพาะไฟล์ JPG, PNG, WebP และ PDF",
    sizeMessage:
      `ไฟล์ต้องมีขนาด ${MIN_UPLOAD_FILE_SIZE_BYTES} ไบต์ถึง ${MAX_UPLOAD_FILE_SIZE_MB} MB` +
      ` และชื่อไฟล์ยาวไม่เกิน ${MAX_UPLOAD_FILE_NAME_LENGTH} อักขระ`,
    signatureMessage: "ไฟล์ที่อัปโหลดไม่ถูกต้อง",
  },
};

export function getFileUrl(file: { id: string }) {
  return `/api/files/${file.id}`;
}

export function getImageFileExtension(mimeType: string) {
  return IMAGE_MIME_EXTENSIONS[mimeType as keyof typeof IMAGE_MIME_EXTENSIONS] ?? null;
}

export function getUploadFileExtension(mimeType: string) {
  return (
    UPLOAD_MIME_EXTENSIONS[mimeType as keyof typeof UPLOAD_MIME_EXTENSIONS] ??
    null
  );
}

export function validateUploadFile(
  file: File,
  bytes: Uint8Array,
  kind: UploadFileKind,
) {
  const profile = UPLOAD_PROFILES[kind];

  if (!profile.mimeTypes.includes(file.type)) {
    throw new FileValidationError(profile.mimeMessage);
  }
  if (file.size > profile.maxSize || file.size < profile.minSize) {
    throw new FileValidationError(profile.sizeMessage);
  }
  if (
    profile.maxNameLength !== null &&
    file.name.length > profile.maxNameLength
  ) {
    throw new FileValidationError(profile.sizeMessage);
  }
  if (!hasFileSignature(bytes, file.type)) {
    throw new FileValidationError(profile.signatureMessage);
  }
}

export function validateImageFile(file: File, bytes: Uint8Array) {
  validateUploadFile(file, bytes, "image");
}

/**
 * Builds a `Content-Disposition` value carrying both an ASCII fallback and the
 * RFC 5987 `filename*` form so Thai file names survive the round trip.
 */
export function buildContentDisposition(originalName: string) {
  const safeName = originalName.trim() || "download";
  const asciiName = safeName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function hasFileSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes
      .slice(0, signature.length)
      .every((value, index) => value === signature[index]);
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  if (mimeType === "application/pdf") {
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  return false;
}
