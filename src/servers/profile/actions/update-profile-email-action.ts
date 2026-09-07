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
import { profileActionClient } from "./client";
import { updateProfileEmailSchema } from "./update-profile-email-schema";
import { ProfileNotFoundError } from "../exceptions";
import { isUniqueEmailError, PROFILE_SELECT, toProfile } from "../helpers";

export const updateProfileEmailAction = profileActionClient
  .inputSchema(updateProfileEmailSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: ctx.actor.id },
          select: PROFILE_SELECT,
        });

        if (!target) throw new ProfileNotFoundError();
        if (target.email === parsedInput.email) return target;

        const updatedProfile = await transaction.user.update({
          where: { id: target.id },
          data: { email: parsedInput.email },
          select: PROFILE_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.PROFILE_EMAIL_CHANGED,
          resourceType: AuditResourceType.PROFILE,
          resourceId: updatedProfile.id,
          before: { email: target.email },
          after: { email: updatedProfile.email },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.EMAIL_CHANGED_BY_SELF,
          source: UserSecuritySource.SELF,
          outcome: UserSecurityOutcome.SUCCESS,
        });

        return updatedProfile;
      });

      revalidatePath("/admin/profile");
      return toProfile(user);
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        return returnActionError({ code: "NOT_FOUND", message: error.message });
      }
      if (isUniqueEmailError(error)) {
        return returnValidationErrors(updateProfileEmailSchema, {
          email: { _errors: ["อีเมลนี้ถูกใช้งานแล้ว"] },
        });
      }
      throw error;
    }
  });
