import { getPath } from "@/admin/routes";
import { redirect } from "next/navigation";

/** Keeps links to the previous user-detail URL working. */
export default async function UserDetailRedirectPage({
  params,
}: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { userId } = await params;

  redirect(getPath("system.users.profile", { userId }));
}
