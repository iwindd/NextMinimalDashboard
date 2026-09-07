"use client";

import { updateProfileEmailAction } from "@/servers/profile/actions/update-profile-email-action";
import { updateProfileEmailSchema } from "@/servers/profile/actions/update-profile-email-schema";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { useServerActionForm } from "@/admin/hooks/use-server-action-form";
import type { Profile } from "@/servers/profile/types";
import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { IconAlertCircle, IconAt } from "@tabler/icons-react";
import { ProfileEditCard } from "./profile-edit-card";
import { useProfile } from "./profile-context";

export function ProfileEmailForm() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { profile, updateProfile } = useProfile();
  const form = useForm<{ email: string }>({
    mode: "uncontrolled",
    initialValues: { email: profile.email },
    validate: schemaResolver(updateProfileEmailSchema, { sync: true }),
  });

  const { error, pending, submit, clearError } = useServerActionForm<
    { email: string },
    Profile
  >({
    form,
    action: updateProfileEmailAction,
    onSuccessAction: (data) => {
      updateProfile(data);
      invalidateAdminCaches({ resources: ["users"] });
      form.setInitialValues({ email: data.email });
      form.setValues({ email: data.email });
    },
    successNotification: {
      title: "บันทึกอีเมลสำเร็จ",
      message: "ข้อมูลถูกอัปเดตแล้ว",
    },
  });

  const resetForm = () => {
    clearError();
    form.reset();
  };

  return (
    <ProfileEditCard title="อีเมล" description="อีเมลที่ใช้สำหรับเข้าสู่ระบบ">
      <form
        onSubmit={form.onSubmit(submit)}
      >
        <Stack gap="md">
          <TextInput
            key={form.key("email")}
            label="อีเมล"
            placeholder={profile.email}
            type="email"
            leftSection={<IconAt size={18} />}
            maw={400}
            required
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
    </ProfileEditCard>
  );
}
