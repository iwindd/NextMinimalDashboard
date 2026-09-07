import { notFound } from "next/navigation";
import { getManageUsersActor } from "@/servers/user/authorization";

export const dynamic = "force-dynamic";

export default async function UsersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getManageUsersActor();
  if (!actor) {
    notFound();
  }

  return children;
}
