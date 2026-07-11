"use client";

import type { JSONContent } from "@tiptap/core";
import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";

import type { MailyEditorInstance } from "@/components/broadcast/MailyEditorCanvas";
import { insertMergeTag } from "@/components/broadcast/MailyEditorCanvas";
import { STAFF_NOTICE_EMAIL_MERGE_TAGS } from "@/lib/email/staffNoticeMergeTags";
import { cn } from "@/lib/utils";

const MailyEditorCanvas = dynamic(
  () => import("@/components/broadcast/MailyEditorCanvas").then((m) => m.MailyEditorCanvas),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-xl bg-zinc-100" /> }
);

type StaffNoticeMailyEditorProps = {
  value: JSONContent;
  onChange: (next: JSONContent) => void;
  className?: string;
};

export function StaffNoticeMailyEditor({ value, onChange, className }: StaffNoticeMailyEditorProps) {
  const editorRef = useRef<MailyEditorInstance | null>(null);

  const handleEditorReady = useCallback(
    (editor: MailyEditorInstance) => {
      editorRef.current = editor;
      onChange(editor.getJSON());
    },
    [onChange]
  );

  function handleInsertMergeTag(id: string, label: string) {
    const editor = editorRef.current;
    if (!editor) return;
    insertMergeTag(editor, id, label);
    onChange(editor.getJSON());
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-xs font-medium text-zinc-700">Merge tags</p>
        <p className="mt-1 text-xs text-zinc-500">
          Type <code className="rounded bg-zinc-100 px-1">@</code> in the editor or click to insert.
          Use <strong>check_in_link</strong> for each staff member&apos;s personal check-in URL.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAFF_NOTICE_EMAIL_MERGE_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-white"
              onClick={() => handleInsertMergeTag(tag.id, tag.label)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
      <MailyEditorCanvas
        contentJson={value}
        onEditorReady={handleEditorReady}
        mergeTags={STAFF_NOTICE_EMAIL_MERGE_TAGS}
        className="min-h-[20rem]"
      />
    </div>
  );
}
