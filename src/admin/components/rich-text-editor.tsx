"use client";

import { Box, FileButton, Input, Loader } from "@mantine/core";
import { RichTextEditor, type RichTextEditorLabels } from "@mantine/tiptap";
import { IconPhotoPlus } from "@tabler/icons-react";
import Image from "@tiptap/extension-image";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { brandNavy } from "../theme";
import classes from "./rich-text-editor.module.css";

export type PendingBodyFile = {
  key: string;
  file: File;
  previewUrl: string;
};

/**
 * Swatches offered by the text colour control. Literal hex values are required
 * because the chosen colour is written into the stored `style` attribute and
 * rendered on the public site, which does not share the admin theme's CSS
 * variables.
 *
 * Ordered as: brand blues, greens, then accents/neutrals.
 */
const RICH_TEXT_COLORS = [
  brandNavy[8], // #0a3d6d
  brandNavy[6], // #035b98 - primary
  brandNavy[5], // #2f80b7
  "#0ca678", // teal 7
  "#12b886", // teal 6 - theme `success`
  "#40c057", // green 6
  "#e8590c", // orange 8 - theme `warning`
  "#c92a2a", // red 9 - theme `danger`
  "#212529", // dark 9 - default body text
  "#495057", // gray 7
  "#868e96", // gray 6
];
// Deliberately no white/very-light swatch: the public article template renders
// this HTML on a light background, so it would produce invisible text. The
// custom picker is still available if a light colour is genuinely needed.

/** Thai translations for the controls used in this editor. */
const RICH_TEXT_LABELS: Partial<RichTextEditorLabels> = {
  boldControlLabel: "ตัวหนา",
  italicControlLabel: "ตัวเอียง",
  underlineControlLabel: "ขีดเส้นใต้",
  strikeControlLabel: "ขีดฆ่า",
  h2ControlLabel: "หัวข้อระดับ 2",
  h3ControlLabel: "หัวข้อระดับ 3",
  bulletListControlLabel: "รายการแบบสัญลักษณ์",
  orderedListControlLabel: "รายการแบบตัวเลข",
  blockquoteControlLabel: "ข้อความอ้างอิง",
  linkControlLabel: "แทรกลิงก์",
  unlinkControlLabel: "ลบลิงก์",
  clearFormattingControlLabel: "ล้างรูปแบบ",
  undoControlLabel: "ย้อนกลับ",
  redoControlLabel: "ทำซ้ำ",
  colorPickerControlLabel: "สีตัวอักษร",
  unsetColorControlLabel: "ล้างสีตัวอักษร",
  colorControlLabel: (color) => `กำหนดสีตัวอักษรเป็น ${color}`,
  colorPickerColorLabel: (color) => `กำหนดสีตัวอักษรเป็น ${color}`,
  colorPickerCancel: "ยกเลิก",
  colorPickerClear: "ล้างสี",
  colorPickerColorPicker: "เลือกสีเอง",
  colorPickerPalette: "จานสี",
  colorPickerSave: "บันทึก",
  linkEditorInputLabel: "ลิงก์",
  linkEditorInputPlaceholder: "https://example.com",
  linkEditorExternalLink: "เปิดลิงก์ในแท็บใหม่",
  linkEditorInternalLink: "เปิดลิงก์ในแท็บเดิม",
  linkEditorSave: "บันทึก",
};

export type RichTextEditorFieldProps = {
  /** Field label rendered by `Input.Wrapper`. */
  label: string;
  description?: ReactNode;
  value: string;
  onChangeAction: (value: string) => void;
  onPendingFilesChangeAction?: (files: PendingBodyFile[]) => void;
  pendingFilesResetKey?: number;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  withAsterisk?: boolean;
};

/**
 * Shared admin body-content editor, styled to match Mantine's `TextInput` /
 * `Textarea` (see rich-text-editor.module.css).
 *
 * Note: colours picked here are emitted as `<span style="color: ...">`, so the
 * per-module `sanitize*Body` helpers must keep allowing that tag/style pair.
 */
