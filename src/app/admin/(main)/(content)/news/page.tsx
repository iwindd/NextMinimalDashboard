"use client";

import { PageHeader } from "@/admin/components/page-header";
import { Container } from "@mantine/core";
import { useTranslations } from "next-intl";
import { NewsCreateModal } from "./components/news-create-modal";
import { NewsTable } from "./components/news-table";

export default function NewsPage() {
  const t = useTranslations("News");
  return (
    <Container w="100%" size="xl">
      <PageHeader
        title={t("title")}
        rightSection={
          <NewsCreateModal />
        }
      />
      <NewsTable />
    </Container>
  );
}
