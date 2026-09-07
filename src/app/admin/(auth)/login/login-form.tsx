"use client";

import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { IconAlertCircle, IconLock, IconMail } from "@tabler/icons-react";
import { getSession, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUser } from "@/admin/features/auth/auth-slice";
import { useAppDispatch } from "@/admin/hooks";
import { useAdminCacheInvalidation } from "@/admin/hooks/use-admin-cache-invalidation";
import {
  credentialsSchema,
  type CredentialsInput,
} from "@/validation/auth";

export function LoginForm() {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const dispatch = useAppDispatch();
  const { resetAllAdminApiCaches } = useAdminCacheInvalidation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<CredentialsInput>({
    mode: "uncontrolled",
    initialValues: { email: "", password: "" },
    validate: schemaResolver(credentialsSchema, { sync: true }),
  });

  const submit = (values: CredentialsInput) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
          redirectTo: "/admin",
        });

        if (!result?.ok) {
          setError(t("invalidCredentials"));
          return;
        }

        const session = await getSession();
        const sessionUser = session?.user;

        if (!sessionUser?.id || !sessionUser.role) {
          setError(t("userLoadFailed"));
          return;
        }

        dispatch(
          setUser({
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role,
          }),
        );
        resetAllAdminApiCaches();

        router.push(result.url || "/admin");
      } catch {
        setError(t("loginFailed"));
      }
    });
  };

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {error}
          </Alert>
        )}
        <TextInput
          key={form.key("email")}
          label={common("email")}
          placeholder="admin@example.com"
          leftSection={<IconMail size={18} />}
          autoComplete="email"
          required
          {...form.getInputProps("email")}
        />
        <PasswordInput
          key={form.key("password")}
          label={common("password")}
          placeholder={t("enterPassword")}
          leftSection={<IconLock size={18} />}
          autoComplete="current-password"
          required
          {...form.getInputProps("password")}
        />
        <Button type="submit" fullWidth size="md" loading={pending} mt="sm">
          {t("login")}
        </Button>
      </Stack>
    </form>
  );
}
