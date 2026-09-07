import { Prisma } from "@prisma/client";
import type {
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import type {
  AuditActor,
  AuditJsonObject,
  AuditTarget,
} from "./audit";
import type { RequestContext } from "@/lib/audit/request-context";

export type UserSecurityLogInput = {
  actor?: AuditActor | null;
  target?: AuditTarget | null;
  requestContext: RequestContext;
  reason?: string | null;
  event: UserSecurityEvent;
  source: UserSecuritySource;
  outcome: UserSecurityOutcome;
  metadata?: AuditJsonObject;
};

type UserSecurityLogContext = {
  create(args: Prisma.UserSecurityLogCreateArgs): Promise<unknown>;
};

export const userSecurityLogExtension = Prisma.defineExtension({
  name: "user-security-log",
  model: {
    userSecurityLog: {
      async createLog(this: unknown, input: UserSecurityLogInput) {
        const context = Prisma.getExtensionContext(
          this,
        ) as UserSecurityLogContext;

        return context.create({
          data: {
            actorUserId: input.actor?.id,
            actorRole: input.actor?.role,
            targetUserId: input.target?.id,
            event: input.event,
            source: input.source,
            outcome: input.outcome,
            reason: input.reason || undefined,
            metadata: input.metadata,
            requestId: input.requestContext.requestId,
            ipHash: input.requestContext.ipHash,
            userAgent: input.requestContext.userAgent,
          },
        });
      },
    },
  },
});