export function RichTextEditorField({
  label,
  description,
  value,
  onChangeAction,
  onPendingFilesChangeAction,
  pendingFilesResetKey = 0,
  error,
  disabled = false,
  readOnly = false,
  withAsterisk = false,
}: RichTextEditorFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pendingFilesRef = useRef(new Map<string, PendingBodyFile>());
  const pendingFilesCallbackRef = useRef(onPendingFilesChangeAction);

  useEffect(() => {
    pendingFilesCallbackRef.current = onPendingFilesChangeAction;
  }, [onPendingFilesChangeAction]);

  const notifyPendingFiles = () => {
    pendingFilesCallbackRef.current?.([...pendingFilesRef.current.values()]);
  };

  const removeUnusedPendingFiles = (html: string) => {
    for (const [key, pendingFile] of pendingFilesRef.current) {
      if (html.includes(pendingFile.previewUrl)) continue;
      URL.revokeObjectURL(pendingFile.previewUrl);
      pendingFilesRef.current.delete(key);
    }
    notifyPendingFiles();
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Image.configure({ allowBase64: false }),
      // `TextStyle` must be registered before `Color`, which stores the value
      // as a `color` attribute on the `textStyle` mark. Neither ships in
      // StarterKit v3.
      TextStyle,
      Color,
    ],
    content: value,
    editable: !disabled && !readOnly,
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      removeUnusedPendingFiles(html);
      onChangeAction(html);
    },
  });

  useEffect(
    () => () => {
      for (const pendingFile of pendingFilesRef.current.values()) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
      pendingFilesRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (pendingFilesResetKey === 0) return;
    for (const pendingFile of pendingFilesRef.current.values()) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    pendingFilesRef.current.clear();
    pendingFilesCallbackRef.current?.([]);
  }, [pendingFilesResetKey]);

  const uploadImage = async (file: File | null) => {
    if (!file || !editor || disabled || readOnly) return;
    setUploading(true);
    setUploadError(null);
    try {
      const key = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      pendingFilesRef.current.set(key, { key, file, previewUrl });
      notifyPendingFiles();
      editor.chain().focus().setImage({ src: previewUrl, alt: file.name }).run();
    } catch {
      setUploadError("ไม่สามารถอัปโหลดรูปภาพได้");
    } finally {
      setUploading(false);
    }
  };

  const resolvedError = error ?? uploadError;

  return (
    <Input.Wrapper
      label={label}
      description={description}
      withAsterisk={withAsterisk}
      error={resolvedError}
    >
      {/* Keeps the framed box (and therefore the layout) stable while tiptap
          initialises on the client -- `useEditor` returns null on first paint
          because of `immediatelyRender: false`. */}
      {!editor ? (
        <Box
          className={classes.root}
          data-error={Boolean(resolvedError) || undefined}
          data-disabled={disabled || undefined}
          mih={260}
          p="sm"
        >
          <Loader size="sm" />
        </Box>
      ) : (
        <RichTextEditor
          editor={editor}
          variant="subtle"
          labels={RICH_TEXT_LABELS}
          classNames={{
            root: classes.root,
            toolbar: classes.toolbar,
            content: classes.content,
            control: classes.control,
          }}
          data-error={Boolean(resolvedError) || undefined}
          data-disabled={disabled || undefined}
        >
          {!readOnly ? (
            <RichTextEditor.Toolbar sticky stickyOffset={60}>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.Strikethrough />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
                <RichTextEditor.Blockquote />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.ColorPicker colors={RICH_TEXT_COLORS} />
                <RichTextEditor.UnsetColor />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
                <FileButton
                  onChange={(file) => void uploadImage(file)}
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled}
                >
                  {(fileButtonProps) => (
                    <RichTextEditor.Control
                      {...fileButtonProps}
                      type="button"
                      disabled={disabled}
                      aria-label="แทรกรูปภาพ"
                      title="แทรกรูปภาพ"
                    >
                      {uploading ? (
                        <Loader size={16} />
                      ) : (
                        <IconPhotoPlus size={16} />
                      )}
                    </RichTextEditor.Control>
                  )}
                </FileButton>
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.ClearFormatting />
                <RichTextEditor.Undo />
                <RichTextEditor.Redo />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>
          ) : null}
          <RichTextEditor.Content mih={260} />
        </RichTextEditor>
      )}
    </Input.Wrapper>
  );
}
