import { describe, expect, it } from 'vitest'
import {
  getContentStatusColor,
  getContentStatusLabel,
  normalizeContentStatus
} from './content-status'

describe('content status', () => {
  it('uses the shared learning palette for every status', () => {
    expect(getContentStatusColor('DRAFT')).toBe('gray')
    expect(getContentStatusColor('IN_REVIEW')).toBe('blue')
    expect(getContentStatusColor('REPUBLISH')).toBe('violet')
    expect(getContentStatusColor('CHANGES_REQUESTED')).toBe('orange')
    expect(getContentStatusColor('PUBLISHED')).toBe('green')
    expect(getContentStatusColor('ARCHIVED')).toBe('dark')
    expect(getContentStatusColor('DELETED')).toBe('red')
  })

  it('normalizes status values and falls back to an empty status', () => {
    expect(normalizeContentStatus(' in_review ')).toBe('IN_REVIEW')
    expect(getContentStatusLabel('unknown')).toBe('ไม่มีฉบับร่าง')
  })
})
