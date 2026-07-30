#!/bin/bash
set -euo pipefail
echo "== local otp send =="
curl -s -w "\nHTTP:%{http_code}\n" -X POST http://127.0.0.1:3000/api/otp/send \
  -H "Content-Type: application/json" \
  --data-binary '{"phone":"9812345678"}'
echo
echo "== env keys =="
grep -E '^SMS_PASAL_' /home/ubuntu/upaharo/.env.local | sed 's/=.*/=***/'
echo
echo "== sms pasal direct =="
KEY=$(grep '^SMS_PASAL_API_KEY=' /home/ubuntu/upaharo/.env.local | cut -d= -f2- | tr -d '"')
URL=$(grep '^SMS_PASAL_API_URL=' /home/ubuntu/upaharo/.env.local | cut -d= -f2- | tr -d '"')
SENDER=$(grep '^SMS_PASAL_SENDER_ID=' /home/ubuntu/upaharo/.env.local | cut -d= -f2- | tr -d '"')
curl -s -w "\nHTTP:%{http_code}\n" \
  "${URL}?key=${KEY}&contacts=9812345678&senderid=${SENDER}&msg=Upaharo%20test&responsetype=json" | head -c 800
echo
echo "== recent errors =="
pm2 logs upaharo --err --lines 15 --nostream
