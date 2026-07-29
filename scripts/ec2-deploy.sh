#!/bin/bash
set -euo pipefail
APP_DIR=/home/ubuntu/upaharo
PUBLIC_IP="${1:?public ip required}"

sudo mkdir -p "$APP_DIR"
sudo chown -R ubuntu:ubuntu "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/SRMAP-University/upaharo.git "$APP_DIR" || true
fi

cd "$APP_DIR"
if [ ! -f package.json ]; then
  echo "Repo clone failed — waiting for rsync from local machine"
  exit 0
fi

npm install
npm run build
pm2 delete upaharo 2>/dev/null || true
PORT=3000 pm2 start npm --name upaharo -- start
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash || true

echo "Deployed at http://${PUBLIC_IP}:3000"
