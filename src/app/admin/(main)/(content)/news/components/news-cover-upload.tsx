"use client";

import previewClasses from "@/admin/components/media-preview.module.css";
import {
  ACCEPTED_IMAGE_FILE_ACCEPT,
  getImageFileError,
  MAX_IMAGE_FILE_SIZE_MB,
} from "@/utils/file";
import { Button, FileButton, Group, Image, Input, Stack, Text } from "@mantine/core";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

type NewsCoverUploadProps = {
  fileId: string | null;
  url: string | null;
  onChangeAction: (fileId: string | null, url: string | null) => void;
  onPendingFileAction?: (file: File | null, previewUrl: string | null) => void;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  withAsterisk?: boolean;
};

export function NewsCoverUpload({
  fileId,
  url,
  onChangeAction,
  onPendingFileAction,
  error,
  disabled = false,
  readOnly = false,
  withAsterisk = false,
}: NewsCoverUploadProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  // The file is only staged here; the form submits it as FormData on save.
  const selectImage = (file: File | null) => {
    if (!file || disabled || readOnly) return;
    const fileError = getImageFileError(file);
    if (fileError) {
      setUploadError(fileError);
      return;
    }
    setUploadError(null);
    const previewUrl = URL.createObjectURL(file);
    onPendingFileAction?.(file, previewUrl);
    onChangeAction(null, previewUrl);
  };

  const removeImage = () => {
    setUploadError(null);
    onPendingFileAction?.(null, null);
    onChangeAction(null, null);
  };

  const displayedError = error ?? uploadError;

  return (
    <Input.Wrapper
      label="รูปปกข่าว"
      description={`รองรับ JPG, PNG และ WebP ขนาดไม่เกิน ${MAX_IMAGE_FILE_SIZE_MB} MB`}
      withAsterisk={withAsterisk}
      error={displayedError}
    >
      <Stack gap="xs" mt="xs">
        <div
          className={
            displayedError
              ? `${previewClasses.previewBox} ${previewClasses.previewBoxError}`
              : previewClasses.previewBox
          }
        >
          {url ? (
            <Image src={url} alt="ตัวอย่างรูปปกข่าว" fit="contain" mah={260} />
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              ยังไม่ได้เลือกรูปภาพ จะไม่แสดงรูปปกข่าวบนหน้าเว็บไซต์
            </Text>
          )}
        </div>
        {!readOnly ? (
          <Group gap="sm">
            <FileButton
              onChange={selectImage}
              accept={ACCEPTED_IMAGE_FILE_ACCEPT}
              disabled={disabled}
            >
              {(fileButtonProps) => (
                <Button
                  {...fileButtonProps}
                  variant="default"
                  leftSection={<IconPhotoPlus size={16} />}
                >
                  {url ? "เปลี่ยนรูปภาพ" : "เลือกรูปภาพ"}
                </Button>
              )}
            </FileButton>
            {fileId || url ? (
              <Button
                type="button"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={removeImage}
                disabled={disabled}
              >
                นำรูปออก
              </Button>
            ) : null}
          </Group>
        ) : null}
      </Stack>
    </Input.Wrapper>
  );
}
