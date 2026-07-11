#!/usr/bin/env bash
# Backfill EmailContact rows (and optionally sync to Resend).
# Requires CRON_SECRET and NEXTAUTH_URL (or pass BASE_URL).
set -euo pipefail

BASE_URL="${BASE_URL:-${NEXTAUTH_URL:-http://127.0.0.1:3000}}"
LIMIT="${LIMIT:-100}"
SYNC="${SYNC_TO_RESEND:-false}"
CURSOR="${CURSOR_GUEST_ID:-}"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is required" >&2
  exit 1
fi

QS="limit=${LIMIT}&syncToResend=${SYNC}"
if [[ -n "$CURSOR" ]]; then
  QS="${QS}&cursorGuestId=${CURSOR}"
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}/api/admin/email-contacts-backfill?${QS}"
