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
import { profileActionClient } from "./client";
import { updateProfileNameSchema } from "./update-profile-name-schema";
import { ProfileNotFoundError } from "../exceptions";
import { PROFILE_SELECT, toProfile } from "../helpers";

export const updateProfileNameAction = profileActionClient
  .inputSchema(updateProfileNameSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: ctx.actor.id },
          select: PROFILE_SELECT,
        });

        if (!target) throw new ProfileNotFoundError();
        if (target.name === parsedInput.name) return target;

        const updatedProfile = await transaction.user.update({
          where: { id: target.id },
          data: { name: parsedInput.name },
          select: PROFILE_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.PROFILE_NAME_CHANGED,
          resourceType: AuditResourceType.PROFILE,
          resourceId: updatedProfile.id,
          before: { name: target.name },
          after: { name: updatedProfile.name },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.NAME_CHANGED_BY_SELF,
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
      throw error;
    }
  });
