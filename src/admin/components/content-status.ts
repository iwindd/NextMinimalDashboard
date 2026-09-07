export type ContentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'REPUBLISH'
  | 'CHANGES_REQUESTED'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'SUPERSEDED'
  | 'EMPTY'
  | 'DELETED'

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  IN_REVIEW: 'รอตรวจสอบ',
  REPUBLISH: 'ขอเผยแพร่อีกครั้ง',
  CHANGES_REQUESTED: 'รอแก้ไข',
  PUBLISHED: 'เผยแพร่แล้ว',
  ARCHIVED: 'จัดเก็บแล้ว',
  SUPERSEDED: 'ฉบับเก่า',
  EMPTY: 'ไม่มีฉบับร่าง',
  DELETED: 'ลบแล้ว'
}

export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  DRAFT: 'gray',
  IN_REVIEW: 'blue',
  REPUBLISH: 'violet',
  CHANGES_REQUESTED: 'orange',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
  SUPERSEDED: 'gray',
  EMPTY: 'gray',
  DELETED: 'red'
}

export function normalizeContentStatus(
  status: string | null | undefined
): ContentStatus {
  const normalizedStatus = status?.trim().toUpperCase()

  if (normalizedStatus && normalizedStatus in CONTENT_STATUS_LABELS) {
    return normalizedStatus as ContentStatus
  }

  return 'EMPTY'
}

export function getContentStatusColor(
  status: string | null | undefined
): string {
  return CONTENT_STATUS_COLORS[normalizeContentStatus(status)]
}

export function getContentStatusLabel(
  status: string | null | undefined
): string {
  return CONTENT_STATUS_LABELS[normalizeContentStatus(status)]
}
