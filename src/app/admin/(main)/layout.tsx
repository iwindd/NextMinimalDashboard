import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/admin/components/admin-shell";
import { UiCustomizeProvider } from "@/admin/providers/ui-customize-provider";

export default async function AdminMainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  return (
    <UiCustomizeProvider>
      <AdminShell user={session.user}>{children}</AdminShell>
    </UiCustomizeProvider>
  );
}
