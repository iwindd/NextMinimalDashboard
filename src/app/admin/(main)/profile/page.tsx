"use client";

import { Stack, Text } from "@mantine/core";
import { ProfileNameForm } from "./components/profile-name-form";
import { useProfile } from "./components/profile-context";

export default function ProfilePage() {
  const { profile } = useProfile();
  return (
    <Stack gap="lg">
      <ProfileNameForm />
      <Text size="sm" c="dimmed">
        GitHub: {profile.email ?? "เชื่อมต่อผ่านบัญชี GitHub"} · บทบาท: {profile.role}
      </Text>
    </Stack>
  );
}
