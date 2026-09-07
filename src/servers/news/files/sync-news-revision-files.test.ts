import { FileAccess, NewsFilePurpose, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsPolicyError } from "../exceptions";
import {
  setNewsRevisionFileAccess,
  syncNewsRevisionFiles,
} from "./sync-news-revision-files";

const mocks = {
  findMany: vi.fn(),
  revisionFindMany: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
};

const transaction = {
  fileAsset: { findMany: mocks.findMany },
  newsRevisionFile: {
    findMany: mocks.revisionFindMany,
    deleteMany: mocks.deleteMany,
    create: mocks.create,
  },
  fileReference: { updateMany: mocks.updateMany },
};

const newsId = "news-id";
const editor = {
  id: "editor-id",
  role: UserRole.EDITOR,
  isActive: true,
};

describe("news revision file references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "cover-id",
        originalName: "cover.jpg",
        mimeType: "image/jpeg",
        byteSize: 1,
      },
      {
        id: "body-1",
        originalName: "body-1.jpg",
        mimeType: "image/jpeg",
        byteSize: 1,
      },
      {
        id: "body-2",
        originalName: "body-2.jpg",
        mimeType: "image/jpeg",
        byteSize: 1,
      },
    ]);
    mocks.revisionFindMany.mockResolvedValue([]);
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.create.mockResolvedValue({ id: "reference-id" });
  });

  it("replaces cover and unique body references as private", async () => {
    await syncNewsRevisionFiles(transaction as never, {
      revisionId: "revision-id",
      newsId,
      actor: editor,
      coverFileId: "cover-id",
      bodyFileIds: ["body-1", "body-1", "body-2"],
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["cover-id", "body-1", "body-2"] },
        OR: [
          { createdById: editor.id },
          {
            references: {
              some: {
                newsRevisionFile: {
                  is: { revision: { newsId } },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
      },
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { revisionId: "revision-id" },
    });
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create).toHaveBeenNthCalledWith(1, {
      data: {
        revisionId: "revision-id",
        purpose: NewsFilePurpose.COVER,
        reference: {
          create: { fileId: "cover-id", access: FileAccess.PRIVATE },
        },
      },
    });
  });

  it("does not replace references when any file does not exist", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(
      syncNewsRevisionFiles(transaction as never, {
        revisionId: "revision-id",
        newsId,
        actor: editor,
        coverFileId: "missing-id",
        bodyFileIds: [],
      }),
    ).rejects.toBeInstanceOf(NewsPolicyError);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("allows administrators to attach any existing managed file", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "cover-id",
        originalName: "cover.jpg",
        mimeType: "image/jpeg",
        byteSize: 1,
      },
    ]);

    await syncNewsRevisionFiles(transaction as never, {
      revisionId: "revision-id",
      newsId,
      actor: { ...editor, role: UserRole.ADMIN },
      coverFileId: "cover-id",
      bodyFileIds: [],
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["cover-id"] } },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
      },
    });
  });

  it("returns the before/after media diff for audit events", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "new-cover",
        originalName: "new-cover.webp",
        mimeType: "image/webp",
        byteSize: 20,
      },
      {
        id: "body-1",
        originalName: "body-1.jpg",
        mimeType: "image/jpeg",
        byteSize: 10,
      },
    ]);
    mocks.revisionFindMany.mockResolvedValue([
      {
        purpose: NewsFilePurpose.COVER,
        reference: {
          file: {
            id: "old-cover",
            originalName: "old-cover.jpg",
            mimeType: "image/jpeg",
            byteSize: 5,
          },
        },
      },
    ]);

    const result = await syncNewsRevisionFiles(transaction as never, {
      revisionId: "revision-id",
      newsId,
      actor: editor,
      coverFileId: "new-cover",
      bodyFileIds: ["body-1"],
    });

    expect(result.before).toEqual([
      {
        fileId: "old-cover",
        purpose: NewsFilePurpose.COVER,
        originalName: "old-cover.jpg",
        mimeType: "image/jpeg",
        byteSize: 5,
      },
    ]);
    expect(result.attached).toEqual([
      expect.objectContaining({ fileId: "new-cover", purpose: NewsFilePurpose.COVER }),
      expect.objectContaining({ fileId: "body-1", purpose: NewsFilePurpose.BODY }),
    ]);
    expect(result.detached).toEqual([
      expect.objectContaining({ fileId: "old-cover", purpose: NewsFilePurpose.COVER }),
    ]);
  });

  it("changes access for every reference owned by a revision", async () => {
    await setNewsRevisionFileAccess(
      transaction as never,
      "revision-id",
      FileAccess.PUBLIC,
    );

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { newsRevisionFile: { revisionId: "revision-id" } },
      data: { access: FileAccess.PUBLIC },
    });
  });
});
