#!/usr/bin/env bash
# Poll origin/main and deploy when a new commit is pushed (fallback when GitHub Actions is unavailable).
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/upaharo}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG="${DEPLOY_POLL_LOG:-/home/ubuntu/upaharo-deploy-poll.log}"

cd "$APP_DIR"

git fetch origin "$BRANCH" --quiet 2>>"$LOG" || exit 0

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/${BRANCH}")"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date -Is) New commit ${REMOTE} — deploying" >>"$LOG"
bash "$APP_DIR/scripts/deploy-ec2.sh" >>"$LOG" 2>&1
