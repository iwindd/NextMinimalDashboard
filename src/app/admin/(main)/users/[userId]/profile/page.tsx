"use client";

import { Stack } from "@mantine/core";
import { UserEmailForm } from "../components/user-email-form";
import { UserNameForm } from "../components/user-name-form";
import { UserPasswordForm } from "../components/user-password-form";
import { UserRoleForm } from "../components/user-role-form";
import { UserStatusCard } from "../components/user-status-card";

export default function UserProfilePage() {
  return (
    <Stack gap="lg">
      <UserNameForm />
      <UserEmailForm />
      <UserRoleForm />
      <UserPasswordForm />
      <UserStatusCard />
    </Stack>
  );
}
