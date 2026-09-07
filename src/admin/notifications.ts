import type { AdminUser } from "../session";

export const NOTIFICATION_KEYS = {
  news: "news",
} as const;

export type NotificationKey =
  (typeof NOTIFICATION_KEYS)[keyof typeof NOTIFICATION_KEYS];
export type NotificationCounts = Readonly<Record<NotificationKey, number>>;

export const MOCK_NOTIFICATION_COUNTS_BY_ROLE = {
  ADMIN: {
    news: 3,
  },
  EDITOR: {
    news: 3,
  },
} as const satisfies Record<AdminUser["role"], NotificationCounts>;
