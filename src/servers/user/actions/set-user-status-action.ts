"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuditResourceType,
  Prisma,
  UserRole,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { manageUsersActionClient } from "./client";
import { setUserStatusSchema } from "./set-user-status-schema";
import { UserNotFoundError, UserPolicyError } from "../exceptions";
import { USER_DETAIL_SELECT, toUserDetail } from "../helpers";

export const setUserStatusAction = manageUsersActionClient
  .inputSchema(setUserStatusSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: parsedInput.userId },
          select: USER_DETAIL_SELECT,
        });

        if (!target) {
          throw new UserNotFoundError();
        }

        if (target.isActive === parsedInput.isActive) return target;

        if (target.id === ctx.actor.id && !parsedInput.isActive) {
          throw new UserPolicyError("ไม่สามารถปิดใช้งานบัญชีของตนเองได้");
        }

        if (
          target.role === UserRole.ADMIN &&
          target.isActive &&
          !parsedInput.isActive
        ) {
          const activeAdminCount = await transaction.user.count({
            where: {
              role: UserRole.ADMIN,
              isActive: true,
              id: { not: target.id },
            },
          });

          if (activeAdminCount === 0) {
            throw new UserPolicyError("ต้องมีผู้ดูแลระบบที่เปิดใช้งานอยู่อย่างน้อยหนึ่งคน");
          }
        }

        const updatedUser = await transaction.user.update({
          where: { id: target.id },
          data: { isActive: parsedInput.isActive },
          select: USER_DETAIL_SELECT,
        });

        const event = updatedUser.isActive
          ? UserSecurityEvent.ACCOUNT_ENABLED
          : UserSecurityEvent.ACCOUNT_DISABLED;

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.USER_STATUS_CHANGED,
          resourceType: AuditResourceType.USER,
          resourceId: updatedUser.id,
          before: { isActive: target.isActive },
          after: { isActive: updatedUser.isActive },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event,
          source: UserSecuritySource.ADMIN,
          outcome: UserSecurityOutcome.SUCCESS,
        });

        return updatedUser;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      revalidatePath("/admin/users");
      revalidatePath(`/admin/users/${user.id}/profile`);

      return toUserDetail(user);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return returnActionError({
          code: "NOT_FOUND",
          message: "ไม่พบผู้ใช้งาน",
        });
      }

      if (error instanceof UserPolicyError) {
        return returnActionError({
          code: "POLICY",
          message: error.message,
        });
      }

      throw error;
    }
  });
