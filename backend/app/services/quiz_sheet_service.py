import io

import openpyxl
from fastapi import HTTPException, status

VALID_OPTIONS = {"A", "B", "C", "D"}
HEADER_HINTS = {"question", "question_text", "question text"}


def parse_mcq_sheet(content: bytes) -> tuple[list[dict], int]:
    """Parses an uploaded MCQ Excel sheet: question | option_a | option_b | option_c | option_d | correct_option
    (columns A-F, no header required — a header row is auto-detected and skipped).
    Returns (parsed_rows, skipped_row_count)."""
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read Excel file: {exc}") from exc

    sheet = workbook.worksheets[0]
    parsed: list[dict] = []
    skipped = 0

    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        if row is None or len(row) < 6:
            skipped += 1
            continue
        question_text, opt_a, opt_b, opt_c, opt_d, correct = row[0], row[1], row[2], row[3], row[4], row[5]

        if i == 0 and isinstance(question_text, str) and question_text.strip().lower() in HEADER_HINTS:
            continue

        if any(v is None or str(v).strip() == "" for v in (question_text, opt_a, opt_b, opt_c, opt_d)):
            skipped += 1
            continue

        correct_str = str(correct).strip().upper() if correct is not None else ""
        if correct_str not in VALID_OPTIONS:
            skipped += 1
            continue

        parsed.append({
            "question_text": str(question_text).strip(),
            "option_a": str(opt_a).strip(),
            "option_b": str(opt_b).strip(),
            "option_c": str(opt_c).strip(),
            "option_d": str(opt_d).strip(),
            "correct_option": correct_str,
        })

    if not parsed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid MCQ rows found in the sheet")

    return parsed, skipped
