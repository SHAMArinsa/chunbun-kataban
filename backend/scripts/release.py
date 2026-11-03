"""Runs automatically on every server start (see start.sh):

1. Applies database migrations (alembic upgrade head).
2. If the certificate/invoice design changed since the last run (templates, fonts or layout
   code), re-renders every existing Welcome/Completion Certificate and Invoice once.

Safe to run many times: when nothing changed it does nothing. A Postgres advisory lock
makes sure two instances starting together don't both do the work.

    python -m scripts.release
"""
import hashlib
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text

APP = Path(__file__).resolve().parent.parent / "app"
LOCK_ID = 7_201_904


def design_fingerprint() -> str:
    h = hashlib.sha256()
    files = sorted((APP / "assets" / "templates").glob("*")) + sorted((APP / "assets" / "fonts").glob("*.ttf"))
    files += [APP / "services" / "document_templates.py"]
    for f in files:
        h.update(f.name.encode())
        h.update(f.read_bytes())
    return h.hexdigest()


def main() -> None:
    print("[release] applying database migrations…", flush=True)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True,
                   cwd=Path(__file__).resolve().parent.parent)

    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text("SELECT pg_advisory_lock(:k)"), {"k": LOCK_ID})
        from app.core.config import settings
        # Keyed by storage, so a database copied from a laptop (local files) to the server (Vercel Blob)
        # still gets its documents written into Blob on the first server start.
        key = f"document_design:{settings.STORAGE_PROVIDER}"
        current = design_fingerprint()
        saved = db.execute(text("SELECT value FROM system_state WHERE key = :k"), {"k": key}).scalar()
        if saved == current:
            print("[release] certificate design unchanged — nothing to refresh.", flush=True)
            return
        print("[release] certificate design changed — refreshing existing documents…", flush=True)
        from scripts.refresh_documents import main as refresh
        refresh()
        db.execute(text("""INSERT INTO system_state (key, value) VALUES (:k, :v)
                           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"""),
                   {"k": key, "v": current})
        db.commit()
    finally:
        try:
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
        finally:
            db.close()


if __name__ == "__main__":
    main()
