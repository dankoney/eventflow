import type { JSONContent } from "@tiptap/core";

import { blankStaffNoticeMailyDocument } from "@/lib/email/staffNoticeMergeTags";

export function parseInternalStaffEmailMailyJson(value: unknown): JSONContent {
  if (!value || typeof value !== "object") {
    return blankStaffNoticeMailyDocument();
  }
  const doc = value as JSONContent;
  if (doc.type !== "doc" || !Array.isArray(doc.content)) {
    return blankStaffNoticeMailyDocument();
  }
  return doc;
}
