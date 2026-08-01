#!/usr/bin/env bash
# Production deploy on EC2 — keep the live app up while building.
# Uses a low-memory build + pm2 reload (zero-downtime) instead of a hard restart.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/upaharo}"
BRANCH="${DEPLOY_BRANCH:-main}"
# Keep build heap modest so the running Next.js process is not OOM-killed.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

cd "$APP_DIR"

echo "==> Fetching origin/${BRANCH}"
git fetch origin "$BRANCH" --depth=20
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

LOCK_CHANGED=0
if ! git diff --quiet HEAD@{1} HEAD -- package-lock.json 2>/dev/null; then
  LOCK_CHANGED=1
fi

if [[ "$LOCK_CHANGED" == "1" ]] || [[ ! -d node_modules ]]; then
  echo "==> Installing dependencies (package-lock changed)"
  npm ci --prefer-offline --no-audit --no-fund
else
  echo "==> Skipping npm ci (lockfile unchanged)"
fi

echo "==> Building (live app stays up)"
npm run build

echo "==> Reloading PM2 (zero-downtime)"
# reload = graceful reload when possible; falls back to restart only if needed
if pm2 describe upaharo >/dev/null 2>&1; then
  pm2 reload upaharo --update-env
else
  PORT=3000 pm2 start npm --name upaharo -- start
fi
pm2 save

echo "==> Health check"
ok=0
for i in 1 2 3 4 5 6; do
  if curl -sf --max-time 5 http://127.0.0.1:3000/api/settings >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" != "1" ]]; then
  echo "Health check failed — attempting pm2 restart"
  pm2 restart upaharo --update-env || true
  sleep 3
  curl -sf --max-time 8 http://127.0.0.1:3000/api/settings >/dev/null
fi

echo "Deploy OK — $(git rev-parse --short HEAD)"
