"use client";

import { AdminUser } from "@/session";
import {
  Avatar,
  Badge,
  Box,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import classes from "./style.module.css";
import { useTranslations } from "next-intl";

export function HomePage({ user }: { user: AdminUser }) {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const displayName = user.name || user.email || common("unknown");

  return (
    <Container w="100%" size="xl">
      <Stack gap="xl">
        <Paper className={classes.welcomeCard} p={{ base: "lg", sm: "xl" }}>
          <Group justify="space-between" align="center" gap="lg" wrap="wrap">
            <Group gap="md" align="center" wrap="nowrap">
              <Box className={classes.avatarWrapper}>
                <Avatar size={68} radius="xl" color="brand">
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Box component="span" className={classes.onlineBadge} />
              </Box>
              <Stack gap={3}>
                <Text size="xs" fw={600} c="brand">
                  {t("greeting")}
                </Text>
                <Title order={2}>{displayName}</Title>
                <Group gap="xs">
                  <Badge variant="light" color="gray">
                    {user.role === "ADMIN" ? common("admin") : common("editor")}
                  </Badge>
                </Group>
              </Stack>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
