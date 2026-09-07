"use client";

import {
  RichTextEditorField,
  type PendingBodyFile,
  type RichTextEditorFieldProps,
} from "@/admin/components/rich-text-editor";

export type PendingNewsBodyFile = PendingBodyFile;

type NewsRichTextEditorProps = Omit<RichTextEditorFieldProps, "label">;

export function NewsRichTextEditor(props: NewsRichTextEditorProps) {
  return <RichTextEditorField {...props} label="เนื้อหาข่าว" />;
}
