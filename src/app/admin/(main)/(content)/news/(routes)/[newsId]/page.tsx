'use client'

import { AppBreadcrumbs } from '@/admin/components/app-breadcrumbs'
import { ContentStatusBadge } from '@/admin/components/content-status-badge'
import { PageHeader } from '@/admin/components/page-header'
import { useAdminCacheInvalidation } from '@/admin/hooks/use-admin-cache-invalidation'
import { useServerActionForm } from '@/admin/hooks/use-server-action-form'
import { getRevisionUiPolicy } from '@/admin/revision-flow/ui-policy'
import { RevisionActionButton } from '@/admin/revision-flow/revision-action-button'
import { approveNewsAction } from '@/servers/news/actions/approve-news-action'
import { archiveNewsAction } from '@/servers/news/actions/archive-news-action'
import { cancelNewsSubmissionAction } from '@/servers/news/actions/cancel-news-submission-action'
import { createNewsSchema } from '@/servers/news/actions/create-news-schema'
import { deleteNewsAction } from '@/servers/news/actions/delete-news-action'
import { republishNewsAction } from '@/servers/news/actions/republish-news-action'
import { requestNewsChangesAction } from '@/servers/news/actions/request-news-changes-action'
import { restoreNewsAction } from '@/servers/news/actions/restore-news-action'
import { submitNewsAction } from '@/servers/news/actions/submit-news-action'
import { updateNewsAction } from '@/servers/news/actions/update-news-action'
import { newsReviewSchema } from '@/servers/news/helpers'
import { formatDateTime } from '@/utils/format'
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Container,
  DataList,
  Grid,
  Menu,
  Space,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconDotsVertical, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import {
  NewsForm,
  type NewsFormValues,
  type NewsReviewFieldErrors,
  type PendingNewsBodyFile
} from '../../components/news-form'
import { useNews } from './components/news-context'
import classes from './news-detail.module.css'

type PendingNewsCoverFile = {
  file: File
  previewUrl: string
}

type MultipartSaveResult = {
  data?: { id: string; revisionId: string }
  validationErrors?: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  }
  serverError?: {
    message: string
    fieldErrors?: Record<string, string>
  }
}

async function saveNewsWithPendingFiles(
  input: NewsFormValues,
  pendingCoverFile: PendingNewsCoverFile | null,
  pendingBodyFiles: PendingNewsBodyFile[]
): Promise<MultipartSaveResult> {
  const formData = new FormData()
  let bodyHtml = input.bodyHtml

  for (const pendingFile of pendingBodyFiles) {
    if (!bodyHtml.includes(pendingFile.previewUrl)) continue
    bodyHtml = bodyHtml.replaceAll(
      pendingFile.previewUrl,
      `__NEWS_UPLOAD_${pendingFile.key}__`
    )
    formData.append(
      `bodyFile:${pendingFile.key}`,
      pendingFile.file,
      pendingFile.file.name
    )
  }

  if (pendingCoverFile) {
    formData.append(
      'coverFile',
      pendingCoverFile.file,
      pendingCoverFile.file.name
    )
  }
  formData.append('payload', JSON.stringify({ ...input, bodyHtml }))

  try {
    const response = await fetch(`/api/admin/news/${input.newsId}/save`, {
      method: 'POST',
      body: formData
    })
    const result = (await response.json()) as MultipartSaveResult
    if (!response.ok && !result.serverError && !result.validationErrors) {
      return { serverError: { message: 'ไม่สามารถบันทึกข้อมูลได้' } }
    }
    return result
  } catch {
    return { serverError: { message: 'ไม่สามารถบันทึกข้อมูลได้' } }
  }
}

