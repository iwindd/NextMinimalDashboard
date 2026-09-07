"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, AuditResourceType } from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import {
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { manageUsersActionClient } from "./client";
import { updateUserNameSchema } from "./update-user-name-schema";
import { UserNotFoundError } from "../exceptions";
import { USER_DETAIL_SELECT, toUserDetail } from "../helpers";

export const updateUserNameAction = manageUsersActionClient
  .inputSchema(updateUserNameSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: parsedInput.userId },
          select: USER_DETAIL_SELECT,
        });

        if (!target) throw new UserNotFoundError();

        if (target.name === parsedInput.name) return target;

        const updatedUser = await transaction.user.update({
          where: { id: target.id },
          data: { name: parsedInput.name },
          select: USER_DETAIL_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.USER_NAME_CHANGED,
          resourceType: AuditResourceType.USER,
          resourceId: updatedUser.id,
          before: { name: target.name },
          after: { name: updatedUser.name },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.NAME_CHANGED_BY_ADMIN,
          source: UserSecuritySource.ADMIN,
          outcome: UserSecurityOutcome.SUCCESS,
        });

        return updatedUser;
      });

      revalidatePath("/admin/users");
      revalidatePath(`/admin/users/${user.id}/profile`);
      return toUserDetail(user);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: "ไม่พบผู้ใช้งาน" });
      }
      throw error;
    }
  });
