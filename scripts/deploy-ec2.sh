#!/usr/bin/env bash
# Production deploy on EC2 — run manually or via GitHub Actions after push to main.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/upaharo}"
BRANCH="${DEPLOY_BRANCH:-main}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"

cd "$APP_DIR"

echo "==> Fetching origin/${BRANCH}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Restarting PM2"
pm2 restart upaharo --update-env
pm2 save

echo "==> Health check"
sleep 3
curl -sf http://127.0.0.1:3000/api/settings >/dev/null
echo "Deploy OK — $(git rev-parse --short HEAD)"
