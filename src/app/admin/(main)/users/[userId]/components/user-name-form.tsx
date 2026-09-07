"use client";

import { updateUserNameAction } from "@/servers/user/actions/update-user-name-action";
import { updateUserNameSchema } from "@/servers/user/actions/update-user-name-schema";
import type { UpdateUserNameInput } from "@/servers/user/types";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import { Alert, Button, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconAlertCircle, IconUser } from "@tabler/icons-react";
import { useUser } from "./user-context";
import { UserEditCard } from "./user-edit-card";

export function UserNameForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { user, updateUser } = useUser();
  const form = useForm<UpdateUserNameInput>({
    mode: "uncontrolled",
    initialValues: { userId: user.id, name: user.name, reason: "" },
    validate: schemaResolver(updateUserNameSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm({
    form,
    action: updateUserNameAction,
    onSuccessAction: (data) => {
      updateUser(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.setInitialValues({ userId: data.id, name: data.name, reason: "" });
      form.setValues({ userId: data.id, name: data.name, reason: "" });
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
    <UserEditCard
      title="ชื่อผู้ใช้งาน"
      description="แก้ไขชื่อที่แสดงในระบบ"
    >
      <form onSubmit={requestSave}>
        <Stack gap="md">
          <TextInput
            key={form.key("name")}
            label="ชื่อผู้ใช้"
            placeholder={user.name}
            leftSection={<IconUser size={18} />}
            maw={400}
            required
            {...form.getInputProps("name")}
          />
          {form.isDirty() ? (
            <Group gap="sm">
              <Button type="button" variant="default" onClick={resetForm} disabled={pending}>
                ยกเลิก
              </Button>
              <Button type="submit" loading={pending} w="fit-content">
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
    </UserEditCard>
  );
}
