from fastapi import HTTPException, UploadFile, status

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "xls", "txt", "zip", "rar", "jpg", "jpeg", "png"}

# Magic-byte signatures used to verify the file's real content matches its claimed extension,
# so a video renamed to ".pdf" (or similar) is rejected rather than trusted by extension alone.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF",),
    "zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),  # docx is a zip container
    "xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),  # xlsx is a zip container too
    "rar": (b"Rar!\x1a\x07\x00", b"Rar!\x1a\x07\x01\x00"),  # RAR 1.5-4.0 and RAR 5.0+
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "png": (b"\x89PNG\r\n\x1a\n",),
}


def validate_extension(filename: str) -> str:
    if "." not in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File has no extension")
    ext = filename.rsplit(".", 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '.{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


def validate_signature(ext: str, header_bytes: bytes) -> None:
    signatures = _SIGNATURES.get(ext, ())
    if not any(header_bytes.startswith(sig) for sig in signatures):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match its extension (upload rejected)",
        )


def validate_size(size_bytes: int, max_mb: int) -> None:
    max_bytes = max_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {max_mb}MB",
        )


async def read_and_validate_upload(file: UploadFile, max_mb: int) -> tuple[bytes, str]:
    ext = validate_extension(file.filename)
    content = await file.read()
    validate_size(len(content), max_mb)
    validate_signature(ext, content[:16])
    return content, ext
