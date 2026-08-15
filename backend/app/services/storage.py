import uuid
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from fastapi.responses import Response

from app.core.config import settings

_SAFE_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")


def _sanitize_filename(filename: str) -> str:
    cleaned = "".join(c if c in _SAFE_CHARS else "_" for c in filename)
    return cleaned[-150:] if len(cleaned) > 150 else cleaned


def save(content: bytes, resource_type: str, original_filename: str) -> str:
    """Persist a file and return its stable storage path (never a public Blob URL)."""
    safe_name = _sanitize_filename(original_filename)
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    relative_path = f"{resource_type}/{stored_name}"
    if settings.STORAGE_PROVIDER == "local":
        full_path = settings.upload_path / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        return relative_path

    response = httpx.put(
        _blob_url(relative_path), content=content,
        headers={"Authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}", "x-add-random-suffix": "0"},
        timeout=60,
    )
    if response.is_error:
        raise RuntimeError("Unable to store uploaded file in Vercel Blob")
    return relative_path


def resolve(relative_path: str) -> Path:
    return settings.upload_path / relative_path


def delete(relative_path: str) -> None:
    if settings.STORAGE_PROVIDER == "vercel_blob":
        response = httpx.delete(_blob_url(relative_path), headers={"Authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}"}, timeout=30)
        if response.status_code not in (200, 202, 204, 404):
            raise RuntimeError("Unable to delete file from Vercel Blob")
        return
    path = resolve(relative_path)
    if path.exists():
        path.unlink()


def download_response(relative_path: str, filename: str, media_type: str | None = None) -> Response:
    """Return a file through the authenticated API; Blob credentials and URLs stay server-side."""
    if settings.STORAGE_PROVIDER == "local":
        path = resolve(relative_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="File missing on server")
        from fastapi.responses import FileResponse
        return FileResponse(path, filename=filename, media_type=media_type)

    response = httpx.get(_blob_url(relative_path), headers={"Authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}"}, timeout=60)
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="File missing on server")
    if response.is_error:
        raise HTTPException(status_code=502, detail="File storage is temporarily unavailable")
    safe_filename = filename.replace('"', "").replace("\r", "").replace("\n", "")
    return Response(
        content=response.content,
        media_type=media_type or response.headers.get("content-type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


def _blob_url(relative_path: str) -> str:
    return "https://blob.vercel-storage.com/" + quote(relative_path, safe="/")
