#!/usr/bin/env python3
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / os.getenv("UPLOAD_DIR", "uploads")
MANIFEST = ROOT / "uploads-manifest.json"


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    manifest = []
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text())
        except (OSError, json.JSONDecodeError):
            manifest = []

    expected = {entry["file_id"]: entry for entry in manifest if "file_id" in entry}
    errors = 0

    if not UPLOAD_DIR.exists():
        print("No uploads directory found")
        return 0

    for file_path in UPLOAD_DIR.iterdir():
        if not file_path.is_file():
            continue
        file_id = file_path.name
        current_hash = compute_sha256(file_path)
        if file_id in expected:
            expected_hash = expected[file_id].get("sha256")
            if expected_hash and expected_hash != current_hash:
                print(f"TAMPERED: {file_id}")
                errors += 1
            else:
                print(f"OK: {file_id}")
        else:
            print(f"UNTRACKED: {file_id} sha256={current_hash}")

    if errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
