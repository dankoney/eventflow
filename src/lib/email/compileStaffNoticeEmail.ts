import type { JSONContent } from "@tiptap/core";
import { Maily } from "@maily-to/render";

import { ensureBroadcastEmailOuterShell } from "@/lib/email/compileEmailTemplate";
import { substituteBroadcastMergeTags } from "@/lib/email/compileEmailTemplate";

const STAFF_NOTICE_MAX_WIDTH_PX = 680;

/**
 * Renders Maily editor JSON to HTML with {{merge_tag}} placeholders (no marketing footer).
 */
export async function compileStaffNoticeEmailTemplateHtml(editorState: JSONContent): Promise<string> {
  const maily = new Maily(editorState);
  maily.setShouldReplaceVariableValues(false);
  maily.setVariableFormatter(({ variable }) => `{{${variable}}}`);

  const html = await maily.render({ pretty: false });
  return ensureStaffNoticeEmailOuterShell(html);
}

function ensureStaffNoticeEmailOuterShell(html: string): string {
  if (/max-width:\s*(600|680)px/i.test(html)) {
    return html;
  }

  const lower = html.toLowerCase();
  const bodyOpen = lower.indexOf("<body");
  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyOpen === -1 || bodyClose === -1 || bodyClose <= bodyOpen) {
    return html;
  }

  const bodyOpenEnd = html.indexOf(">", bodyOpen);
  if (bodyOpenEnd === -1) return html;

  const inner = html.slice(bodyOpenEnd + 1, bodyClose);
  const wrapped = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color:#f4f4f4;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:${STAFF_NOTICE_MAX_WIDTH_PX}px;width:100%;background-color:#ffffff;border:1px solid #d4d4d4;">
        <tr>
          <td>${inner}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return html.slice(0, bodyOpenEnd + 1) + wrapped + html.slice(bodyClose);
}

export function wrapStaffNoticeEmailDocument(params: {
  bodyHtml: string;
  subject: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
${params.bodyHtml}
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderStaffNoticeEmailFromTemplate(
  templateHtml: string,
  values: Record<string, string>,
  subject: string
): string {
  const bodyHtml = substituteBroadcastMergeTags(templateHtml, values);
  return wrapStaffNoticeEmailDocument({ bodyHtml, subject });
}
