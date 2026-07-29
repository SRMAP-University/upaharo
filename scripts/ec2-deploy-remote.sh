#!/bin/bash
set -euo pipefail
APP_DIR=/home/ubuntu/upaharo
PUBLIC_IP="13.203.193.152"

cd "$APP_DIR"
cp /home/ubuntu/.env.local.upaharo .env.local
python3 - <<'PY'
from pathlib import Path
p = Path(".env.local")
text = p.read_text()
repl = {
    "NEXTAUTH_URL": 'NEXTAUTH_URL="http://13.203.193.152:3000"',
    "NEXT_PUBLIC_APP_URL": 'NEXT_PUBLIC_APP_URL="http://13.203.193.152:3000"',
}
lines = []
for line in text.splitlines():
    key = line.split("=", 1)[0]
    if key in repl:
        lines.append(repl[key])
    else:
        lines.append(line)
p.write_text("\n".join(lines) + "\n")
PY

npm install
npm run build
pm2 delete upaharo 2>/dev/null || true
PORT=3000 pm2 start npm --name upaharo -- start
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash || true
sleep 3
curl -sf http://127.0.0.1:3000 -o /dev/null && echo APP_OK || echo APP_CHECK_FAILED
