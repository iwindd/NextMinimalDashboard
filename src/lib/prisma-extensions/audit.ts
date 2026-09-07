import { Prisma } from "@prisma/client";
import type {
  AuditAction,
  AuditResourceType,
  UserRole,
} from "@prisma/client";
import type { RequestContext } from "@/lib/audit/request-context";

export type AuditActor = {
  id: string;
  role?: UserRole | null;
};

export type AuditTarget = {
  id: string;
};

export type AuditJsonObject = Prisma.InputJsonObject;

export type AuditLogInput = {
  actor?: AuditActor | null;
  target?: AuditTarget | null;
  requestContext: RequestContext;
  reason?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  before?: AuditJsonObject;
  after?: AuditJsonObject;
  metadata?: AuditJsonObject;
};

type AuditLogContext = {
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
};

export const auditExtension = Prisma.defineExtension({
  name: "audit",
  client: {
    async createAuditLog(this: unknown, input: AuditLogInput) {
      const context = Prisma.getExtensionContext(this) as AuditLogContext;

      return context.auditLog.create({
        data: {
          actorUserId: input.actor?.id,
          actorRole: input.actor?.role,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          targetUserId: input.target?.id,
          before: input.before,
          after: input.after,
          metadata: input.metadata,
          reason: input.reason || undefined,
          requestId: input.requestContext.requestId,
          ipHash: input.requestContext.ipHash,
          userAgent: input.requestContext.userAgent,
        },
      });
    },
  },
});
