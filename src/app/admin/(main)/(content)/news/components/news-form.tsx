'use client'

import { getSourceTitleAction } from '@/servers/news/actions/get-source-title-action'
import type { NewsDraftInput, NewsRevisionItem } from '@/servers/news/types'
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Grid,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { FormEventHandler } from 'react'
import { NewsCategoryCombobox } from './news-category-combobox'
import { NewsCoverUpload } from './news-cover-upload'
import classes from './news-form.module.css'
import {
  NewsRichTextEditor,
  type PendingNewsBodyFile
} from './news-rich-text-editor'

export type { PendingNewsBodyFile } from './news-rich-text-editor'

export type NewsFormValues = NewsDraftInput & { newsId?: string }

type NewsReviewField = 'title' | 'coverFileId' | 'bodyHtml'
export type NewsReviewFieldErrors = Partial<Record<NewsReviewField, string>>

export type NewsFormProps = {
  form: UseFormReturnType<NewsFormValues>
  initialRevision?: NewsRevisionItem | null
  coverUrl?: string | null
  onCoverChangeAction?: (fileId: string | null, url: string | null) => void
  onCoverPendingFileAction?: (
    file: File | null,
    previewUrl: string | null
  ) => void
  onPendingBodyFilesChangeAction?: (files: PendingNewsBodyFile[]) => void
  pendingMediaResetKey?: number
  onSaveAction: FormEventHandler<HTMLFormElement>
  serverFieldErrors?: NewsReviewFieldErrors
  saveError?: string | null
  disabled?: boolean
  readOnly?: boolean
  pending?: boolean
}

