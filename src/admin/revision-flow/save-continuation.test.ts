import { describe, expect, it, vi } from "vitest";
import {
  shouldRunSaveContinuation,
  type SaveContinuation,
} from "./save-continuation";

const continuation: SaveContinuation = { action: vi.fn() };

describe("shouldRunSaveContinuation", () => {
  it("continues a normal draft save", () => {
    expect(
      shouldRunSaveContinuation({
        hasMetadataErrors: false,
        autoPublished: false,
        continuation,
      }),
    ).toBe(true);
  });

  it("does not continue after an auto-publish unless explicitly allowed", () => {
    expect(
      shouldRunSaveContinuation({
        hasMetadataErrors: false,
        autoPublished: true,
        continuation,
      }),
    ).toBe(false);
  });

  it("continues archive after an auto-publish", () => {
    expect(
      shouldRunSaveContinuation({
        hasMetadataErrors: false,
        autoPublished: true,
        continuation: {
          ...continuation,
          continueAfterAutoPublish: true,
        },
      }),
    ).toBe(true);
  });

  it("does not continue when metadata errors remain", () => {
    expect(
      shouldRunSaveContinuation({
        hasMetadataErrors: true,
        autoPublished: false,
        continuation,
      }),
    ).toBe(false);
  });
});
