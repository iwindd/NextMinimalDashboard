import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_NAME_LENGTH,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from "@/utils/file";
import { FileValidationError } from "./exceptions";
import {
  buildContentDisposition,
  getFileUrl,
  getImageFileExtension,
  getUploadFileExtension,
  isSupportedImageMimeType,
  validateImageFile,
  validateUploadFile,
} from "./helpers";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function webpBytes() {
  const bytes = new Uint8Array(12);
  bytes.set([..."RIFF"].map((character) => character.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((character) => character.charCodeAt(0)), 8);
  return bytes;
}

describe("file manager helpers", () => {
  it("recognizes only supported image MIME types", () => {
    expect(isSupportedImageMimeType("image/jpeg")).toBe(true);
    expect(isSupportedImageMimeType("image/png")).toBe(true);
    expect(isSupportedImageMimeType("image/webp")).toBe(true);
    expect(isSupportedImageMimeType("application/pdf")).toBe(false);
  });

  it("builds the generic delivery URL", () => {
    expect(getFileUrl({ id: "file-id" })).toBe("/api/files/file-id");
  });

  it("accepts an image when MIME type and signature match", () => {
    const file = new File([PNG_BYTES], "cover.png", { type: "image/png" });

    expect(() => validateImageFile(file, PNG_BYTES)).not.toThrow();
    expect(getImageFileExtension(file.type)).toBe(".png");
  });

  it("rejects a spoofed image", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const file = new File([bytes], "cover.png", { type: "image/png" });

    expect(() => validateImageFile(file, bytes)).toThrow(FileValidationError);
  });

  it("accepts an image at the 50 MB limit and rejects larger files", () => {
    const imageAtLimit = {
      type: "image/png",
      size: MAX_IMAGE_FILE_SIZE_BYTES,
      name: "cover.png",
    } as File;
    const imageOverLimit = {
      type: "image/png",
      size: MAX_IMAGE_FILE_SIZE_BYTES + 1,
      name: "cover.png",
    } as File;

    expect(() => validateImageFile(imageAtLimit, PNG_BYTES)).not.toThrow();
    expect(() => validateImageFile(imageOverLimit, PNG_BYTES)).toThrow(
      "ไฟล์รูปภาพต้องมีขนาดไม่เกิน 50 MB",
    );
  });
});

describe("validateUploadFile image profile parity", () => {
  it("keeps the historical messages for the image profile", () => {
    const pdf = new File([PDF_BYTES], "guide.pdf", {
      type: "application/pdf",
    });

    expect(() => validateUploadFile(pdf, PDF_BYTES, "image")).toThrow(
      "รองรับเฉพาะไฟล์ JPG, PNG และ WebP",
    );
  });

  it("still accepts a zero byte image and a very long name", () => {
    const emptyImage = {
      type: "image/png",
      size: 0,
      name: `${"a".repeat(MAX_UPLOAD_FILE_NAME_LENGTH + 45)}.png`,
    } as File;

    expect(() => validateUploadFile(emptyImage, PNG_BYTES, "image")).not.toThrow();
  });

  it("accepts every supported image signature", () => {
    const webp = webpBytes();

    expect(() =>
      validateUploadFile(
        new File([JPEG_BYTES], "a.jpg", { type: "image/jpeg" }),
        JPEG_BYTES,
        "image",
      ),
    ).not.toThrow();
    expect(() =>
      validateUploadFile(
        new File([webp], "a.webp", { type: "image/webp" }),
        webp,
        "image",
      ),
    ).not.toThrow();
  });
});

describe("validateUploadFile document profile", () => {
  it("accepts a PDF with a matching signature", () => {
    const file = new File([PDF_BYTES], "poster.pdf", {
      type: "application/pdf",
    });

    expect(() => validateUploadFile(file, PDF_BYTES, "document")).not.toThrow();
    expect(getUploadFileExtension(file.type)).toBe(".pdf");
  });

  it("rejects a PDF whose leading bytes do not match", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const file = new File([bytes], "poster.pdf", { type: "application/pdf" });

    expect(() => validateUploadFile(file, bytes, "document")).toThrow(
      "ไฟล์ที่อัปโหลดไม่ถูกต้อง",
    );
  });

  it("accepts images as downloadable assets", () => {
    const file = new File([PNG_BYTES], "poster.png", { type: "image/png" });

    expect(() => validateUploadFile(file, PNG_BYTES, "document")).not.toThrow();
  });

  it("rejects an unsupported MIME type", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const file = new File([bytes], "sheet.xlsx", {
      type: "application/vnd.ms-excel",
    });

    expect(() => validateUploadFile(file, bytes, "document")).toThrow(
      "รองรับเฉพาะไฟล์ JPG, PNG, WebP และ PDF",
    );
    expect(getUploadFileExtension(file.type)).toBeNull();
  });

  it("enforces the size range and file name length", () => {
    const expectedMessage =
      "ไฟล์ต้องมีขนาด 1 ไบต์ถึง 50 MB และชื่อไฟล์ยาวไม่เกิน 255 อักขระ";
    const emptyFile = {
      type: "application/pdf",
      size: 0,
      name: "poster.pdf",
    } as File;
    const oversizeFile = {
      type: "application/pdf",
      size: MAX_UPLOAD_FILE_SIZE_BYTES + 1,
      name: "poster.pdf",
    } as File;
    const atLimit = {
      type: "application/pdf",
      size: MAX_UPLOAD_FILE_SIZE_BYTES,
      name: "poster.pdf",
    } as File;
    const longName = {
      type: "application/pdf",
      size: 2048,
      name: `${"n".repeat(MAX_UPLOAD_FILE_NAME_LENGTH)}.pdf`,
    } as File;
    const nameAtLimit = {
      type: "application/pdf",
      size: 2048,
      name: "n".repeat(MAX_UPLOAD_FILE_NAME_LENGTH),
    } as File;

    expect(() => validateUploadFile(emptyFile, PDF_BYTES, "document")).toThrow(
      expectedMessage,
    );
    expect(() =>
      validateUploadFile(oversizeFile, PDF_BYTES, "document"),
    ).toThrow(expectedMessage);
    expect(() => validateUploadFile(atLimit, PDF_BYTES, "document")).not.toThrow();
    expect(() => validateUploadFile(longName, PDF_BYTES, "document")).toThrow(
      expectedMessage,
    );
    expect(() =>
      validateUploadFile(nameAtLimit, PDF_BYTES, "document"),
    ).not.toThrow();
  });
});

describe("buildContentDisposition", () => {
  it("keeps a Thai file name in the UTF-8 parameter with an ASCII fallback", () => {
    const value = buildContentDisposition("อินโฟกราฟิก.pdf");

    const asciiFallback = `${"_".repeat("อินโฟกราฟิก".length)}.pdf`;

    expect(value.startsWith("attachment; ")).toBe(true);
    expect(value).toContain(`filename="${asciiFallback}"`);
    expect(/^[\x20-\x7E]+$/.test(asciiFallback)).toBe(true);
    expect(value).toContain(
      `filename*=UTF-8''${encodeURIComponent("อินโฟกราฟิก.pdf")}`,
    );
  });

  it("passes an ASCII name through unchanged", () => {
    expect(buildContentDisposition("poster-a2.pdf")).toBe(
      `attachment; filename="poster-a2.pdf"; filename*=UTF-8''poster-a2.pdf`,
    );
  });

  it("neutralises quotes and falls back for a blank name", () => {
    expect(buildContentDisposition('a"b\\c.pdf')).toContain(
      'filename="a_b_c.pdf"',
    );
    expect(buildContentDisposition("   ")).toContain('filename="download"');
  });
});
