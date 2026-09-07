import { getManageNewsActor } from "@/servers/news/authorization";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getManageNewsActor();
  if (!actor) notFound();
  return children;
}