export function NewsForm({
  form,
  initialRevision,
  coverUrl,
  onCoverChangeAction,
  onCoverPendingFileAction,
  onPendingBodyFilesChangeAction,
  pendingMediaResetKey = 0,
  onSaveAction,
  serverFieldErrors,
  saveError,
  disabled = false,
  readOnly = false,
  pending = false
}: NewsFormProps) {
  const sources = form.getValues().source
  const updateSources = (next: NewsFormValues['source']) =>
    form.setFieldValue('source', next)

  const autofillSourceTitle = async (index: number) => {
    if (disabled || readOnly || pending) return
    const source = form.getValues().source[index]
    if (!source?.url) return
    const urlField = `source.${index}.url`
    form.clearFieldError(urlField)
    try {
      const result = await getSourceTitleAction({ url: source.url })
      if (result.serverError || !result.data?.title) {
        form.setFieldError(
          urlField,
          result.serverError?.message ??
            'ไม่สามารถใช้ URL นี้เป็นแหล่งข้อมูลได้'
        )
        return
      }
      form.clearFieldError(urlField)
      const current = form.getValues().source
      updateSources(
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, title: result.data.title } : item
        )
      )
    } catch {
      form.setFieldError(urlField, 'ไม่สามารถตรวจสอบ URL นี้ได้')
    }
  }
  const fieldError = (field: keyof NewsFormValues) => {
    const error = form.errors[field]
    if (typeof error === 'string') return error
    if (field === 'title' || field === 'coverFileId' || field === 'bodyHtml') {
      return serverFieldErrors?.[field]
    }
    return undefined
  }

  return (
    <form id='news-form' onSubmit={onSaveAction}>
      <Stack gap='lg'>
        <Card padding='lg'>
          <Card.Section inheritPadding pt='md' mb='lg'>
            <Title order={6}>จัดการข่าว</Title>
          </Card.Section>
          <Card.Section inheritPadding>
            <Stack gap='md' mb='md'>
              <NewsCoverUpload
                fileId={form.getValues().coverFileId ?? null}
                url={
                  coverUrl !== undefined
                    ? coverUrl
                    : (initialRevision?.coverUrl ?? null)
                }
                onChangeAction={(fileId, url) => {
                  form.setFieldValue('coverFileId', fileId)
                  onCoverChangeAction?.(fileId, url)
                }}
                onPendingFileAction={onCoverPendingFileAction}
                error={fieldError('coverFileId')}
                disabled={disabled || pending}
                readOnly={readOnly}
                withAsterisk
              />
              <TextInput
                key={form.key('title')}
                label='หัวข้อข่าว'
                disabled={disabled || pending}
                readOnly={readOnly}
                withAsterisk
                {...form.getInputProps('title')}
                error={fieldError('title')}
              />
              <Textarea
                key={form.key('excerpt')}
                label='คำโปรยข่าว'
                description='ข้อความสั้นที่ใช้แสดงบนรายการข่าว'
                minRows={3}
                autosize
                disabled={disabled || pending}
                readOnly={readOnly}
                {...form.getInputProps('excerpt')}
                error={fieldError('excerpt')}
              />
              <NewsRichTextEditor
                key={form.key('bodyHtml')}
                value={form.getValues().bodyHtml}
                onChangeAction={value => form.setFieldValue('bodyHtml', value)}
                onPendingFilesChangeAction={onPendingBodyFilesChangeAction}
                pendingFilesResetKey={pendingMediaResetKey}
                error={fieldError('bodyHtml')}
                disabled={disabled || pending}
                readOnly={readOnly}
                withAsterisk
              />
            </Stack>
          </Card.Section>
        </Card>
        <Card>
          <Card.Section inheritPadding pt='md' mb='lg'>
            <Title order={6}>ข้อมูลเพิ่มเติม</Title>
          </Card.Section>
          <Grid>
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <NewsCategoryCombobox
                value={form.getValues().categoryId || null}
                initialCategory={initialRevision?.category}
                onChangeAction={value =>
                  form.setFieldValue('categoryId', value)
                }
                error={fieldError('categoryId')}
                disabled={disabled || pending}
                readOnly={readOnly}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <NumberInput
                key={form.key('readTimeMinutes')}
                label='เวลาอ่าน (นาที)'
                min={1}
                max={240}
                disabled={disabled || pending}
                readOnly={readOnly}
                {...form.getInputProps('readTimeMinutes')}
                error={fieldError('readTimeMinutes')}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Stack gap='sm'>
                <Group justify='space-between' align='center' pt='lg' mb='md'>
                  <Text fw={500}>แหล่งข้อมูล</Text>
                  {!readOnly ? (
                    <Button
                      size='xs'
                      variant='light'
                      leftSection={<IconPlus size={16} />}
                      disabled={disabled || pending}
                      onClick={() =>
                        updateSources([...sources, { url: '', title: '' }])
                      }
                    >
                      เพิ่มแหล่งข้อมูล
                    </Button>
                  ) : null}
                </Group>
                {!sources.length ? (
                  <Center>
                    <Text c='dimmed' size='sm'>
                      ไม่มีแหล่งข้อมูล
                    </Text>
                  </Center>
                ) : null}
                {sources.map((source, index) => (
                  <Box
                    className={classes.source}
                    key={form.key(`source.${index}`)}
                  >
                    <Grid align='end'>
                      <Grid.Col span={{ base: 12, md: 5 }}>
                        <Stack>
                          <TextInput
                            label={`URL แหล่งข้อมูลที่ ${index + 1}`}
                            required
                            placeholder='https://example.com/article'
                            disabled={disabled || pending}
                            readOnly={readOnly}
                            value={source.url}
                            onChange={event => {
                              form.clearFieldError(`source.${index}.url`)
                              updateSources(
                                sources.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        url: event.currentTarget.value
                                      }
                                    : item
                                )
                              )
                            }}
                            onBlur={() => void autofillSourceTitle(index)}
                            error={form.errors[`source.${index}.url`]}
                          />
                        </Stack>
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Stack justify='start'>
                          <TextInput
                            label='ชื่อแหล่งข้อมูล'
                            required
                            disabled={disabled || pending}
                            readOnly={readOnly}
                            value={source.title}
                            onChange={event =>
                              updateSources(
                                sources.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        title: event.currentTarget.value
                                      }
                                    : item
                                )
                              )
                            }
                            error={form.errors[`source.${index}.title`]}
                          />
                        </Stack>
                      </Grid.Col>
                      {!readOnly ? (
                        <Grid.Col span={{ base: 12, md: 1 }}>
                          <ActionIcon
                            color='red'
                            aria-label={`ลบแหล่งข้อมูลที่ ${index + 1}`}
                            size='lg'
                            variant='filled'
                            disabled={disabled || pending}
                            onClick={() =>
                              updateSources(
                                sources.filter(
                                  (_, itemIndex) => itemIndex !== index
                                )
                              )
                            }
                          >
                            <IconTrash
                              style={{ width: '70%', height: '70%' }}
                            />
                          </ActionIcon>
                        </Grid.Col>
                      ) : null}
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>
        {saveError ? (
          <Text c='red' size='sm'>
            {saveError}
          </Text>
        ) : null}
      </Stack>
    </form>
  )
}
