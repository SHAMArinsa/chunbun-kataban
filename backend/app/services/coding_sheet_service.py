import io
import re
import zipfile

from fastapi import HTTPException, status

SUPPORTED_EXTENSIONS = (".docx", ".pdf", ".txt")

PROBLEM_HEADER_RE = re.compile(r"^problem\s*\d+\s*:\s*(.+)$", re.IGNORECASE)
FIELD_LABELS = {
    "statement": "statement",
    "sample input": "sample_input",
    "sample output": "sample_output",
    "constraints": "constraints",
}
FIELD_RE = re.compile(r"^(statement|sample input|sample output|constraints)\s*:\s*(.*)$", re.IGNORECASE)


def extract_text_from_upload(filename: str, content: bytes) -> str:
    """Extracts plain text from an uploaded .docx, .pdf, or .txt file."""
    name = (filename or "").lower()
    if name.endswith(".docx"):
        try:
            import docx
        except ImportError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="python-docx is not installed on the server") from exc
        try:
            document = docx.Document(io.BytesIO(content))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read Word document: {exc}") from exc
        return "\n".join(p.text for p in document.paragraphs)

    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="pypdf is not installed on the server") from exc
        try:
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read PDF file: {exc}") from exc
        # Strip NUL bytes pypdf occasionally emits for malformed glyph mappings — Postgres text
        # columns reject them outright.
        return text.replace("\x00", "")

    if name.endswith(".doc"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Legacy .doc files are not supported — please save as .docx, .pdf, or .txt and re-upload.",
        )

    if name.endswith(".txt"):
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("latin-1")

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported file type for '{filename}'. Supported formats: .docx, .pdf, .txt (or a .zip containing these).",
    )


def _whole_document_fallback(text: str, fallback_title: str) -> list[dict]:
    """Used when the uploaded doc doesn't follow the "Problem N: Title / Statement:" convention
    (or a block was missing a title/statement) — rather than rejecting the file, the whole
    document becomes a single problem so admin can upload any question doc as-is."""
    statement = text.strip() or "(see uploaded document)"
    return [{
        "title": fallback_title,
        "statement": statement,
        "sample_input": None,
        "sample_output": None,
        "constraints": None,
    }]


def parse_coding_problems(text: str, fallback_title: str = "Problem 1") -> tuple[list[dict], int]:
    """Parses problems from text following the convention:

        Problem 1: <title>
        Statement: <text, may span multiple lines>
        Sample Input: <text>
        Sample Output: <text>
        Constraints: <text>

    A blank line or the next "Problem N:" line starts a new block. Statement is required;
    Sample Input/Output/Constraints are optional. If the document doesn't follow this convention
    at all (or every block is missing a title/statement), the whole document is uploaded as a
    single problem instead of being rejected — admin can upload any doc as-is. Returns
    (parsed_problems, blocks_skipped)."""
    lines = text.splitlines()

    blocks: list[list[str]] = []
    current: list[str] | None = None
    for line in lines:
        if PROBLEM_HEADER_RE.match(line.strip()):
            if current is not None:
                blocks.append(current)
            current = [line.strip()]
        elif current is not None:
            current.append(line)
    if current is not None:
        blocks.append(current)

    if not blocks:
        return _whole_document_fallback(text, fallback_title), 0

    parsed: list[dict] = []
    skipped = 0

    for block in blocks:
        header_match = PROBLEM_HEADER_RE.match(block[0].strip())
        title = header_match.group(1).strip()

        fields: dict[str, list[str]] = {"statement": [], "sample_input": [], "sample_output": [], "constraints": []}
        current_field: str | None = None

        for raw_line in block[1:]:
            field_match = FIELD_RE.match(raw_line.strip())
            if field_match:
                current_field = FIELD_LABELS[field_match.group(1).lower()]
                rest = field_match.group(2).strip()
                if rest:
                    fields[current_field].append(rest)
            elif current_field and raw_line.strip():
                fields[current_field].append(raw_line.strip())

        statement = "\n".join(fields["statement"]).strip()
        if not title or not statement:
            skipped += 1
            continue

        parsed.append({
            "title": title,
            "statement": statement,
            "sample_input": "\n".join(fields["sample_input"]).strip() or None,
            "sample_output": "\n".join(fields["sample_output"]).strip() or None,
            "constraints": "\n".join(fields["constraints"]).strip() or None,
        })

    if not parsed:
        return _whole_document_fallback(text, fallback_title), skipped

    return parsed, skipped


def parse_zip_of_problems(content: bytes) -> tuple[list[tuple[str, list[dict], int, bytes, str]], int]:
    """Extracts each .docx/.txt file inside a zip and parses it independently — one file becomes
    one sheet. Files with an unsupported extension, or that fail to parse into any valid problem,
    are skipped rather than failing the whole batch. Returns (results, files_skipped) where
    results is a list of (display_name, problems, problems_skipped, raw_bytes, original_filename)
    per successfully-parsed file — raw_bytes/original_filename let the caller preserve the exact
    original document for students to view, independent of how well it parsed."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read zip file: {exc}") from exc

    results: list[tuple[str, list[dict], int, bytes, str]] = []
    files_skipped = 0

    for entry in archive.namelist():
        if entry.endswith("/") or "/__MACOSX/" in entry or entry.startswith("__MACOSX/"):
            continue
        display_name = entry.rsplit("/", 1)[-1]
        if not display_name.lower().endswith(SUPPORTED_EXTENSIONS):
            files_skipped += 1
            continue
        label = display_name.rsplit(".", 1)[0]
        raw_bytes = archive.read(entry)
        try:
            text = extract_text_from_upload(display_name, raw_bytes)
            problems, skipped = parse_coding_problems(text, fallback_title=label)
        except HTTPException:
            files_skipped += 1
            continue
        results.append((label, problems, skipped, raw_bytes, display_name))

    if not results:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid .docx/.txt files with parseable problems found in the zip")

    return results, files_skipped
