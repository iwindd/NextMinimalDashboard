import type { AdminUser } from "../session";

const PERMISSIONS = {
  viewDashboard: "dashboard.view",
  manageContent: "content.manage",
  manageUsers: "users.manage",
  viewAuditLogs: "audit-logs.view",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionMode = "all" | "any";
export type GrantedPermission = (typeof PERMISSIONS)[PermissionKey] | "*";

export const MOCK_PERMISSIONS_BY_ROLE = {
  ADMIN: ["*"],
  EDITOR: [
    PERMISSIONS.viewDashboard,
    PERMISSIONS.manageContent,
  ],
} as const satisfies Record<
  AdminUser["role"],
  readonly GrantedPermission[]
>;

export function hasPermission(
  granted: readonly string[],
  keys: PermissionKey | readonly PermissionKey[],
  mode: PermissionMode = "all",
) {
  if (granted.includes("*")) {
    return true;
  }

  const requiredKeys = typeof keys === "string" ? [keys] : keys;
  const checks = requiredKeys.map((key) => granted.includes(PERMISSIONS[key]));

  return mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}
