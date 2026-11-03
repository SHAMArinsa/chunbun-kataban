"""Copy every file in backend/uploads (from local development) into Vercel Blob, keeping the same paths,
so records in a database copied to the server still find their files.

Run once on your laptop, with the server's Blob token:
    (Windows PowerShell)
    $env:STORAGE_PROVIDER="vercel_blob"; $env:BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
    python -m scripts.copy_uploads_to_blob

Safe to run again (files are overwritten with the same content).
"""
import mimetypes
from pathlib import Path

from app.core.config import BACKEND_ROOT, settings
from app.services import storage


def main() -> None:
    if settings.STORAGE_PROVIDER != "vercel_blob":
        raise SystemExit("Set STORAGE_PROVIDER=vercel_blob and BLOB_READ_WRITE_TOKEN first (see the top of this file).")
    root = BACKEND_ROOT / settings.UPLOAD_ROOT
    files = [p for p in root.rglob("*") if p.is_file() and p.name != ".gitkeep"]
    done = 0
    for p in files:
        rel = p.relative_to(root).as_posix()
        storage.overwrite(rel, p.read_bytes(), mimetypes.guess_type(p.name)[0] or "application/octet-stream")
        done += 1
        print(f"  uploaded {rel}")
    print(f"Copied {done} file(s) from {root} to Vercel Blob.")


if __name__ == "__main__":
    main()
