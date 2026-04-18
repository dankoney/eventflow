#!/usr/bin/env bash
# Create a new GitHub repository (API) and push the current branch.
#
#   export GITHUB_TOKEN=ghp_xxxx   # classic PAT with "repo", or fine-grained with repo create + contents write
#   ./scripts/github-create-and-push.sh OWNER NEW_REPO_NAME [private|public]
#
# - If OWNER is a GitHub Organization, the repo is created under that org (you need org permission).
# - Otherwise the repo is created for the authenticated user; OWNER should match your login
#   (we still use OWNER only in the clone URL printed at the end).
#
set -euo pipefail

OWNER="${1:?Owner (GitHub username or org) required}"
REPO="${2:?New repository name required}"
VIS="${3:-private}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Set GITHUB_TOKEN to a personal access token." >&2
  exit 1
fi

if [[ "$VIS" != "private" && "$VIS" != "public" ]]; then
  echo "Third argument must be 'private' or 'public' (default: private)." >&2
  exit 1
fi

PRIV_JSON='true'
[[ "$VIS" == "public" ]] && PRIV_JSON='false'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API="https://api.github.com"
ORG_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" "$API/orgs/$OWNER")

if [[ "$ORG_CODE" == "200" ]]; then
  CREATE_URL="$API/orgs/$OWNER/repos"
  CLONE_OWNER="$OWNER"
else
  CREATE_URL="$API/user/repos"
  LOGIN=$(curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$API/user" |
    python3 -c "import sys,json; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || true)
  if [[ -n "$LOGIN" && "$OWNER" != "$LOGIN" ]]; then
    echo "Note: creating under user '$LOGIN' (API /user/repos). You passed OWNER='$OWNER'." >&2
  fi
  CLONE_OWNER="${LOGIN:-$OWNER}"
fi

echo "Creating repo '$REPO' ($VIS)..."
HTTP=$(curl -sS -o /tmp/gh-create-repo.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "$CREATE_URL" \
  -d "{\"name\":\"$REPO\",\"private\":$PRIV_JSON,\"auto_init\":false}")

if [[ "$HTTP" != "201" ]]; then
  echo "GitHub API returned HTTP $HTTP" >&2
  cat /tmp/gh-create-repo.json >&2 || true
  exit 1
fi

REMOTE="https://github.com/${CLONE_OWNER}/${REPO}.git"
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

BRANCH="$(git branch --show-current)"
echo "Pushing $BRANCH to $REMOTE ..."
git push -u "https://x-access-token:${GITHUB_TOKEN}@github.com/${CLONE_OWNER}/${REPO}.git" "$BRANCH"

echo "Done: https://github.com/${CLONE_OWNER}/${REPO}"
echo "Remote 'origin' is set to $REMOTE (use a credential helper for future pushes without embedding tokens)."
