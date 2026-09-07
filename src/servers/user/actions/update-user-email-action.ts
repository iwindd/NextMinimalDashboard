"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuditResourceType,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { manageUsersActionClient } from "./client";
import { updateUserEmailSchema } from "./update-user-email-schema";
import { UserNotFoundError } from "../exceptions";
import { isUniqueEmailError, USER_DETAIL_SELECT, toUserDetail } from "../helpers";

export const updateUserEmailAction = manageUsersActionClient
  .inputSchema(updateUserEmailSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: parsedInput.userId },
          select: USER_DETAIL_SELECT,
        });

        if (!target) throw new UserNotFoundError();

        if (target.email === parsedInput.email) return target;

        const updatedUser = await transaction.user.update({
          where: { id: target.id },
          data: { email: parsedInput.email },
          select: USER_DETAIL_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.USER_EMAIL_CHANGED,
          resourceType: AuditResourceType.USER,
          resourceId: updatedUser.id,
          before: { email: target.email },
          after: { email: updatedUser.email },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedUser,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.EMAIL_CHANGED_BY_ADMIN,
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
      if (isUniqueEmailError(error)) {
        return returnValidationErrors(updateUserEmailSchema, {
          email: { _errors: ["อีเมลนี้ถูกใช้งานแล้ว"] },
        });
      }
      throw error;
    }
  });
