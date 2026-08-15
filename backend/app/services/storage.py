import uuid
from pathlib import Path
import mimetypes

from fastapi import HTTPException
from fastapi.responses import Response, StreamingResponse
from vercel.blob import BlobClient
from vercel.blob.errors import BlobError, BlobNotFoundError

from app.core.config import settings

_SAFE_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")


def _blob_client() -> BlobClient:
    """Create a server-only client for the configured private Vercel Blob store."""
    return BlobClient(token=settings.BLOB_READ_WRITE_TOKEN)


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

    content_type = mimetypes.guess_type(original_filename)[0] or "application/octet-stream"
    try:
        _blob_client().put(
            relative_path,
            content,
            access="private",
            content_type=content_type,
            add_random_suffix=False,
        )
    except BlobError as exc:
        raise RuntimeError("Unable to store uploaded file in Vercel Blob") from exc
    return relative_path


def resolve(relative_path: str) -> Path:
    return settings.upload_path / relative_path


def delete(relative_path: str) -> None:
    if settings.STORAGE_PROVIDER == "vercel_blob":
        try:
            _blob_client().delete(relative_path)
        except BlobError as exc:
            raise RuntimeError("Unable to delete file from Vercel Blob") from exc
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

    try:
        result = _blob_client().get(relative_path, access="private")
    except BlobNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File missing on server") from exc
    except BlobError as exc:
        raise HTTPException(status_code=502, detail="File storage is temporarily unavailable") from exc
    if result is None or result.status_code != 200 or result.stream is None:
        raise HTTPException(status_code=404, detail="File missing on server")

    safe_filename = filename.replace('"', "").replace("\r", "").replace("\n", "")
    return StreamingResponse(
        result.stream,
        media_type=media_type or result.blob.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )
