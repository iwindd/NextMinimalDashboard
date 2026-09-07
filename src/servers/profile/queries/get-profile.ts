import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PROFILE_SELECT, toProfile } from "../helpers";

export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: PROFILE_SELECT,
  });

  return user ? toProfile(user) : null;
}
