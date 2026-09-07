"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuditResourceType,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { profileActionClient } from "./client";
import { updateProfilePasswordSchema } from "./update-profile-password-schema";
import {
  ProfileCurrentPasswordError,
  ProfileNotFoundError,
} from "../exceptions";
import { PROFILE_SELECT, toProfile } from "../helpers";

export const updateProfilePasswordAction = profileActionClient
  .inputSchema(updateProfilePasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const user = await prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: ctx.actor.id },
          select: { ...PROFILE_SELECT, passwordHash: true },
        });

        if (!target) throw new ProfileNotFoundError();

        const validPassword = await compare(
          parsedInput.oldPassword,
          target.passwordHash,
        );
        if (!validPassword) throw new ProfileCurrentPasswordError();

        const updatedProfile = await transaction.user.update({
          where: { id: target.id },
          data: { passwordHash: await hash(parsedInput.password, 12) },
          select: PROFILE_SELECT,
        });

        await transaction.createAuditLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.PROFILE_PASSWORD_CHANGED,
          resourceType: AuditResourceType.PROFILE,
          resourceId: updatedProfile.id,
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target: updatedProfile,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.PASSWORD_CHANGED_BY_SELF,
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
      if (error instanceof ProfileCurrentPasswordError) {
        return returnActionError({ code: "POLICY", message: error.message });
      }
      throw error;
    }
  });
