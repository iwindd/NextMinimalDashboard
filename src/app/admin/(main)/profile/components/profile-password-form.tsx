"use client";

import { updateProfilePasswordAction } from "@/servers/profile/actions/update-profile-password-action";
import { updateProfilePasswordSchema } from "@/servers/profile/actions/update-profile-password-schema";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import type { Profile } from "@/servers/profile/types";
import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";
import { ProfileEditCard } from "./profile-edit-card";
import { useProfile } from "./profile-context";

export function ProfilePasswordForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { updateProfile } = useProfile();
  const [opened, { close, open }] = useDisclosure(false);
  const form = useForm({
    mode: "uncontrolled" as const,
    initialValues: { oldPassword: "", password: "", passwordConfirmation: "" },
    validate: schemaResolver(updateProfilePasswordSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm<
    { oldPassword: string; password: string; passwordConfirmation: string },
    Profile
  >({
    form,
    action: updateProfilePasswordAction,
    onSuccessAction: (data) => {
      updateProfile(data);
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
      <ProfileEditCard
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
      </ProfileEditCard>
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
              key={form.key("oldPassword")}
              label="รหัสผ่านเดิม"
              leftSection={<IconLock size={18} />}
              required
              autoComplete="current-password"
              {...form.getInputProps("oldPassword")}
            />
            <PasswordInput
              key={form.key("password")}
              label="รหัสผ่านใหม่"
              leftSection={<IconLock size={18} />}
              required
              autoComplete="new-password"
              {...form.getInputProps("password")}
            />
            <PasswordInput
              key={form.key("passwordConfirmation")}
              label="ยืนยันรหัสผ่านใหม่"
              leftSection={<IconLock size={18} />}
              required
              autoComplete="new-password"
              {...form.getInputProps("passwordConfirmation")}
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
