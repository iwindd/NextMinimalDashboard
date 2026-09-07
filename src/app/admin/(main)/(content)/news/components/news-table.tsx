'use client'

import { CategoryFilter } from '@/admin/components/category-filter'
import {
  FilterResult,
  type FilterResultRemoveEvent
} from '@/admin/components/filter-result'
import TableActionMenu from '@/admin/components/table-action-menu'
import TableSearchInput from '@/admin/components/table-search-input'
import { ContentStatusBadge } from '@/admin/components/content-status-badge'
import { useGetNewsQuery } from '@/admin/features/news/news-api'
import { getPath } from '@/admin/routes'
import useCategoryFilter from '@/hooks/use-category-filter'
import useDatatable from '@/hooks/use-datatable'
import { parseListNewsQuery } from '@/servers/news/queries/get-news-list-schema'
import type { NewsListItem, NewsListQuery } from '@/servers/news/types'
import { formatDateTime } from '@/utils/format'
import {
  Badge,
  Box,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Tabs
} from '@mantine/core'
import { IconEye, IconPhoto } from '@tabler/icons-react'
import { DataTable } from 'mantine-datatable'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  getNewsDisplayStatus,
  getActiveNewsTab,
  getNewsTabQueryValue,
  getNewsStatusBadgeColor,
  NEWS_STATUS_TABS
} from './news-table.helpers'
import classes from './news-table.style.module.css'

const SORTABLE_FIELDS = [
  'status',
  'updatedAt',
  'viewCount',
  'createdAt'
] as const

const NEWS_RECORDS_PER_PAGE_OPTIONS = [10, 25, 50]

function NewsCover({ record }: { record: NewsListItem }) {
  if (record.coverUrl) {
    return (
      <Image
        src={record.coverUrl}
        alt=''
        w={64}
        h={64}
        fit='cover'
        radius='sm'
        className={classes.cover}
      />
    )
  }

  return (
    <Box className={classes.coverPlaceholder} aria-hidden='true'>
      <IconPhoto size={22} stroke={1.5} />
    </Box>
  )
}

function NewsTitleCell({ record }: { record: NewsListItem }) {
  return (
    <Group gap='sm' align='flex-start' wrap='nowrap'>
      <NewsCover record={record} />
      <Stack gap={2} pt={2} style={{ minWidth: 0, flex: 1 }}>
        <Text
          component={Link}
          href={getPath('content.news.detail', { newsId: record.id })}
          className={classes.titleLink}
          fw={600}
          lineClamp={2}
        >
          {record.title}
        </Text>
        <Text size='sm' c='dimmed' lineClamp={2}>
          {record.excerpt?.trim() || 'ไม่มีคำโปรย'}
        </Text>
      </Stack>
    </Group>
  )
}

function NewsStatusBadge({ record }: { record: NewsListItem }) {
  const status = getNewsDisplayStatus(record)
  return <ContentStatusBadge status={status} />
}

