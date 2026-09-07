import { AuditLogsTable } from "@/admin/features/audit-log/audit-logs-table";

export default async function UserLoggingPage({
  params,
}: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { userId } = await params;

  return <AuditLogsTable scope="user" userId={userId} />;
}
