export const MAX_IMAGE_FILE_SIZE_MB = 50;
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 ** 2;

export const MAX_UPLOAD_FILE_SIZE_MB = 50;
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 ** 2;
export const MIN_UPLOAD_FILE_SIZE_BYTES = 1;
export const MAX_UPLOAD_FILE_NAME_LENGTH = 255;

const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** `accept` attribute value for image pickers such as Mantine `FileButton`. */
export const ACCEPTED_IMAGE_FILE_ACCEPT = ACCEPTED_IMAGE_MIME_TYPES.join(",");

/**
 * Client-side guard for image pickers. Returns a Thai error message, or `null`
 * when the file passes. The server validates again in
 * `src/servers/file-manager/helpers.ts`.
 */
export function getImageFileError(file: File): string | null {
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
    return "รองรับเฉพาะไฟล์ JPG, PNG และ WebP";
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return `ขนาดไฟล์ต้องไม่เกิน ${MAX_IMAGE_FILE_SIZE_MB} MB`;
  }
  return null;
}