function RejectNewsModalContent({
  onSubmitAction
}: {
  onSubmitAction: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Stack>
      <Text size='sm'>
        ระบุสิ่งที่ต้องแก้ไข เพื่อให้ผู้เขียนแก้ไขข่าวก่อนส่งตรวจสอบอีกครั้ง
      </Text>
      <Textarea
        label='สิ่งที่ต้องแก้ไข'
        required
        minRows={4}
        maxLength={500}
        value={reason}
        onChange={event => setReason(event.currentTarget.value)}
      />
      <Button
        color='orange'
        onClick={() => onSubmitAction(reason)}
        disabled={!reason.trim()}
      >
        ยืนยันการส่งกลับให้แก้ไข
      </Button>
    </Stack>
  )
}

export default function NewsDetailPage() {
  const { invalidateAdminCaches } = useAdminCacheInvalidation()
  const router = useRouter()
  const { news, actorId, role } = useNews()
  const currentRevision = news.workingRevision ?? news.publishedRevision
  const revision = currentRevision
  const status = revision?.status
  const displayStatus = news.deletedAt
    ? 'DELETED'
    : status === 'CHANGES_REQUESTED'
      ? status
      : news.archivedAt
      ? status === 'IN_REVIEW'
        ? 'REPUBLISH'
        : 'ARCHIVED'
      : status ?? 'EMPTY'
  const disabled = Boolean(news.deletedAt)
  const uiPolicy = getRevisionUiPolicy({
    role,
    status,
    isOwner: news.author?.id === actorId,
    isDeleted: Boolean(news.deletedAt),
    isArchived: Boolean(news.archivedAt),
    hasPublishedRevision: Boolean(news.publishedRevision),
    hasWorkingRevision: Boolean(news.workingRevision)
  })
  const autoPublishActive = uiPolicy.autoPublishActive
  const readOnly = uiPolicy.readOnly
  const locked = disabled || readOnly
  const title = revision?.title ?? 'ข่าวสาร'
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] =
    useState<NewsReviewFieldErrors>({})
  const [coverOverrides, setCoverOverrides] = useState<
    Record<string, string | null>
  >({})
  const [pendingCoverFile, setPendingCoverFile] =
    useState<PendingNewsCoverFile | null>(null)
  const [pendingBodyFiles, setPendingBodyFiles] = useState<
    PendingNewsBodyFile[]
  >([])
  const [pendingMediaResetKey, setPendingMediaResetKey] = useState(0)
  const pendingCoverFileRef = useRef<PendingNewsCoverFile | null>(null)
  const saveContinuationRef = useRef<((newsId: string) => void) | null>(null)
  const archiveNoteRef = useRef('')

  useEffect(() => {
    pendingCoverFileRef.current = pendingCoverFile
  }, [pendingCoverFile])

  const hasPendingMedia =
    Boolean(pendingCoverFile) || pendingBodyFiles.length > 0

  const handlePendingCoverFile = useCallback(
    (file: File | null, previewUrl: string | null) => {
      setPendingCoverFile(current => {
        if (current && current.previewUrl !== previewUrl) {
          URL.revokeObjectURL(current.previewUrl)
        }
        return file && previewUrl ? { file, previewUrl } : null
      })
    },
    []
  )

  const clearPendingMedia = useCallback(() => {
    const current = pendingCoverFileRef.current
    if (current) URL.revokeObjectURL(current.previewUrl)
    pendingCoverFileRef.current = null
    setPendingCoverFile(null)
    setPendingBodyFiles([])
    setPendingMediaResetKey(currentKey => currentKey + 1)
  }, [])

  useEffect(
    () => () => {
      const current = pendingCoverFileRef.current
      if (current) URL.revokeObjectURL(current.previewUrl)
    },
    []
  )
  const initialValues = useMemo<NewsFormValues>(
    () => ({
      newsId: news.id,
      title: revision?.title ?? '',
      excerpt: revision?.excerpt ?? '',
      bodyHtml: revision?.bodyHtml ?? '',
      categoryId: revision?.category?.id ?? null,
      coverFileId: revision?.coverFileId ?? null,
      readTimeMinutes: revision?.readTimeMinutes ?? null,
      source: revision?.source ?? []
    }),
    [news.id, revision]
  )
  const handleValuesChange = useCallback(() => {
    setSubmitError(current => (current === null ? current : null))
    setServerFieldErrors(current =>
      Object.keys(current).length === 0 ? current : {}
    )
  }, [])
  const form = useForm<NewsFormValues>({
    mode: 'controlled',
    initialValues,
    validate: schemaResolver(createNewsSchema, { sync: true }),
    onValuesChange: handleValuesChange
  })
  const hasUnsavedNewsChanges = form.isDirty() || hasPendingMedia
  const { resetDirty, setInitialValues, setValues } = form

  useEffect(() => {
    setInitialValues(initialValues)
    setValues(initialValues)
    resetDirty()
  }, [initialValues, resetDirty, setInitialValues, setValues])

  const {
    error: saveError,
    pending: savePending,
    submit: submitSave,
    clearError: clearSaveError
  } = useServerActionForm<NewsFormValues, { id: string }>({
    form,
    action: input =>
      hasPendingMedia
        ? saveNewsWithPendingFiles(
            { ...input, newsId: news.id },
            pendingCoverFile,
            pendingBodyFiles
          )
        : updateNewsAction({
            ...input,
            newsId: news.id
          }),
    onSuccessAction: data => {
      const continuation = saveContinuationRef.current
      saveContinuationRef.current = null
      clearPendingMedia()
      setCoverOverrides({})
      form.resetDirty()
      invalidateAdminCaches({ resources: ['news'], notifications: true })
      if (continuation) continuation(data.id)
      else router.refresh()
    },
    onErrorAction: () => {
      saveContinuationRef.current = null
    },
    successNotification: {
      title: 'บันทึกข่าวสำเร็จ',
      message: 'ข้อมูลข่าวถูกบันทึกแล้ว'
    }
  })

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = form.validate()
    if (validation.hasErrors) {
      saveContinuationRef.current = null
      return
    }
    if (locked || savePending || !hasUnsavedNewsChanges) return
    clearSaveError()
    submitSave(form.getValues())
  }

  const runAction = (
    action: () => Promise<{
      data?: unknown
      serverError?: { message: string; fieldErrors?: Record<string, string> }
    }>,
    options?: { inlineError?: boolean; onSuccessAction?: () => void }
  ) => {
    startTransition(async () => {
      const result = await action()
      if (result.serverError) {
        if (options?.inlineError) {
          setSubmitError(result.serverError.message)
          setServerFieldErrors(result.serverError.fieldErrors ?? {})
          return
        }
        notifications.show({
          title: 'ดำเนินการไม่สำเร็จ',
          message: result.serverError.message,
          color: 'red'
        })
        return
      }
      invalidateAdminCaches({ resources: ['news'], notifications: true })
      notifications.show({
        title: 'ดำเนินการสำเร็จ',
        message: 'สถานะข่าวถูกอัปเดตแล้ว',
        color: 'green'
      })
      if (options?.onSuccessAction) options.onSuccessAction()
      else router.refresh()
    })
  }

  const submitReviewNow = (newsId: string) =>
    runAction(() => submitNewsAction({ newsId }), { inlineError: true })

  const publishDraftNow = (newsId: string) =>
    runAction(() => approveNewsAction({ newsId }), { inlineError: true })

  const republishArchivedNow = (newsId: string) =>
    runAction(() => republishNewsAction({ newsId }), { inlineError: true })

  const validateReviewFields = () => {
    setSubmitError(null)
    setServerFieldErrors({})
    for (const field of ['title', 'coverFileId', 'bodyHtml'] as const) {
      form.clearFieldError(field)
    }
    const validation = newsReviewSchema.safeParse({
      title: form.getValues().title,
      coverFileId: form.getValues().coverFileId,
      bodyHtml: form.getValues().bodyHtml
    })
    if (!validation.success) {
      const issues = validation.error.issues.filter(
        issue => !(issue.path[0] === 'coverFileId' && pendingCoverFile)
      )
      for (const issue of issues) {
        const field = issue.path[0]
        if (
          field === 'title' ||
          field === 'coverFileId' ||
          field === 'bodyHtml'
        ) {
          form.setFieldError(field, issue.message)
        }
      }
      if (issues.length > 0) {
        setSubmitError('โปรดตรวจสอบข้อมูลข่าวให้ถูกต้องก่อนเผยแพร่อีกครั้ง')
        return false
      }
    }

    return true
  }

  const runAfterSavingDraft = (
    continuation: (newsId: string) => void,
    options: {
      title: string
      message: string
      confirmLabel: string
    }
  ) => {
    if (!validateReviewFields()) return

    if (hasUnsavedNewsChanges) {
      let modalId = ''
      modalId = modals.openConfirmModal({
        title: options.title,
        children: <Text size='sm'>{options.message}</Text>,
        labels: { confirm: options.confirmLabel, cancel: 'ยกเลิก' },
        closeOnConfirm: false,
        onCancel: () => modals.close(modalId),
        onConfirm: () => {
          modals.close(modalId)
          saveContinuationRef.current = continuation
          ;(
            document.getElementById('news-form') as HTMLFormElement | null
          )?.requestSubmit()
        }
      })
      return
    }

    continuation(news.id)
  }

  const submitReview = () =>
    runAfterSavingDraft(submitReviewNow, {
      title:
        status === 'CHANGES_REQUESTED'
          ? 'ยืนยันการส่งตรวจสอบอีกครั้ง'
          : 'ยืนยันการส่งตรวจสอบ',
      message:
        status === 'CHANGES_REQUESTED'
          ? 'มีข้อมูลที่ยังไม่ได้บันทึก ต้องการบันทึกและส่งตรวจสอบอีกครั้งเลยหรือไม่'
          : 'มีข้อมูลที่ยังไม่ได้บันทึก ต้องการบันทึกและส่งตรวจสอบเลยหรือไม่',
      confirmLabel:
        status === 'CHANGES_REQUESTED'
          ? 'บันทึกและส่งตรวจสอบอีกครั้ง'
          : 'บันทึกและส่งตรวจสอบ'
    })

  const requestRepublish = () =>
    runAfterSavingDraft(submitReviewNow, {
      title: 'ยืนยันการส่งคำขอเผยแพร่อีกครั้ง',
      message:
        'ข่าวที่จัดเก็บจะยังไม่แสดงบนเว็บไซต์จนกว่าแอดมินจะตรวจสอบและเผยแพร่อีกครั้ง ต้องการบันทึกและส่งคำขอหรือไม่',
      confirmLabel: 'บันทึกและส่งคำขอเผยแพร่อีกครั้ง'
    })

  const publishDraft = () =>
    runAfterSavingDraft(publishDraftNow, {
      title: 'ยืนยันการเผยแพร่ข่าว',
      message:
        'มีข้อมูลที่ยังไม่ได้บันทึก ต้องการบันทึกและเผยแพร่ข่าวเลยหรือไม่',
      confirmLabel: 'บันทึกและเผยแพร่'
    })

  const requestChangesNow = (newsId: string, reason: string) =>
    runAction(() =>
      requestNewsChangesAction({
        newsId,
        reason
      })
    )

  const cancelSubmission = () =>
    runAction(() => cancelNewsSubmissionAction({ newsId: news.id }))

  const deleteDraft = () => {
    let modalId = ''
    modalId = modals.openConfirmModal({
      title: 'ยืนยันการลบฉบับร่าง',
      children: (
        <Text size='sm'>
          ฉบับร่างนี้จะไม่สามารถกู้คืนได้ ต้องการลบฉบับร่างนี้หรือไม่
        </Text>
      ),
      labels: { confirm: 'ลบข่าว', cancel: 'ยกเลิก' },
      confirmProps: { color: 'red' },
      closeOnConfirm: false,
      onCancel: () => modals.close(modalId),
      onConfirm: () => {
        modals.close(modalId)
        runAction(() => deleteNewsAction({ newsId: news.id }), {
          onSuccessAction: () => router.push('/admin/news')
        })
      }
    })
  }

  const approve = () => publishDraft()

  const republishArchived = () => {
    if (hasUnsavedNewsChanges) {
      publishDraft()
      return
    }

    let modalId = ''
    modalId = modals.openConfirmModal({
      title: 'ยืนยันการเผยแพร่อีกครั้ง',
      children: (
        <Text size='sm'>
          ข่าวจะถูกนำออกจากสถานะจัดเก็บและกลับมาแสดงบนเว็บไซต์ทันที
        </Text>
      ),
      labels: { confirm: 'เผยแพร่อีกครั้ง', cancel: 'ยกเลิก' },
      confirmProps: { color: 'green' },
      closeOnConfirm: false,
      onCancel: () => modals.close(modalId),
      onConfirm: () => {
        modals.close(modalId)
        republishArchivedNow(news.id)
      }
    })
  }

  const archiveNews = () => {
    archiveNoteRef.current = ''
    let modalId = ''
    modalId = modals.openConfirmModal({
      title: 'ยืนยันการจัดเก็บข่าว',
      children: (
        <Stack gap='sm'>
          <Text size='sm'>
            ข่าวจะไม่แสดงบนเว็บไซต์อีกต่อไป
            แอดมินสามารถเผยแพร่อีกครั้งได้ภายหลัง
          </Text>
          <Textarea
            label='หมายเหตุ'
            description='บันทึกเหตุผลหรือรายละเอียดการจัดเก็บ (ถ้ามี)'
            placeholder='เช่น ข่าวหมดช่วงเผยแพร่แล้ว'
            maxLength={500}
            minRows={3}
            defaultValue=''
            onChange={event => {
              archiveNoteRef.current = event.currentTarget.value
            }}
          />
        </Stack>
      ),
      labels: { confirm: 'จัดเก็บข่าว', cancel: 'ยกเลิก' },
      confirmProps: { color: 'orange' },
      closeOnConfirm: false,
      onCancel: () => {
        archiveNoteRef.current = ''
        modals.close(modalId)
      },
      onConfirm: () => {
        const note = archiveNoteRef.current.trim() || undefined
        archiveNoteRef.current = ''
        modals.close(modalId)
        runAction(() =>
          archiveNewsAction({
            newsId: news.id,
            note
          })
        )
      }
    })
  }

  const restoreNews = () => {
    let modalId = ''
    modalId = modals.openConfirmModal({
      title: 'ยืนยันการกู้คืนข่าว',
      children: (
        <Text size='sm'>
          ข่าวจะกลับไปอยู่ในรายการข่าวปกติ
          หากเคยเผยแพร่แล้วจะกลับมาแสดงบนเว็บไซต์อีกครั้ง
        </Text>
      ),
      labels: { confirm: 'กู้คืนข่าว', cancel: 'ยกเลิก' },
      confirmProps: { color: 'green' },
      closeOnConfirm: false,
      onCancel: () => modals.close(modalId),
      onConfirm: () => {
        modals.close(modalId)
        runAction(() => restoreNewsAction({ newsId: news.id }))
      }
    })
  }

  const requestChanges = () => {
    let modalId = ''
    modalId = modals.open({
      title: 'ส่งกลับให้แก้ไขข่าว',
      centered: true,
      children: (
        <RejectNewsModalContent
          onSubmitAction={submittedReason => {
            const trimmedReason = submittedReason.trim()
            if (!trimmedReason) return
            modals.close(modalId)
            if (hasUnsavedNewsChanges) {
              runAfterSavingDraft(
                newsId => requestChangesNow(newsId, trimmedReason),
                {
                  title: 'ยืนยันการบันทึกและส่งกลับให้แก้ไข',
                  message:
                    'มีข้อมูลที่ยังไม่ได้บันทึก ระบบจะบันทึกข่าวก่อนส่งกลับให้ผู้เขียนแก้ไข ต้องการดำเนินการต่อหรือไม่',
                  confirmLabel: 'บันทึกและส่งกลับให้แก้ไข'
                }
              )
            } else {
              requestChangesNow(news.id, trimmedReason)
            }
          }}
        />
      )
    })
  }

  const isEditorDraft = uiPolicy.canSubmitDraft
  const isEditorChangesRequested = uiPolicy.canResubmit
  const isAdminDraft = uiPolicy.canPublishDraft
  const isAdminArchivedRepublish = uiPolicy.canRepublish
  const canEditNews = uiPolicy.canEdit
  const isEditorReview = uiPolicy.canCancelSubmission
  const isAdminReview = uiPolicy.canReview
  const isEditorRepublishRequest = uiPolicy.canRequestRepublish
  const canArchiveNews = uiPolicy.canArchive

  const canDeleteDraft =
    !news.deletedAt &&
    news.author?.id === actorId &&
    !news.publishedRevision &&
    news.workingRevision?.status === 'DRAFT'

  const coverKey = revision?.id ?? 'empty'
  const coverUrl = Object.prototype.hasOwnProperty.call(
    coverOverrides,
    coverKey
  )
    ? coverOverrides[coverKey]
    : (revision?.coverUrl ?? null)

  return (
    <Container w='100%' size='xl'>
      <PageHeader
        title={title}
        breadcrumbs={<AppBreadcrumbs currentLabel={title} />}
        backTo='/admin/news'
        rightSection={
          canDeleteDraft ? (
            <Menu shadow='md' position='bottom-end'>
              <Menu.Target>
                <ActionIcon
                  variant='default-subtle'
                  aria-label='เมนูข่าว'
                  size='lg'
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color='red'
                  leftSection={<IconTrash size={16} />}
                  onClick={deleteDraft}
                >
                  ลบข่าว
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null
        }
      />
      {news.archivedAt && !news.deletedAt ? (
        <Alert color='orange' title='ข่าวถูกจัดเก็บอยู่' mb='lg'>
          ข่าวนี้จะไม่แสดงบนเว็บไซต์ในขณะที่จัดเก็บอยู่
          {role === 'ADMIN' && status === 'IN_REVIEW'
            ? ' เมื่ออนุมัติ ข่าวจะถูกเผยแพร่อีกครั้งและนำออกจากสถานะจัดเก็บ'
            : role === 'EDITOR'
              ? ' แก้ไขข้อมูลให้เรียบร้อย แล้วกด “ส่งคำขอเผยแพร่อีกครั้ง” เพื่อให้แอดมินตรวจสอบและเผยแพร่อีกครั้ง'
              : ' แอดมินสามารถเผยแพร่ข่าวนี้อีกครั้งได้เมื่อพร้อม'}
          {news.archiveNote ? (
            <Text size='sm' mt='xs'>
              <Text span fw={600}>
                หมายเหตุ:
              </Text>
              {news.archiveNote}
            </Text>
          ) : null}
        </Alert>
      ) : null}
      <Grid>
        <Grid.Col span={{ base: 12, xl: 9 }}>
          <Stack gap='lg'>
            <NewsForm
              form={form}
              initialRevision={revision}
              coverUrl={coverUrl}
              onCoverChangeAction={(_, url) =>
                setCoverOverrides(current => ({
                  ...current,
                  [coverKey]: url
                }))
              }
              onCoverPendingFileAction={handlePendingCoverFile}
              onPendingBodyFilesChangeAction={setPendingBodyFiles}
              pendingMediaResetKey={pendingMediaResetKey}
              onSaveAction={save}
              disabled={disabled}
              readOnly={readOnly}
              serverFieldErrors={serverFieldErrors}
              saveError={saveError}
              pending={savePending || pending}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 3 }}>
          <Stack gap='xs'>
            <Card padding={'lg'}>
              <Card.Section inheritPadding pt='md' pb='lg'>
                <Title order={6}>การเผยแพร่</Title>
              </Card.Section>
              <Card.Section inheritPadding pb='md'>
                <Stack gap='sm'>
                  <DataList
                    classNames={{
                      item: classes.publicationItem,
                      itemLabel: classes.publicationItemLabel,
                      itemValue: classes.publicationItemValue
                    }}
                  >
                    <DataList.Item>
                      <DataList.ItemLabel>สถานะ</DataList.ItemLabel>
                      <DataList.ItemValue>
                        <ContentStatusBadge
                          status={displayStatus}
                          w='fit-content'
                          label={displayStatus === 'EMPTY' ? 'ไม่มีฉบับ' : undefined}
                        />
                      </DataList.ItemValue>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.ItemLabel>เจ้าของข่าว</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {news.author?.name ?? '-'}
                      </DataList.ItemValue>
                    </DataList.Item>
                    {news.viewCount > 0 && (
                      <DataList.Item>
                        <DataList.ItemLabel>จำนวนการดู</DataList.ItemLabel>
                        <DataList.ItemValue>
                          {news.viewCount}
                        </DataList.ItemValue>
                      </DataList.Item>
                    )}
                    {revision?.publishedAt ? (
                      <DataList.Item>
                        <DataList.ItemLabel>วันที่เผยแพร่</DataList.ItemLabel>
                        <DataList.ItemValue>
                          {formatDateTime(revision.publishedAt)}
                        </DataList.ItemValue>
                      </DataList.Item>
                    ) : null}
                  </DataList>
                  <Space></Space>

                  {revision?.reviewReason ? (
                    <Alert color='orange' title='เหตุผลที่ต้องแก้ไข'>
                      {revision.reviewReason}
                    </Alert>
                  ) : null}

                  {submitError ? (
                    <Alert color='red' title='ไม่สามารถทำรายการได้'>
                      {submitError}
                    </Alert>
                  ) : null}

                  {canArchiveNews ? (
                    <RevisionActionButton
                      action='archive'
                      contentNoun='ข่าว'
                      onClick={archiveNews}
                      loading={pending}
                    />
                  ) : null}

                  {canEditNews && hasUnsavedNewsChanges ? (
                    <RevisionActionButton
                      action={autoPublishActive ? 'saveAndPublish' : 'save'}
                      type='submit'
                      form='news-form'
                      loading={savePending}
                      disabled={pending}
                    />
                  ) : null}

                  {isEditorDraft ? (
                    <RevisionActionButton
                      action='submit'
                      onClick={submitReview}
                      loading={pending}
                    />
                  ) : null}

                  {isEditorChangesRequested ? (
                    <RevisionActionButton
                      action='resubmit'
                      onClick={submitReview}
                      loading={pending}
                    />
                  ) : null}

                  {isEditorRepublishRequest ? (
                    <RevisionActionButton
                      action='requestRepublish'
                      onClick={requestRepublish}
                      loading={pending}
                    />
                  ) : null}

                  {isAdminDraft ? (
                    <RevisionActionButton
                      action={news.archivedAt ? 'republish' : 'publish'}
                      contentNoun='ข่าว'
                      onClick={publishDraft}
                      loading={pending}
                    />
                  ) : null}

                  {isAdminArchivedRepublish ? (
                    <RevisionActionButton
                      action='republish'
                      onClick={republishArchived}
                      loading={pending}
                    />
                  ) : null}

                  {isEditorReview ? (
                    <RevisionActionButton
                      action={
                        news.archivedAt ? 'cancelRepublish' : 'cancelReview'
                      }
                      onClick={cancelSubmission}
                      loading={pending}
                    />
                  ) : null}

                  {isAdminReview ? (
                    <>
                      <RevisionActionButton
                        action='sendBack'
                        onClick={requestChanges}
                        disabled={pending}
                      />
                      <RevisionActionButton
                        action={
                          news.archivedAt ? 'approveRepublish' : 'approve'
                        }
                        onClick={approve}
                        loading={pending}
                      />
                    </>
                  ) : null}

                  {news.deletedAt && role === 'ADMIN' ? (
                    <Button
                      variant='light'
                      color='green'
                      onClick={restoreNews}
                      loading={pending}
                    >
                      กู้คืนข่าว
                    </Button>
                  ) : null}
                </Stack>
              </Card.Section>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  )
}
