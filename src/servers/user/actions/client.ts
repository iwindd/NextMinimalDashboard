import { requireManageUsers } from "../authorization";
import { UserAuthorizationError } from "../exceptions";
import { actionClient, returnActionError } from "@/lib/action-client";
import { getRequestContext } from "@/lib/audit/request-context";

export const manageUsersActionClient = actionClient.use(async ({ next }) => {
  try {
    const actor = await requireManageUsers();
    const requestContext = await getRequestContext();

    return next({ ctx: { actor, requestContext } });
  } catch (error) {
    if (error instanceof UserAuthorizationError) {
      return returnActionError({
        code: "UNAUTHORIZED",
        message: "คุณไม่มีสิทธิ์จัดการผู้ใช้งาน",
      });
    }

    throw error;
  }
});
