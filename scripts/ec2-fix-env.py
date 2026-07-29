#!/usr/bin/env python3
from pathlib import Path

p = Path("/home/ubuntu/upaharo/.env.local")
lines = p.read_text().splitlines()
out = []
for line in lines:
    key = line.split("=", 1)[0]
    if key == "NEXTAUTH_URL":
        out.append('NEXTAUTH_URL="http://3.111.32.194:3000"')
    elif key == "NEXT_PUBLIC_APP_URL":
        out.append('NEXT_PUBLIC_APP_URL="http://3.111.32.194:3000"')
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n")
print("env updated")
