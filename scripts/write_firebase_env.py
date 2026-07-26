"""Copy Firebase Admin SDK JSON into .env.local as base64 (gitignored)."""
from __future__ import annotations

import base64
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_SA = pathlib.Path.home() / "Downloads" / "upaharo-firebase-adminsdk-fbsvc-1a3eddf8f6.json"
ENV_PATH = ROOT / ".env.local"


def main() -> int:
    sa_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SA
    if not sa_path.exists():
        print(f"Service account not found: {sa_path}")
        return 1

    raw = sa_path.read_bytes()
    # Validate JSON first
    sa = json.loads(raw.decode("utf-8"))
    b64 = base64.b64encode(raw).decode("ascii")

    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    keys_to_drop = {
        "FIREBASE_SERVICE_ACCOUNT_JSON",
        "CRON_SECRET",
        "REMINDER_DAYS_AHEAD",
    }
    lines = []
    for ln in text.splitlines():
        key = ln.split("=", 1)[0] if "=" in ln else ""
        if key in keys_to_drop:
            continue
        lines.append(ln)

    # Unquoted base64 — safest for dotenv (no escapes / newlines)
    lines.append(f"FIREBASE_SERVICE_ACCOUNT_JSON={b64}")
    lines.append("CRON_SECRET=upaharo-cron-change-me")
    lines.append("REMINDER_DAYS_AHEAD=3")

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Updated {ENV_PATH}")
    print(f"project_id={sa.get('project_id')}")
    print("Stored as base64 (restart next.js to pick up)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
