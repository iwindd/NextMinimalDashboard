"use server";

import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  AuditResourceType,
  Prisma,
  UserRole,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { UserNotFoundError, UserPolicyError } from "../exceptions";
import { USER_DETAIL_SELECT, toUserDetail } from "../helpers";
import { manageUsersActionClient } from "./client";
import { updateUserRoleSchema } from "./update-user-role-schema";

export const updateUserRoleAction = manageUsersActionClient
  .inputSchema(updateUserRoleSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: parsedInput.userId },
          select: USER_DETAIL_SELECT,
        });

        if (!target) throw new UserNotFoundError();

        if (target.role === parsedInput.role) return target;

        if (target.id === ctx.actor.id && parsedInput.role !== UserRole.ADMIN) {
          throw new UserPolicyError(
            "ไม่สามารถลดสิทธิ์ของบัญชีที่กำลังใช้งานได้",
          );
        }

        if (
          target.role === UserRole.ADMIN &&
          target.isActive &&
          parsedInput.role !== UserRole.ADMIN
        ) {
          const activeAdminCount = await transaction.user.count({
            where: {
              role: UserRole.ADMIN,
              isActive: true,
              id: { not: target.id },
            },
          });

          if (activeAdminCount === 0) {
            throw new UserPolicyError(
              "ต้องมีผู้ดูแลระบบที่เปิดใช้งานอยู่อย่างน้อยหนึ่งคน",
            );
          }
        }

        const updatedUser = await transaction.user.update({
          where: { id: target.id },
          data: { role: parsedInput.role },
          select: USER_DETAIL_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.USER_ROLE_CHANGED,
          resourceType: AuditResourceType.USER,
          resourceId: updatedUser.id,
          before: { role: target.role },
          after: { role: updatedUser.role },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.ROLE_CHANGED,
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
        return returnActionError({ code: "POLICY", message: error.message });
      }
      throw error;
    }
  });
