'use client'

import { usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { useGetAdminNotificationCountsQuery } from './features/notifications/notifications-api'
import { MOCK_NOTIFICATION_COUNTS_BY_ROLE } from './notifications'
import {
  hasPermission,
  MOCK_PERMISSIONS_BY_ROLE,
  type PermissionKey,
  type PermissionMode
} from './permissions'
import { findRouteTrail } from './routes'
import type { AppDispatch, RootState } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

const EMPTY_PERMISSIONS: readonly string[] = []
const EMPTY_NOTIFICATIONS = {
  news: 0
} as const
const NOTIFICATION_POLLING_INTERVAL = 60_000

export function usePermissions() {
  const role = useAppSelector(state => state.auth.user?.role)
  const permissions = role ? MOCK_PERMISSIONS_BY_ROLE[role] : EMPTY_PERMISSIONS

  return {
    permissions,
    can: (
      keys: PermissionKey | readonly PermissionKey[],
      mode: PermissionMode = 'all'
    ) => hasPermission(permissions, keys, mode)
  }
}

export function useNotifications() {
  const role = useAppSelector(state => state.auth.user?.role)
  const { data } = useGetAdminNotificationCountsQuery(undefined, {
    skip: !role,
    pollingInterval: NOTIFICATION_POLLING_INTERVAL,
    skipPollingIfUnfocused: true
  })

  const mockCounts = role
    ? MOCK_NOTIFICATION_COUNTS_BY_ROLE[role]
    : EMPTY_NOTIFICATIONS

  return {
    ...mockCounts,
    news: role ? (data?.news ?? 0) : 0
  }
}

export function useActiveRouteTrail() {
  const pathname = usePathname()
  return findRouteTrail(pathname) ?? []
}
