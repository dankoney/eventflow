"use client";

import { Editor } from "@maily-to/core";
import { VariableExtension, getVariableSuggestions } from "@maily-to/core/extensions";
import type { JSONContent } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";

import { BROADCAST_EMAIL_MERGE_TAGS } from "@/lib/email/broadcastMergeTags";
import { cn } from "@/lib/utils";

export type MailyEditorInstance = {
  getJSON: () => JSONContent;
  chain: () => {
    focus: () => {
      insertContent: (content: unknown) => { run: () => boolean };
    };
  };
};

type MailyEditorCanvasProps = {
  contentJson: JSONContent;
  onEditorReady: (editor: MailyEditorInstance) => void;
  className?: string;
  mergeTags?: ReadonlyArray<{ id: string; label: string }>;
};

export function MailyEditorCanvas({
  contentJson,
  onEditorReady,
  className,
  mergeTags = BROADCAST_EMAIL_MERGE_TAGS
}: MailyEditorCanvasProps) {
  const extensions = useMemo(
    () => [
      VariableExtension.configure({
        suggestion: getVariableSuggestions("@"),
        variables: mergeTags.map((tag) => ({
          name: tag.id,
          label: tag.label,
          required: false
        }))
      })
    ],
    [mergeTags]
  );

  const [editorKey, setEditorKey] = useState(0);
  const contentSignature = JSON.stringify(contentJson);

  useEffect(() => {
    const id = "maily-editor-stylesheet";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "/vendor/maily-editor.css";
    document.head.appendChild(link);
  }, []);
  useEffect(() => {
    setEditorKey((k) => k + 1);
  }, [contentSignature]);

  return (
    <div className={cn("min-h-[28rem] overflow-hidden rounded-xl border border-zinc-200 bg-white", className)}>
      <Editor
        key={editorKey}
        contentJson={contentJson}
        extensions={extensions}
        onCreate={(editor) => onEditorReady(editor as MailyEditorInstance)}
        onUpdate={(editor) => onEditorReady(editor as MailyEditorInstance)}
        config={{
          hasMenuBar: true,
          spellCheck: true,
          wrapClassName: "min-h-[28rem]",
          contentClassName: "px-4 py-3"
        }}
      />
    </div>
  );
}

export function insertMergeTag(editor: MailyEditorInstance, id: string, label: string) {
  editor
    .chain()
    .focus()
    .insertContent([
      {
        type: "variable",
        attrs: {
          id,
          label,
          fallback: null,
          showIfKey: null,
          required: false
        }
      },
      { type: "text", text: " " }
    ])
    .run();
}
