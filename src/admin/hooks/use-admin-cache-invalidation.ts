"use client";

import { useCallback } from "react";
import { auditLogsApi } from "@/admin/features/audit-log/audit-logs-api";
import { newsApi } from "@/admin/features/news/news-api";
import { notificationsApi } from "@/admin/features/notifications/notifications-api";
import { usersApi } from "@/admin/features/user/users-api";
import { useAppDispatch } from "@/admin/hooks";

type AdminCacheResource = "users" | "news";
type AdminCacheInvalidationOptions = {
  resources?: readonly AdminCacheResource[];
  auditLogs?: boolean;
  notifications?: boolean;
};

export function useAdminCacheInvalidation() {
  const dispatch = useAppDispatch();
  const invalidateAdminCaches = useCallback(({
    resources = [], auditLogs = true, notifications = false,
  }: AdminCacheInvalidationOptions = {}) => {
    for (const resource of new Set(resources)) {
      if (resource === "users") dispatch(usersApi.util.invalidateTags(["Users"]));
      if (resource === "news") dispatch(newsApi.util.invalidateTags(["News"]));
    }
    if (auditLogs) dispatch(auditLogsApi.util.invalidateTags(["AuditLogs"]));
    if (notifications) dispatch(notificationsApi.util.invalidateTags(["Notifications"]));
  }, [dispatch]);

  const resetAllAdminApiCaches = useCallback(() => {
    dispatch(usersApi.util.resetApiState());
    dispatch(auditLogsApi.util.resetApiState());
    dispatch(newsApi.util.resetApiState());
    dispatch(notificationsApi.util.resetApiState());
  }, [dispatch]);

  return { invalidateAdminCaches, resetAllAdminApiCaches };
}
