import { actionClient, returnActionError } from "@/lib/action-client";
import { getRequestContext } from "@/lib/audit/request-context";
import { requireManageNews } from "../authorization";
import { NewsAuthorizationError } from "../exceptions";

export const manageNewsActionClient = actionClient.use(async ({ next }) => {
  try {
    const actor = await requireManageNews();
    const requestContext = await getRequestContext();
    return next({ ctx: { actor, requestContext } });
  } catch (error) {
    if (error instanceof NewsAuthorizationError) {
      return returnActionError({
        code: "UNAUTHORIZED",
        message: error.message,
      });
    }
    throw error;
  }
});
