import {
  AuditAction,
  AuditResourceType,
  UserRole,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  auditExtension,
  type AuditLogInput,
} from "./audit";
import {
  userSecurityLogExtension,
  type UserSecurityLogInput,
} from "./user-security-log";

type ExtensionClient = {
  $extends: (extension: unknown) => unknown;
};

type AuditExtensionDefinition = {
  client: {
    createAuditLog(this: unknown, input: AuditLogInput): Promise<unknown>;
  };
};

type UserSecurityLogExtensionDefinition = {
  model: {
    userSecurityLog: {
      createLog(this: unknown, input: UserSecurityLogInput): Promise<unknown>;
    };
  };
};

function unwrapExtension<T>(extension: unknown): T {
  const factory = extension as (client: ExtensionClient) => T;
  return factory({ $extends: (definition) => definition });
}

const requestContext = {
  requestId: "request-1",
  ipHash: "hashed-ip",
  userAgent: "test-agent",
};

describe("audit Prisma extensions", () => {
  it("writes audit data through the underlying auditLog delegate", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const extension = unwrapExtension<AuditExtensionDefinition>(auditExtension);

    await extension.client.createAuditLog.call(
      { auditLog: { create } },
      {
        actor: { id: "actor-1", role: UserRole.ADMIN },
        target: { id: "target-1" },
        requestContext,
        action: AuditAction.USER_NAME_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceId: "target-1",
        before: { name: "Old name" },
        after: { name: "New name" },
        reason: "User requested the change",
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        actorRole: UserRole.ADMIN,
        action: AuditAction.USER_NAME_CHANGED,
        resourceType: AuditResourceType.USER,
        resourceId: "target-1",
        targetUserId: "target-1",
        before: { name: "Old name" },
        after: { name: "New name" },
        metadata: undefined,
        reason: "User requested the change",
        requestId: "request-1",
        ipHash: "hashed-ip",
        userAgent: "test-agent",
      },
    });
  });

  it("writes security data through the userSecurityLog model extension", async () => {
    const create = vi.fn().mockResolvedValue({ id: "security-1" });
    const extension = unwrapExtension<UserSecurityLogExtensionDefinition>(
      userSecurityLogExtension,
    );

    await extension.model.userSecurityLog.createLog.call(
      { create },
      {
        actor: { id: "actor-1", role: UserRole.ADMIN },
        target: { id: "target-1" },
        requestContext,
        event: UserSecurityEvent.NAME_CHANGED_BY_ADMIN,
        source: UserSecuritySource.ADMIN,
        outcome: UserSecurityOutcome.SUCCESS,
        metadata: { field: "name" },
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        actorRole: UserRole.ADMIN,
        targetUserId: "target-1",
        event: UserSecurityEvent.NAME_CHANGED_BY_ADMIN,
        source: UserSecuritySource.ADMIN,
        outcome: UserSecurityOutcome.SUCCESS,
        reason: undefined,
        metadata: { field: "name" },
        requestId: "request-1",
        ipHash: "hashed-ip",
        userAgent: "test-agent",
      },
    });
  });

  it("omits optional audit identities and blank reasons", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-2" });
    const extension = unwrapExtension<AuditExtensionDefinition>(auditExtension);

    await extension.client.createAuditLog.call(
      { auditLog: { create } },
      {
        actor: null,
        target: null,
        requestContext,
        action: AuditAction.LOGIN_FAILED,
        resourceType: AuditResourceType.USER,
        reason: "",
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: undefined,
        actorRole: undefined,
        action: AuditAction.LOGIN_FAILED,
        resourceType: AuditResourceType.USER,
        resourceId: undefined,
        targetUserId: undefined,
        before: undefined,
        after: undefined,
        metadata: undefined,
        reason: undefined,
        requestId: requestContext.requestId,
        ipHash: requestContext.ipHash,
        userAgent: requestContext.userAgent,
      },
    });
  });
});
