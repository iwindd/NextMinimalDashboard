"use client";

import { Container } from "@mantine/core";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/admin/components/page-header";
import { UsersTable } from "./components/users-table";

export default function UsersPage() {
  const t = useTranslations("Users");

  return (
    <Container w="100%" size="xl">
      <PageHeader
        title={t("title")}
      />
      <UsersTable />
    </Container>
  );
}
