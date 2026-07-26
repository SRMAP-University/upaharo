"""Check Neon DATABASE_URL host reachability without printing secrets."""
from __future__ import annotations

import socket
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.startswith("DATABASE_URL="):
                continue
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            parsed = urlparse(raw)
            host = parsed.hostname or ""
            port = parsed.port or 5432
            print(f"file={name}")
            print(f"host={host}")
            print(f"port={port}")
            print(f"sslmode={'sslmode=' in raw}")
            try:
                with socket.create_connection((host, port), timeout=8):
                    print("tcp_connect=OK")
            except OSError as exc:
                print(f"tcp_connect=FAIL ({type(exc).__name__}: {exc})")
            return
    print("DATABASE_URL not found")


if __name__ == "__main__":
    main()
