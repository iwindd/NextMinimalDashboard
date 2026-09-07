"use client";

import { updateUserPasswordAction } from "@/servers/user/actions/update-user-password-action";
import { updateUserPasswordSchema } from "@/servers/user/actions/update-user-password-schema";
import type { UpdateUserPasswordInput } from "@/servers/user/types";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import type { UserDetail } from "@/servers/user/types";
import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Textarea,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";
import { useUser } from "./user-context";
import { UserEditCard } from "./user-edit-card";

export function UserPasswordForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { user, updateUser } = useUser();
  const [opened, { close, open }] = useDisclosure(false);
  const form = useForm<UpdateUserPasswordInput>({
    mode: "uncontrolled",
    initialValues: {
      userId: user.id,
      password: "",
      passwordConfirmation: "",
      reason: "",
    },
    validate: schemaResolver(updateUserPasswordSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm<
    UpdateUserPasswordInput,
    UserDetail
  >({
    form,
    action: updateUserPasswordAction,
    onSuccessAction: (data) => {
      updateUser(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.reset();
      close();
    },
    successNotification: {
      title: "เปลี่ยนรหัสผ่านสำเร็จ",
      message: "รหัสผ่านถูกอัปเดตแล้ว",
    },
  });

  const closeModal = () => {
    if (pending) return;
    clearError();
    form.reset();
    close();
  };

  return (
    <>
      <UserEditCard
        title="รหัสผ่าน"
        description="เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ"
      >
        <Button
          leftSection={<IconLock size={17} />}
          onClick={open}
          w="fit-content"
        >
          เปลี่ยนรหัสผ่าน
        </Button>
      </UserEditCard>

      <Modal
        opened={opened}
        onClose={closeModal}
        title="เปลี่ยนรหัสผ่าน"
        centered
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="md">
            <PasswordInput
              key={form.key("password")}
              label="รหัสผ่านใหม่"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              leftSection={<IconLock size={18} />}
              required
              autoComplete="new-password"
              {...form.getInputProps("password")}
            />
            <PasswordInput
              key={form.key("passwordConfirmation")}
              label="ยืนยันรหัสผ่าน"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              leftSection={<IconLock size={18} />}
              required
              autoComplete="new-password"
              {...form.getInputProps("passwordConfirmation")}
            />
            <Textarea
              key={form.key("reason")}
              label="เหตุผล/หมายเหตุ"
              placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)"
              autosize
              minRows={2}
              maxRows={4}
              {...form.getInputProps("reason")}
            />
            {error ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                {error}
              </Alert>
            ) : null}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={closeModal} disabled={pending}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={!form.isDirty()}
              >
                บันทึก
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