export function NewsTable() {
  const columns = useMemo(
    () => [
      {
        accessor: 'title',
        title: 'ข่าว',
        width: '50%',
        render: (record: NewsListItem) => <NewsTitleCell record={record} />
      },
      {
        accessor: 'category.name',
        title: 'หมวดหมู่',
        render: (record: NewsListItem) =>
          record.category ? (
            <Badge variant='default'>{record.category.name}</Badge>
          ) : (
            '-'
          )
      },
      {
        accessor: 'status',
        title: 'สถานะ',
        sortable: true,
        render: (record: NewsListItem) => <NewsStatusBadge record={record} />
      },
      {
        accessor: 'viewCount',
        title: 'ยอดอ่าน',
        sortable: true,
        render: (record: NewsListItem) =>
          record.viewCount.toLocaleString('th-TH')
      },
      {
        accessor: 'updatedAt',
        title: 'แก้ไขล่าสุด',
        sortable: true,
        render: (record: NewsListItem) => (
          <Text size='sm'>{formatDateTime(record.updatedAt)}</Text>
        )
      },
      {
        accessor: 'actions',
        title: '',
        width: '60px',
        textAlign: 'right' as const,
        render: (record: NewsListItem) => (
          <Group gap='xs' justify='flex-end' wrap='nowrap'>
            <Box visibleFrom='sm'>
              <TableActionMenu
                displayType='button'
                actions={[
                  {
                    label: 'เปิด',
                    action: getPath('content.news.detail', {
                      newsId: record.id
                    }),
                    icon: IconEye
                  }
                ]}
              />
            </Box>
            <Box hiddenFrom='sm'>
              <TableActionMenu
                label={`เปิดข้อมูล ${record.title}`}
                displayType='menu'
                actions={[
                  {
                    label: 'เปิด',
                    action: getPath('content.news.detail', {
                      newsId: record.id
                    }),
                    icon: IconEye
                  }
                ]}
              />
            </Box>
          </Group>
        )
      }
    ],
    []
  )

  const datatable = useDatatable<NewsListItem, NewsListQuery>({
    parseQueryAction: parseListNewsQuery,
    columns,
    sortableFields: SORTABLE_FIELDS,
    recordsPerPageOptions: NEWS_RECORDS_PER_PAGE_OPTIONS
  })
  const { query, setSearchValue, updateQuery } = datatable
  const { data, isFetching, isError } = useGetNewsQuery(query)
  const activeTab = getActiveNewsTab(query.status)
  const categoryFilter = useCategoryFilter({
    endpoint: '/api/admin/news/categories',
    selectedIds: query.categoryIds
  })

  const setCategoryIds = (categoryIds: string[]) => {
    updateQuery({
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      page: 1
    })
  }

  const filterGroups = [
    {
      id: 'search',
      label: 'ค้นหา',
      filters: query.search
        ? [
            {
              id: 'query',
              label: query.search,
              removeLabel: 'ลบคำค้นหา'
            }
          ]
        : []
    },
    {
      id: 'category',
      label: 'หมวดหมู่',
      filters: categoryFilter.selectedOptions.map(option => ({
        id: option.id,
        label: option.name,
        removeLabel: `ลบหมวดหมู่ ${option.name}`
      }))
    }
  ]

  const removeFilter = ({ groupId, filterId }: FilterResultRemoveEvent) => {
    if (groupId === 'search') {
      setSearchValue.cancel()
      updateQuery({ search: undefined, page: 1 })
    } else if (groupId === 'category') {
      setCategoryIds(query.categoryIds.filter(id => id !== filterId))
    }
  }

  const clearFilters = () => {
    setSearchValue.cancel()
    updateQuery({ search: undefined, categoryIds: undefined, page: 1 })
  }

  const handleTabChange = (value: string | null) => {
    if (!value) return
    const nextTab = NEWS_STATUS_TABS.find(tab => tab.value === value)
    if (!nextTab) return
    updateQuery({
      status: getNewsTabQueryValue(nextTab.value),
      page: 1
    })
  }

  return (
    <Stack gap='lg'>
      <Tabs value={activeTab} onChange={handleTabChange} variant='default'>
        <Tabs.List className={classes.tabsList}>
          {NEWS_STATUS_TABS.map(tab => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              rightSection={
                <Badge
                  color={getNewsStatusBadgeColor(tab.value)}
                  size='sm'
                  variant={activeTab === tab.value ? 'filled' : 'light'}
                >
                  {data?.counts?.[tab.value] ?? '—'}
                </Badge>
              }
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Group justify='space-between' align='flex-end' wrap='wrap'>
        <TableSearchInput
          className={classes.search}
          placeholder='ค้นหาหัวข้อหรือคำโปรยข่าว'
          key={query.search ?? ''}
          defaultValue={query.search ?? ''}
          onSearch={setSearchValue}
        />
        <Group gap='sm' wrap='wrap'>
          <CategoryFilter
            filter={categoryFilter}
            onChangeAction={setCategoryIds}
            searchPlaceholder='ค้นหาหมวดหมู่ข่าว'
          />
        </Group>
      </Group>

      <FilterResult
        filters={filterGroups}
        onRemoveAction={removeFilter}
        onClearAllAction={clearFilters}
      />

      {isError ? <Text c='red'>ไม่สามารถโหลดรายการข่าวได้</Text> : null}
      <Paper p={0}>
        <DataTable<NewsListItem>
          {...datatable.props}
          fetching={isFetching}
          records={data?.data ?? []}
          columns={columns}
          totalRecords={data?.total ?? 0}
          minHeight={200}
        />
      </Paper>
    </Stack>
  )
}
