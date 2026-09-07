import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { config } from "./proxy";

describe("admin proxy", () => {
  it("protects every admin route", () => {
    expect(config).toEqual({ matcher: ["/admin/:path*"] });
  });
});
