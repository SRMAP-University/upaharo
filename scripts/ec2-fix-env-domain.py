#!/usr/bin/env python3
from pathlib import Path

APP_URL = "https://www.upaharo.com"
p = Path("/home/ubuntu/upaharo/.env.local")
lines = p.read_text().splitlines()
out = []
for line in lines:
    key = line.split("=", 1)[0]
    if key == "NEXTAUTH_URL":
        out.append(f'NEXTAUTH_URL="{APP_URL}"')
    elif key == "NEXT_PUBLIC_APP_URL":
        out.append(f'NEXT_PUBLIC_APP_URL="{APP_URL}"')
    elif key == "NEXT_PUBLIC_SOCKET_URL":
        out.append(f'NEXT_PUBLIC_SOCKET_URL="{APP_URL}"')
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n")
print("env updated for", APP_URL)
