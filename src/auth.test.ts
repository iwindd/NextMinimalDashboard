import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { authConfig: undefined as unknown };
  const prisma = {
    user: { findUnique: vi.fn() },
    createAuditLog: vi.fn(),
    userSecurityLog: { createLog: vi.fn() },
  };

  return {
    prisma,
    state,
    nextAuth: vi.fn((config: unknown) => {
      state.authConfig = config;
      return {
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      };
    }),
    credentials: vi.fn((config: { authorize: (input: unknown) => Promise<unknown> }) =>
      config,
    ),
    compare: vi.fn(),
    createAuditLog: prisma.createAuditLog,
    createUserSecurityLog: prisma.userSecurityLog.createLog,
    getRequestContext: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ default: mocks.nextAuth }));
vi.mock("next-auth/providers/credentials", () => ({
  default: mocks.credentials,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit/request-context", () => ({
  getRequestContext: mocks.getRequestContext,
}));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));

import "./auth";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN" as const,
  isActive: true,
  passwordHash: "password-hash",
};

function getAuthorize() {
  return getAuthConfig().providers[0].authorize;
}

function getAuthConfig() {
  return mocks.state.authConfig as {
    providers: Array<{ authorize: (input: unknown) => Promise<unknown> }>;
    callbacks: {
      authorized: (input: {
        auth: unknown;
        request: { nextUrl: { pathname: string } };
      }) => Promise<boolean>;
      jwt: (input: {
        token: Record<string, unknown>;
        user?: {
          id?: string;
          email?: string | null;
          name?: string | null;
          role?: "ADMIN" | "EDITOR";
        };
      }) => Promise<Record<string, unknown>>;
      session: (input: {
        session: { user?: Record<string, unknown> };
        token: Record<string, unknown>;
      }) => { user?: Record<string, unknown> };
    };
  };
}

describe("credentials authentication security logs", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockReset();
    mocks.compare.mockReset();
    mocks.createAuditLog.mockReset();
    mocks.createUserSecurityLog.mockReset();
    mocks.getRequestContext.mockReset();
    mocks.getRequestContext.mockResolvedValue({
      requestId: "request-1",
      ipHash: "hashed-ip",
      userAgent: "test-agent",
    });
  });

  it("records a successful login with the user as actor and target", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    mocks.compare.mockResolvedValue(true);

    const result = await getAuthorize()({
      email: user.email,
      password: "password",
    });

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ id: user.id }),
        target: expect.objectContaining({ id: user.id }),
        event: "LOGIN_SUCCEEDED",
        source: "SELF",
        outcome: "SUCCESS",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_SUCCEEDED",
        resourceId: user.id,
        metadata: { email: user.email },
      }),
    );
  });

  it("records a failed login without treating the target as the actor", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    mocks.compare.mockResolvedValue(false);

    await expect(
      getAuthorize()({ email: user.email, password: "wrong-password" }),
    ).resolves.toBeNull();

    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: undefined,
        target: expect.objectContaining({ id: user.id }),
        event: "LOGIN_FAILED",
        source: "SYSTEM",
        outcome: "FAILURE",
        metadata: { email: user.email },
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_FAILED",
        metadata: { email: user.email },
      }),
    );
  });

  it("records malformed credential attempts", async () => {
    await expect(
      getAuthorize()({ email: "not-an-email", password: "" }),
    ).resolves.toBeNull();

    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "LOGIN_FAILED",
        outcome: "FAILURE",
        metadata: { reason: "INVALID_CREDENTIALS_FORMAT" },
      }),
    );
  });

  it("rejects an unknown user without comparing a password", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      getAuthorize()({ email: user.email, password: "password" }),
    ).resolves.toBeNull();

    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: undefined,
        target: undefined,
        metadata: { email: user.email },
      }),
    );
  });

  it("rejects an inactive user without comparing a password", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });

    await expect(
      getAuthorize()({ email: user.email, password: "password" }),
    ).resolves.toBeNull();

    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: undefined,
        target: expect.objectContaining({ id: user.id }),
        outcome: "FAILURE",
      }),
    );
  });

  it("keeps authentication working when security log writes fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    mocks.compare.mockResolvedValue(true);
    mocks.createAuditLog.mockRejectedValue(new Error("audit unavailable"));
    mocks.createUserSecurityLog.mockRejectedValue(
      new Error("security log unavailable"),
    );

    await expect(
      getAuthorize()({ email: user.email, password: "password" }),
    ).resolves.toMatchObject({ id: user.id });

    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});

