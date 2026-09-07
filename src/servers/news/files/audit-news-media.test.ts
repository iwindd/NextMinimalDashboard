import { NewsFilePurpose } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
}));

import { auditNewsMediaChanges } from "./audit-news-media";

describe("auditNewsMediaChanges", () => {
  const originalConfig = process.env.FILE_MANAGER_DELETE_ON_REMOVE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FILE_MANAGER_DELETE_ON_REMOVE = "true";
    mocks.createAuditLog.mockImplementation(async (input) =>
      input.action === "NEWS_MEDIA_DETACHED" ? { id: "detach-audit-id" } : {},
    );
  });

  afterEach(() => {
    if (originalConfig === undefined) {
      delete process.env.FILE_MANAGER_DELETE_ON_REMOVE;
    } else {
      process.env.FILE_MANAGER_DELETE_ON_REMOVE = originalConfig;
    }
  });

  it("writes separate attach and detach events with before/after details", async () => {
    const oldFile = {
      fileId: "old-file",
      purpose: NewsFilePurpose.COVER,
      originalName: "old.jpg",
      mimeType: "image/jpeg",
      byteSize: 10,
    };
    const newFile = {
      fileId: "new-file",
      purpose: NewsFilePurpose.BODY,
      originalName: "new.webp",
      mimeType: "image/webp",
      byteSize: 20,
    };

    const cleanup = await auditNewsMediaChanges(
      { createAuditLog: mocks.createAuditLog } as never,
      {
        newsId: "news-id",
        revisionId: "revision-id",
        requestContext: {
          requestId: "request-id",
          ipHash: null,
          userAgent: null,
        },
        actor: {
          id: "actor-id",
          role: "EDITOR",
          isActive: true,
        },
        sync: {
          before: [oldFile],
          after: [newFile],
          attached: [newFile],
          detached: [oldFile],
        },
      },
    );

    expect(mocks.createAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "NEWS_MEDIA_ATTACHED",
        resourceType: "FILE",
        resourceId: "new-file",
        before: { attached: false },
        after: { attached: true, ...newFile, newsId: "news-id", revisionId: "revision-id" },
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "NEWS_MEDIA_DETACHED",
        resourceType: "FILE",
        resourceId: "old-file",
        before: { attached: true, ...oldFile, newsId: "news-id", revisionId: "revision-id" },
        after: { attached: false, ...oldFile, newsId: "news-id", revisionId: "revision-id" },
        metadata: expect.objectContaining({ storageDeletion: "PENDING" }),
      }),
    );
    expect(cleanup).toEqual([
      expect.objectContaining({
        fileId: "old-file",
        auditLogId: "detach-audit-id",
      }),
    ]);
  });
});
