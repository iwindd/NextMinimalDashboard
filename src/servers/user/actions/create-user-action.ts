"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import {
  AuditAction,
  AuditResourceType,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import { returnValidationErrors } from "next-safe-action";
import { prisma } from "@/lib/prisma";
import { manageUsersActionClient } from "./client";
import { createUserSchema } from "./create-user-schema";
import { isUniqueEmailError } from "../helpers";

export const createUserAction = manageUsersActionClient
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const passwordHash = await hash(parsedInput.password, 12);
      const user = await prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            name: parsedInput.name,
            email: parsedInput.email,
            passwordHash,
            role: parsedInput.role,
          },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });

        const target = {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
        };

        await transaction.createAuditLog({
          actor: ctx.actor,
          target,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          action: AuditAction.USER_CREATED,
          resourceType: AuditResourceType.USER,
          resourceId: createdUser.id,
          after: {
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
            isActive: createdUser.isActive,
          },
        });

        await transaction.userSecurityLog.createLog({
          actor: ctx.actor,
          target,
          requestContext: ctx.requestContext,
          reason: parsedInput.reason,
          event: UserSecurityEvent.ACCOUNT_CREATED,
          source: UserSecuritySource.ADMIN,
          outcome: UserSecurityOutcome.SUCCESS,
        });

        return createdUser;
      });

      revalidatePath("/admin/users");
      revalidatePath(`/admin/users/${user.id}/profile`);

      return { id: user.id };
    } catch (error) {
      if (isUniqueEmailError(error)) {
        return returnValidationErrors(createUserSchema, {
          email: { _errors: ["อีเมลนี้ถูกใช้งานแล้ว"] },
        });
      }

      throw error;
    }
  });
