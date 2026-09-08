import { auth } from "@/auth";
import type { Profile } from "../types";

export async function getProfile(): Promise<Profile | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email,
    role: session.user.role,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };
}
