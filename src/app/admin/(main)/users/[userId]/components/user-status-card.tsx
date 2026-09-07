"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { useRef, useTransition } from "react";
import { useAppSelector } from "@/admin/hooks";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import { setUserStatusAction } from "@/servers/user/actions/set-user-status-action";
import { useUser } from "./user-context";

export function UserStatusCard() {
  const { user } = useUser();

  return (
    <Card withBorder radius="lg" padding="xl">
      <Group justify="space-between" align="center" gap="lg" wrap="wrap">
        <Stack gap={4}>
          <Text fw={600}>สถานะบัญชี</Text>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              สถานะปัจจุบัน:
            </Text>
            <Badge color={user.isActive ? "green" : "danger"} variant="light">
              {user.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </Badge>
          </Group>
        </Stack>
        <UserStatusButton />
      </Group>
    </Card>
  );
}

function UserStatusButton() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation();
  const { user, updateUser } = useUser();
  const actorId = useAppSelector((state) => state.auth.user?.id);
  const [pending, startTransition] = useTransition();
  const reasonRef = useRef("");

  if (actorId === user.id) {
    return null;
  }

  const nextIsActive = !user.isActive;
  const actionLabel = nextIsActive ? "เปิดใช้งาน" : "ปิดใช้งาน";

  const confirmStatusChange = () => {
    reasonRef.current = "";
    let modalId = "";
    modalId = modals.openConfirmModal({
      title: `${actionLabel}ผู้ใช้งาน?`,
      children: (
        <Stack gap="sm">
          <Text size="sm">
            {nextIsActive
              ? "ผู้ใช้งานจะสามารถเข้าสู่ระบบได้อีกครั้ง"
              : "ผู้ใช้งานจะไม่สามารถเข้าสู่ระบบได้ และ session เดิมจะถูกปฏิเสธ"}
          </Text>
          <Textarea
            label="เหตุผล/หมายเหตุ"
            placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)"
            autosize
            minRows={2}
            maxRows={4}
            maxLength={500}
            defaultValue=""
            onChange={(event) => {
              reasonRef.current = event.currentTarget.value;
            }}
          />
        </Stack>
      ),
      labels: { confirm: actionLabel, cancel: "ยกเลิก" },
      confirmProps: { color: nextIsActive ? "brand" : "red" },
      closeOnConfirm: false,
      onCancel: () => {
        reasonRef.current = "";
      },
      onConfirm: () => {
        const reason = reasonRef.current || undefined;
        modals.close(modalId);
        startTransition(async () => {
          const result = await setUserStatusAction({
            userId: user.id,
            isActive: nextIsActive,
            reason,
          });

          reasonRef.current = "";

          if (result.validationErrors) {
            notifications.show({
              title: "ไม่สามารถเปลี่ยนสถานะได้",
              message:
                result.validationErrors.formErrors[0] ??
                "ข้อมูลสถานะไม่ถูกต้อง",
              color: "red",
            });
            return;
          }

          if (result.serverError) {
            notifications.show({
              title: "ไม่สามารถเปลี่ยนสถานะได้",
              message: result.serverError.message,
              color: "red",
            });
            return;
          }

          if (!result.data) {
            notifications.show({
              title: "ไม่สามารถเปลี่ยนสถานะได้",
              message: "กรุณาลองใหม่อีกครั้ง",
              color: "red",
            });
            return;
          }

          updateUser(result.data);
          invalidateAdminCaches({ resources: ["users"] });
          notifications.show({
            title: `ผู้ใช้งาน${actionLabel}แล้ว`,
            message: "สถานะถูกอัปเดตเรียบร้อยแล้ว",
            color: "green",
          });
        });
      },
    });
  };

  return (
    <Button
      variant={user.isActive ? "light" : "filled"}
      color={user.isActive ? "red" : "brand"}
      leftSection={
        user.isActive ? <IconLock size={17} /> : <IconLockOpen size={17} />
      }
      loading={pending}
      disabled={pending}
      onClick={confirmStatusChange}
    >
      {actionLabel}
    </Button>
  );
}
