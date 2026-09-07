"use client";

import { updateProfileNameAction } from "@/servers/profile/actions/update-profile-name-action";
import { updateProfileNameSchema } from "@/servers/profile/actions/update-profile-name-schema";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import type { Profile } from "@/servers/profile/types";
import { Alert, Button, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconAlertCircle, IconUser } from "@tabler/icons-react";
import { ProfileEditCard } from "./profile-edit-card";
import { useProfile } from "./profile-context";

export function ProfileNameForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { profile, updateProfile } = useProfile();
  const form = useForm<{ name: string; reason?: string }>({
    mode: "uncontrolled",
    initialValues: { name: profile.name, reason: "" },
    validate: schemaResolver(updateProfileNameSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm<
    { name: string; reason?: string },
    Profile
  >({
    form,
    action: updateProfileNameAction,
    onSuccessAction: (data) => {
      updateProfile(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.setInitialValues({ name: data.name, reason: "" });
      form.setValues({ name: data.name, reason: "" });
    },
    successNotification: {
      title: "บันทึกชื่อสำเร็จ",
      message: "ข้อมูลถูกอัปเดตแล้ว",
    },
  });

  const openReasonConfirmation = () => {
    let modalId = "";
    modalId = modals.openConfirmModal({
      title: "ยืนยันการเปลี่ยนชื่อ",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            ต้องการบันทึกชื่อผู้ใช้เป็น “{form.getValues().name}” ใช่หรือไม่
          </Text>
          <Textarea
            key={form.key("reason")}
            label="เหตุผล/หมายเหตุ"
            placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)"
            autosize
            minRows={2}
            maxRows={4}
            maxLength={500}
            {...form.getInputProps("reason")}
          />
        </Stack>
      ),
      labels: { confirm: "ยืนยันการบันทึก", cancel: "ยกเลิก" },
      closeOnConfirm: false,
      onCancel: () => {
        form.setFieldValue("reason", "");
        form.clearFieldError("reason");
      },
      onConfirm: () => {
        const validation = form.validate();
        if (validation.hasErrors) return;

        modals.close(modalId);
        submit(form.getValues());
      },
    });
  };

  const requestSave = form.onSubmit(() => {
    if (!form.isDirty()) return;

    clearError();
    form.setFieldValue("reason", "");
    openReasonConfirmation();
  });

  const resetForm = () => {
    clearError();
    form.reset();
  };

  return (
    <ProfileEditCard title="ชื่อผู้ใช้งาน" description="แก้ไขชื่อที่แสดงในระบบ">
      <form onSubmit={requestSave}>
        <Stack gap="md">
          <TextInput
            key={form.key("name")}
            label="ชื่อผู้ใช้"
            placeholder={profile.name}
            leftSection={<IconUser size={18} />}
            required
            maw={400}
            {...form.getInputProps("name")}
          />
          {form.isDirty() ? (
            <Group gap="sm">
              <Button type="button" variant="default" onClick={resetForm} disabled={pending}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={pending}
                w="fit-content"
              >
                บันทึก
              </Button>
            </Group>
          ) : null}
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </form>
    </ProfileEditCard>
  );
}
