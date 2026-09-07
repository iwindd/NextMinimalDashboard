import { getViewAllAuditLogsActor } from "@/servers/audit-log/authorization";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuditLogsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getViewAllAuditLogsActor();
  if (!actor) {
    notFound();
  }

  return children;
}
