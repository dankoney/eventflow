#!/usr/bin/env bash
# Run billing cron endpoints (trial expiry, reminders, dunning retries).
# Usage (from httpdocs, with .env loaded):
#   set -a && source .env && set +a && ./scripts/run-billing-crons.sh
# Or pass BASE_URL / CRON_SECRET explicitly.
set -euo pipefail

BASE_URL="${BASE_URL:-${NEXTAUTH_URL:-${PUBLIC_APP_URL:-http://127.0.0.1:3000}}}"
BASE_URL="${BASE_URL%/}"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is required. Generate one: openssl rand -hex 32" >&2
  echo "Add it to .env, then: set -a && source .env && set +a && $0" >&2
  exit 1
fi

auth_header="Authorization: Bearer ${CRON_SECRET}"

echo "→ GET ${BASE_URL}/api/cron/billing/lifecycle"
curl -fsS -H "${auth_header}" "${BASE_URL}/api/cron/billing/lifecycle"
echo ""

echo "→ GET ${BASE_URL}/api/cron/billing/dunning"
curl -fsS -H "${auth_header}" "${BASE_URL}/api/cron/billing/dunning"
echo ""

echo "Billing crons completed."
