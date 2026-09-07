"use client";

import { updateUserEmailAction } from "@/servers/user/actions/update-user-email-action";
import { updateUserEmailSchema } from "@/servers/user/actions/update-user-email-schema";
import type { UpdateUserEmailInput } from "@/servers/user/types";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import { Alert, Button, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconAlertCircle, IconAt } from "@tabler/icons-react";
import { useUser } from "./user-context";
import { UserEditCard } from "./user-edit-card";

export function UserEmailForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { user, updateUser } = useUser();
  const form = useForm<UpdateUserEmailInput>({
    mode: "uncontrolled",
    initialValues: { userId: user.id, email: user.email, reason: "" },
    validate: schemaResolver(updateUserEmailSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm({
    form,
    action: updateUserEmailAction,
    onSuccessAction: (data) => {
      updateUser(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.setInitialValues({ userId: data.id, email: data.email, reason: "" });
      form.setValues({ userId: data.id, email: data.email, reason: "" });
    },
    successNotification: {
      title: "บันทึกอีเมลสำเร็จ",
      message: "ข้อมูลถูกอัปเดตแล้ว",
    },
  });

  const openReasonConfirmation = () => {
    let modalId = "";
    modalId = modals.openConfirmModal({
      title: "ยืนยันการเปลี่ยนอีเมล",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            ต้องการบันทึกอีเมลเป็น “{form.getValues().email}” ใช่หรือไม่
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
    <UserEditCard title="อีเมล" description="อีเมลที่ใช้สำหรับเข้าสู่ระบบ">
      <form onSubmit={requestSave}>
        <Stack gap="md">
          <TextInput
            key={form.key("email")}
            label="อีเมล"
            placeholder={user.email}
            type="email"
            leftSection={<IconAt size={18} />}
            required
            maw={400}
            {...form.getInputProps("email")}
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
