'use client'

import { Badge, type BadgeProps } from '@mantine/core'
import {
  IconAlertCircle,
  IconArchive,
  IconCheck,
  IconClock,
  IconFileDescription,
  IconHistory,
  IconInfoCircle,
  IconRefresh,
  IconTrash,
  type TablerIcon
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import {
  CONTENT_STATUS_COLORS,
  CONTENT_STATUS_LABELS,
  normalizeContentStatus,
  type ContentStatus
} from './content-status'

const CONTENT_STATUS_ICONS: Record<ContentStatus, TablerIcon> = {
  DRAFT: IconFileDescription,
  IN_REVIEW: IconClock,
  REPUBLISH: IconRefresh,
  CHANGES_REQUESTED: IconAlertCircle,
  PUBLISHED: IconCheck,
  ARCHIVED: IconArchive,
  SUPERSEDED: IconHistory,
  EMPTY: IconInfoCircle,
  DELETED: IconTrash
}

export type ContentStatusBadgeProps = Omit<
  BadgeProps,
  'children' | 'color' | 'leftSection'
> & {
  status: string | null | undefined
  label?: ReactNode
}

export function ContentStatusBadge({
  status,
  label,
  variant = 'light',
  ...props
}: ContentStatusBadgeProps) {
  const normalizedStatus = normalizeContentStatus(status)
  const Icon = CONTENT_STATUS_ICONS[normalizedStatus]

  return (
    <Badge
      {...props}
      color={CONTENT_STATUS_COLORS[normalizedStatus]}
      leftSection={<Icon size={14} stroke={1.8} aria-hidden='true' />}
      variant={variant}
    >
      {label ?? CONTENT_STATUS_LABELS[normalizedStatus]}
    </Badge>
  )
}
