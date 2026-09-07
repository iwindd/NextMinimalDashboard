"use client";

import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { createNewsAction } from "@/servers/news/actions/create-news-action";
import { Button, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function NewsCreateModal() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm({ initialValues: { title: "", excerpt: "" } });

  const close = () => {
    if (pending) return;
    setOpened(false);
    form.reset();
  };

  const createDraft = form.onSubmit((values) => {
    startTransition(async () => {
      const result = await createNewsAction({
        title: values.title,
        excerpt: values.excerpt || null,
        bodyHtml: "",
        categoryId: null,
        coverFileId: null,
        readTimeMinutes: null,
        source: [],
      });
      if (result.serverError || !result.data) {
        notifications.show({
          title: "สร้างข่าวไม่สำเร็จ",
          message: result.serverError?.message ?? "กรุณาตรวจสอบข้อมูล",
          color: "red",
        });
        return;
      }
      invalidateAdminCaches({ resources: ["news"] });
      router.push(`/admin/news/${result.data.id}`);
    });
  });

  return (
    <>
      <Button onClick={() => setOpened(true)} disabled={pending} leftSection={<IconPlus size={18} />}>
        สร้างข่าวสาร
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title="เริ่มสร้างข่าวสาร"
        centered
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        <form onSubmit={createDraft}>
          <Stack>
            <TextInput
              label="หัวข้อข่าว"
              required
              autoFocus
              disabled={pending}
              {...form.getInputProps("title")}
            />
            <Textarea
              label="คำโปรยข่าว"
              description="ไม่บังคับกรอก สามารถแก้ไขเพิ่มเติมภายหลังได้"
              minRows={3}
              autosize
              disabled={pending}
              {...form.getInputProps("excerpt")}
            />
            <Button type="submit" loading={pending}>
              สร้างข่าวและไปต่อ
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
