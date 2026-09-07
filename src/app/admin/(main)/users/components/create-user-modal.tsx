"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { getPath } from "@/admin/routes";
import { createUserAction } from "@/servers/user/actions/create-user-action";
import { createUserSchema } from "@/servers/user/actions/create-user-schema";
import type { CreateUserInput } from "@/servers/user/types";
import classes from "./create-user-modal.style.module.css";

type CreateUserModalProps = {
  opened: boolean;
  onCloseAction: () => void;
};

export function CreateUserModal({
  opened,
  onCloseAction,
}: CreateUserModalProps) {
  const router = useRouter();
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateUserInput>({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      role: "EDITOR",
      reason: "",
    },
    validate: schemaResolver(createUserSchema, { sync: true }),
  });

  const closeModal = () => {
    if (pending) {
      return;
    }

    setError(null);
    form.reset();
    onCloseAction();
  };

  const submit = (values: CreateUserInput) => {
    setError(null);
    form.clearErrors();

    startTransition(async () => {
      const result = await createUserAction(values);

      if (result.validationErrors) {
        setError(
          result.validationErrors.formErrors[0] ??
            "กรุณาตรวจสอบข้อมูลที่กรอก",
        );
        for (const [field, messages] of Object.entries(
          result.validationErrors.fieldErrors,
        )) {
          const message = messages?.[0];
          if (message) {
            form.setFieldError(field, message);
          }
        }
        return;
      }

      if (result.serverError) {
        setError(result.serverError.message);
        return;
      }

      if (!result.data) {
        setError("ไม่สามารถสร้างผู้ใช้งานได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      notifications.show({
        title: "สร้างผู้ใช้งานสำเร็จ",
        message: "กำลังเปิดหน้ารายละเอียดผู้ใช้งาน",
        color: "green",
      });
      form.reset();
      onCloseAction();
      invalidateAdminCaches({ resources: ["users"] });
      router.push(getPath("system.users.profile", { userId: result.data.id }));
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title="สร้างผู้ใช้งาน"
      centered
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
    >
      <form className={classes.form} onSubmit={form.onSubmit(submit)}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}
          <TextInput
            key={form.key("name")}
            label="ชื่อผู้ใช้งาน"
            placeholder="เช่น สมชาย ใจดี"
            leftSection={<IconUser size={18} />}
            required
            autoComplete="name"
            {...form.getInputProps("name")}
          />
          <TextInput
            key={form.key("email")}
            label="อีเมล"
            placeholder="user@example.com"
            leftSection={<IconMail size={18} />}
            required
            autoComplete="email"
            {...form.getInputProps("email")}
          />
          <Select
            key={form.key("role")}
            label="บทบาท"
            required
            allowDeselect={false}
            clearable={false}
            data={[
              { value: "ADMIN", label: "ผู้ดูแลระบบ" },
              { value: "EDITOR", label: "ผู้แก้ไข" },
            ]}
            {...form.getInputProps("role")}
            onChange={(value) => {
              form.setFieldValue(
                "role",
                value === "ADMIN" || value === "EDITOR" ? value : "EDITOR",
              );
            }}
          />
          <PasswordInput
            key={form.key("password")}
            label="รหัสผ่าน"
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
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeModal} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" loading={pending}>
              สร้างผู้ใช้งาน
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
