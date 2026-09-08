import { apiServerFetch } from "@/lib/api-server";
import type { UserDetail } from "../types";

type ApiUser = {
  id: string;
  githubLogin: string;
  name: string | null;
  role: "ADMIN" | "USER";
  accessStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toUser(user: ApiUser): UserDetail {
  return {
    id: user.id,
    name: user.name ?? user.githubLogin,
    email: user.githubLogin,
    role: user.role === "ADMIN" ? "ADMIN" : "EDITOR",
    isActive: user.isActive && user.accessStatus !== "SUSPENDED",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserDetail(userId: string) {
  try {
    const result = await apiServerFetch<{ user: ApiUser }>(`admin/users/${encodeURIComponent(userId)}`);
    return toUser(result.user);
  } catch {
    return null;
  }
}
