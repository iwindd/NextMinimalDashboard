"use client";

import { Button, Container } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/admin/components/page-header";
import { CreateUserModal } from "./components/create-user-modal";
import { UsersTable } from "./components/users-table";

export default function UsersPage() {
  const t = useTranslations("Users");
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <Container w="100%" size="xl">
      <PageHeader
        title={t("title")}
        rightSection={
          <Button leftSection={<IconPlus size={18} />} onClick={open}>
            {t("create")}
          </Button>
        }
      />
      <UsersTable />
      <CreateUserModal opened={opened} onCloseAction={close} />
    </Container>
  );
}