describe("NextAuth callbacks", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockReset();
  });

  it("allows the login page without a session", async () => {
    await expect(
      getAuthConfig().callbacks.authorized({
        auth: null,
        request: { nextUrl: { pathname: "/admin/login" } },
      }),
    ).resolves.toBe(true);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires a complete session for protected routes", async () => {
    await expect(
      getAuthConfig().callbacks.authorized({
        auth: null,
        request: { nextUrl: { pathname: "/admin/users" } },
      }),
    ).resolves.toBe(false);

    await expect(
      getAuthConfig().callbacks.authorized({
        auth: { user: { id: user.id } },
        request: { nextUrl: { pathname: "/admin/users" } },
      }),
    ).resolves.toBe(false);
  });

  it("checks the current active role before authorizing a route", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      role: user.role,
      isActive: true,
    });

    await expect(
      getAuthConfig().callbacks.authorized({
        auth: { user: { id: user.id, role: user.role } },
        request: { nextUrl: { pathname: "/admin/users" } },
      }),
    ).resolves.toBe(true);
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { role: true, isActive: true },
    });

    mocks.prisma.user.findUnique.mockResolvedValue({
      role: user.role,
      isActive: false,
    });
    await expect(
      getAuthConfig().callbacks.authorized({
        auth: { user: { id: user.id, role: user.role } },
        request: { nextUrl: { pathname: "/admin/users" } },
      }),
    ).resolves.toBe(false);

    mocks.prisma.user.findUnique.mockResolvedValue({
      role: "EDITOR",
      isActive: true,
    });
    await expect(
      getAuthConfig().callbacks.authorized({
        auth: { user: { id: user.id, role: user.role } },
        request: { nextUrl: { pathname: "/admin/users" } },
      }),
    ).resolves.toBe(false);
  });

  it("hydrates a JWT on login and refreshes it from the database", async () => {
    await expect(
      getAuthConfig().callbacks.jwt({
        token: {},
        user,
      }),
    ).resolves.toEqual({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    mocks.prisma.user.findUnique.mockResolvedValue({
      email: "updated@example.com",
      name: "Updated Admin",
      role: user.role,
      isActive: true,
    });
    await expect(
      getAuthConfig().callbacks.jwt({
        token: { id: user.id, role: user.role, email: user.email, name: user.name },
      }),
    ).resolves.toEqual({
      id: user.id,
      role: user.role,
      email: "updated@example.com",
      name: "Updated Admin",
    });
  });

  it("clears a JWT when the account is inactive or its role changed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      email: user.email,
      name: user.name,
      role: "EDITOR",
      isActive: true,
    });

    await expect(
      getAuthConfig().callbacks.jwt({
        token: {
          id: user.id,
          role: user.role,
          email: user.email,
          name: user.name,
          sub: user.id,
        },
      }),
    ).resolves.toEqual({
      id: undefined,
      role: undefined,
      email: undefined,
      name: undefined,
      sub: undefined,
    });
  });

  it("clears a JWT when the account has been deactivated", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: false,
    });

    await expect(
      getAuthConfig().callbacks.jwt({
        token: {
          id: user.id,
          role: user.role,
          email: user.email,
          name: user.name,
          sub: user.id,
        },
      }),
    ).resolves.toEqual({
      id: undefined,
      role: undefined,
      email: undefined,
      name: undefined,
      sub: undefined,
    });
  });

  it("copies identity fields from the JWT into the session", () => {
    const session = { user: {} };

    expect(
      getAuthConfig().callbacks.session({
        session,
        token: {
          id: user.id,
          role: user.role,
          email: user.email,
          name: user.name,
        },
      }),
    ).toEqual({
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
      },
    });
  });
});
