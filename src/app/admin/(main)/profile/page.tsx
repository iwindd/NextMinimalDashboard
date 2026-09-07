"use client";

import { Stack } from "@mantine/core";
import { ProfileEmailForm } from "./components/profile-email-form";
import { ProfileNameForm } from "./components/profile-name-form";
import { ProfilePasswordForm } from "./components/profile-password-form";

export default function ProfilePage() {
  return (
    <Stack gap="lg">
      <ProfileNameForm />
      <ProfileEmailForm />
      <ProfilePasswordForm />
    </Stack>
  );
}
