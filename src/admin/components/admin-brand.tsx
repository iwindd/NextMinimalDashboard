'use client'

import { Group, Text } from '@mantine/core'
import { useTranslations } from 'next-intl'

export function AdminBrand({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('Navigation')
  return (
    <Group gap='sm' wrap='nowrap' ps='sm'>
      {!compact && (
        <div>
          <Text
            fw={600}
            size='xl'
            style={{ fontFamily: 'var(--font-prompt), sans-serif' }}
          >
            SimpleDashboard
          </Text>
          <Text size='xs' c='dimmed' lh={1.2}>
            {t('content')}
          </Text>
        </div>
      )}
    </Group>
  )
}
