"use client";

import { useAppSelector } from "@/admin/hooks";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import { updateUserRoleAction } from "@/servers/user/actions/update-user-role-action";
import { updateUserRoleSchema } from "@/servers/user/actions/update-user-role-schema";
import type { UpdateUserRoleInput } from "@/servers/user/types";
import { Alert, Button, Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { IconAlertCircle, IconShield } from "@tabler/icons-react";
import { useUser } from "./user-context";
import { UserEditCard } from "./user-edit-card";

export function UserRoleForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { user, updateUser } = useUser();
  const actorId = useAppSelector((state) => state.auth.user?.id);
  const isSelf = actorId === user.id;
  const form = useForm<UpdateUserRoleInput>({
    mode: "uncontrolled",
    initialValues: { userId: user.id, role: user.role, reason: "" },
    validate: schemaResolver(updateUserRoleSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm({
    form,
    action: updateUserRoleAction,
    onSuccessAction: (data) => {
      updateUser(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.setInitialValues({ userId: data.id, role: data.role, reason: "" });
      form.setValues({ userId: data.id, role: data.role, reason: "" });
    },
    successNotification: {
      title: "บันทึกบทบาทสำเร็จ",
      message: "ข้อมูลถูกอัปเดตแล้ว",
    },
  });

  const openReasonConfirmation = () => {
    let modalId = "";
    const nextRoleLabel =
      form.getValues().role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้แก้ไข";

    modalId = modals.openConfirmModal({
      title: "ยืนยันการเปลี่ยนบทบาท",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            ต้องการเปลี่ยนบทบาทเป็น “{nextRoleLabel}” ใช่หรือไม่
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
      title="บทบาท"
      description="กำหนดระดับสิทธิ์ของผู้ใช้งาน"
    >
      <form onSubmit={requestSave}>
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          ) : null}
          <Select
            key={form.key("role")}
            label="บทบาท"
            leftSection={<IconShield size={18} />}
            required
            disabled={isSelf}
            allowDeselect={false}
            clearable={false}
            maw={400}
            placeholder={user.role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้แก้ไข"}
            description={
              isSelf ? "ไม่สามารถลดสิทธิ์ของบัญชีที่กำลังใช้งานได้" : undefined
            }
            data={[
              { value: "ADMIN", label: "ผู้ดูแลระบบ" },
              { value: "EDITOR", label: "ผู้แก้ไข" },
            ]}
            {...form.getInputProps("role")}
            onChange={(value) => {
              form.setFieldValue(
                "role",
                value === "ADMIN" || value === "EDITOR" ? value : user.role,
              );
            }}
          />
          {form.isDirty() ? (
            <Group gap="sm">
              <Button type="button" variant="default" onClick={resetForm} disabled={pending}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={isSelf}
                w="fit-content"
              >
                บันทึก
              </Button>
            </Group>
          ) : null}
        </Stack>
      </form>
    </UserEditCard>
  );
}
