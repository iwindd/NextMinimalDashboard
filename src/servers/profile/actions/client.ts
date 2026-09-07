import { auth } from "@/auth";
import { actionClient, returnActionError } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/audit/request-context";

export const profileActionClient = actionClient.use(async ({ next }) => {
  const session = await auth();
  if (!session?.user?.id) {
    return returnActionError({
      code: "UNAUTHORIZED",
      message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ",
    });
  }

  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!actor?.isActive) {
    return returnActionError({
      code: "UNAUTHORIZED",
      message: "ไม่สามารถแก้ไขโปรไฟล์ได้",
    });
  }

  const requestContext = await getRequestContext();
  return next({ ctx: { actor, requestContext } });
});
