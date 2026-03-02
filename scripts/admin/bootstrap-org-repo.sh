#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <target_dir> <org/repo> [branch]"
  echo "Example: $0 /tmp/aaventure-company aaventure-org/aaventure main"
  exit 1
fi

TARGET_DIR="$1"
ORG_REPO="$2"
BRANCH="${3:-main}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -e "${TARGET_DIR}" ]; then
  echo "Error: target directory already exists: ${TARGET_DIR}"
  echo "Choose an empty/non-existent target directory and rerun."
  exit 1
fi

mkdir -p "${TARGET_DIR}"

echo "Copying project into ${TARGET_DIR}..."
rsync -a \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='cache' \
  --exclude='artifacts' \
  --exclude='data/cookies.txt' \
  "${SOURCE_ROOT}/" "${TARGET_DIR}/"

cd "${TARGET_DIR}"

echo "Initializing fresh git history on branch ${BRANCH}..."
git init -b "${BRANCH}"

if [ -n "${GIT_MIGRATION_NAME:-}" ]; then
  git config user.name "${GIT_MIGRATION_NAME}"
fi

if [ -n "${GIT_MIGRATION_EMAIL:-}" ]; then
  git config user.email "${GIT_MIGRATION_EMAIL}"
fi

git add .
git commit -m "chore: initial company import"

if command -v gh >/dev/null 2>&1; then
  echo "Creating and pushing repo ${ORG_REPO} via GH CLI..."
  if gh repo create "${ORG_REPO}" --private --source=. --remote=origin --push >/dev/null 2>&1; then
    echo "Success: repo created and pushed to ${ORG_REPO}."
    exit 0
  fi

  echo "GH CLI create/push was not completed (auth or repo issue)."
fi

echo "Manual next steps:"
echo "  cd ${TARGET_DIR}"
echo "  git remote add origin git@github.com:${ORG_REPO}.git"
echo "  git push -u origin ${BRANCH}"
