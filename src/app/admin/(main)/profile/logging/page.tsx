import { AuditLogsTable } from "@/admin/features/audit-log/audit-logs-table";

export default function ProfileLoggingPage() {
  return <AuditLogsTable scope="own" />;
}
