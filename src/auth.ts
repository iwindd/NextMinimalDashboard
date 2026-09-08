import { cookies } from "next/headers";

type ApiPrincipal = {
  id: string;
  githubLogin: string;
  name: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  accessStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
};

type ApiSessionResponse = { user: ApiPrincipal };

const apiOrigin =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5050";

export async function auth() {
  const cookieStore = await cookies();
  if (!cookieStore.has("pf_session")) return null;

  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api/v1/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const { user } = (await response.json()) as ApiSessionResponse;
  if (!user.isActive || user.accessStatus !== "APPROVED") return null;

  return {
    user: {
      id: user.id,
      name: user.name ?? user.githubLogin,
      email: null,
      role: user.role === "ADMIN" ? "ADMIN" : "EDITOR",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  } as const;
}
