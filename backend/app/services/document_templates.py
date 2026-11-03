"""Fill ARINSA's approved PDF artwork with a student's details.

The three templates in app/assets/templates are the official designs (Welcome Certificate,
Internship Completion Certificate, Payment Invoice). Nothing is redrawn: each value is written
onto the blank line that the artwork already contains, then merged onto the template page.
Coordinates below are the exact blank-line positions measured from the templates
(x from the left edge, "line" = distance of the blank line from the TOP of the page, in points).
"""
from __future__ import annotations

from app.core.names import proper_name

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ASSETS = Path(__file__).resolve().parent.parent / "assets"
TEMPLATES = ASSETS / "templates"
FONTS = ASSETS / "fonts"

NAVY = HexColor("#0B1F4D")
INK = HexColor("#13295B")
MUTED = HexColor("#51607A")
GREEN = HexColor("#008A4E")
INVOICE_BG = HexColor("#FAFDFF")

_FONTS = {
    "Script": "GreatVibes-Regular.ttf",
    "Serif": "PlayfairDisplay-Bold.ttf",
    "SerifSemi": "PlayfairDisplay-SemiBold.ttf",
    "Sans": "Montserrat-Medium.ttf",
    "SansSemi": "Montserrat-SemiBold.ttf",
    "SansBold": "Montserrat-Bold.ttf",
    "Caps": "Cinzel-SemiBold.ttf",
}
_registered = False
TEMPLATE_FILES = ("welcome_certificate.pdf", "completion_certificate.pdf", "payment_invoice.pdf")


def self_check() -> list[str]:
    """Return the template/font files that are missing (empty list = ready)."""
    missing = [f"templates/{f}" for f in TEMPLATE_FILES if not (TEMPLATES / f).is_file()]
    missing += [f"fonts/{f}" for f in _FONTS.values() if not (FONTS / f).is_file()]
    return missing


def _fonts() -> None:
    global _registered
    if _registered:
        return
    for name, file in _FONTS.items():
        path = FONTS / file
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
    _registered = True


def _font(name: str, fallback: str = "Helvetica-Bold") -> str:
    try:
        pdfmetrics.getFont(name)
        return name
    except KeyError:
        return fallback


def _fit(c: canvas.Canvas, text: str, font: str, size: float, max_width: float, min_size: float = 7) -> float:
    font = _font(font)
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 0.5
    c.setFont(font, size)
    return size


def _centered(c, text, *, x0, x1, line, page_h, font, size, color=INK, lift=5, min_size=7):
    """Write text centred on a blank line that runs from x0 to x1 at `line` points from the top."""
    if not text:
        return
    c.setFillColor(color)
    _fit(c, text, font, size, (x1 - x0) - 6, min_size)
    c.drawCentredString((x0 + x1) / 2, page_h - line + lift, text)


def _left(c, text, *, x0, x1, line, page_h, font, size, color=INK, lift=5, min_size=7):
    if not text:
        return
    c.setFillColor(color)
    _fit(c, text, font, size, (x1 - x0) - 4, min_size)
    c.drawString(x0 + 2, page_h - line + lift, text)


def _merge(template: str, draw) -> bytes:
    _fonts()
    reader = PdfReader(str(TEMPLATES / template))
    page = reader.pages[0]
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    draw(c, w, h)
    c.save()
    page.merge_page(PdfReader(buf).pages[0])
    out = PdfWriter()
    out.add_page(page)
    out.add_metadata({"/Producer": "ARINSA AI MINDS", "/Creator": "ARINSA AI MINDS Portal"})
    res = BytesIO()
    out.write(res)
    return res.getvalue()


def fmt_date(value: date | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%d %B %Y")


def _money(amount: Decimal | float | int, currency: str) -> str:
    amount = Decimal(str(amount or 0)).quantize(Decimal("0.01"))
    whole, frac = f"{amount:.2f}".split(".")
    if currency == "INR":  # Indian grouping: 1,23,456.00
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail]) if groups else tail
    else:
        whole = f"{int(whole):,}"
    return f"{whole}.{frac}"


# ------------------------------------------------------------------ welcome certificate
@dataclass
class WelcomeData:
    student_name: str
    program_name: str
    duration: str
    student_number: str
    enrollment_date: date
    start_date: date
    issue_date: date
    certificate_number: str


def render_welcome(d: WelcomeData) -> bytes:
    def draw(c, w, h):
        _centered(c, proper_name(d.student_name).upper(), x0=289, x1=575, line=247, page_h=h, font="Serif", size=24, color=NAVY, lift=5, min_size=14)
        _centered(c, d.program_name.upper(), x0=330, x1=515, line=312, page_h=h, font="SansBold", size=13, color=NAVY, lift=5)
        _centered(c, d.duration, x0=393, x1=505, line=373, page_h=h, font="SansSemi", size=11, lift=5)
        _centered(c, d.student_number, x0=179, x1=285, line=482, page_h=h, font="SansSemi", size=10, lift=4)
        _centered(c, fmt_date(d.enrollment_date), x0=358, x1=472, line=484, page_h=h, font="SansSemi", size=10, lift=4)
        _centered(c, fmt_date(d.start_date), x0=546, x1=698, line=484, page_h=h, font="SansSemi", size=10, lift=4)
        c.setFillColor(HexColor("#FFFFFF"))  # hide the stray "-" printed between the two issue-date lines
        c.rect(536, h - 537, 76, 7, stroke=0, fill=1)
        _centered(c, fmt_date(d.enrollment_date), x0=532, x1=615, line=529, page_h=h, font="SansSemi", size=8.5, lift=4)
    return _merge("welcome_certificate.pdf", draw)


# ------------------------------------------------------------------ completion certificate
@dataclass
class CompletionData:
    student_name: str
    program_name: str
    duration: str
    student_number: str
    start_date: date | None
    end_date: date | None
    issue_date: date
    certificate_number: str
    credential_url: str = ""


def _credential_block(c, h, cred_id: str, url: str, cx: float = 92, top: float = 278, span: float = 100) -> None:
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    bold, reg = _font("SansBold"), _font("Sans", "Helvetica")
    y = h - top
    if url:
        q = 58
        widget = QrCodeWidget(url, barLevel="M")
        x0, y0, x1, y1 = widget.getBounds()
        drawing = Drawing(q, q, transform=[q / (x1 - x0), 0, 0, q / (y1 - y0), 0, 0])
        drawing.add(widget)
        c.setFillColorRGB(1, 1, 1)
        c.roundRect(cx - q / 2 - 3, y - q - 3, q + 6, q + 6, 3, stroke=0, fill=1)
        renderPDF.draw(drawing, c, cx - q / 2, y - q)
        c.linkURL(url, (cx - q / 2, y - q, cx + q / 2, y), relative=0)
        c.setFillColor(MUTED); c.setFont(reg, 5.2)
        c.drawCentredString(cx, y - q - 10, "Scan to verify")
        y -= q + 22

    def fit(text, font, size, lo=4.6):
        while size > lo and pdfmetrics.stringWidth(text, font, size) > span:
            size -= 0.1
        return size

    c.setFillColor(MUTED); c.setFont(bold, 5.8); c.drawCentredString(cx, y, "CREDENTIAL ID")
    size = fit(cred_id, bold, 7.5)
    c.setFillColor(NAVY); c.setFont(bold, size); c.drawCentredString(cx, y - 9, cred_id)
    if not url:
        return
    y -= 22
    c.setFillColor(MUTED); c.setFont(bold, 5.8); c.drawCentredString(cx, y, "CREDENTIAL URL")
    # Break the URL after "/verify/" (or wherever it gets too long) so it wraps neatly.
    size, lines = 5.8, [url]
    if pdfmetrics.stringWidth(url, reg, size) > span:
        cut = url.rfind("/", 0, len(url) - 1) + 1
        lines = [url[:cut], url[cut:]]
        for i, ln in enumerate(lines):
            size = min(size, fit(ln, reg, 5.8, 4.2))
    c.setFillColor(NAVY); c.setFont(reg, size)
    for i, ln in enumerate(lines):
        yy = y - 8 - i * (size + 2)
        c.drawCentredString(cx, yy, ln)
        w = pdfmetrics.stringWidth(ln, reg, size)
        c.linkURL(url, (cx - w / 2, yy - 1.5, cx + w / 2, yy + size), relative=0)


def render_completion(d: CompletionData) -> bytes:
    def draw(c, w, h):
        _centered(c, proper_name(d.student_name).upper(), x0=309, x1=538, line=266, page_h=h, font="Serif", size=24, color=NAVY, lift=5, min_size=14)
        _centered(c, d.program_name.upper(), x0=318, x1=528, line=358, page_h=h, font="SansBold", size=13, color=NAVY, lift=6)
        _centered(c, f"{d.duration} Internship Program at", x0=331, x1=525, line=389, page_h=h, font="SansSemi", size=10.5, lift=5)
        _centered(c, d.student_number, x0=111, x1=263, line=471, page_h=h, font="SansSemi", size=10.5, lift=4)
        _centered(c, fmt_date(d.start_date), x0=333, x1=509, line=471, page_h=h, font="SansSemi", size=10.5, lift=4)
        _centered(c, fmt_date(d.end_date), x0=547, x1=710, line=471, page_h=h, font="SansSemi", size=10.5, lift=4)
        _centered(c, fmt_date(d.issue_date), x0=514, x1=631, line=525, page_h=h, font="SansSemi", size=9, lift=4)
        # Credential block in the open space on the left: QR code, Credential ID, Credential URL.
        _credential_block(c, h, d.certificate_number, d.credential_url)
    return _merge("completion_certificate.pdf", draw)


# ------------------------------------------------------------------ payment invoice
@dataclass
class InvoiceData:
    amount: Decimal
    currency: str
    transaction_id: str
    transaction_date: datetime | date
    student_name: str
    student_number: str
    program_name: str
    payment_status: str
    payment_method: str
    breakdown: str | None = None  # legacy, no longer printed
    base_amount: Decimal | None = None   # programme price before GST / fee
    fee_amount: Decimal | None = None
    fee_label: str | None = None         # e.g. "GST (18%)" or "Intl. fee (10%)"


def render_invoice(d: InvoiceData) -> bytes:
    def draw(c, w, h):
        # Redraw the whole body below the "PAYMENT INVOICE" title: details table, then a payment summary box.
        c.setFillColor(INVOICE_BG)
        c.rect(34, h - 522, 532, 290, stroke=0, fill=1)
        sym = "\u20b9" if d.currency == "INR" else "$"
        money = lambda v: f"{sym}{_money(v, d.currency)}"
        total = d.amount
        base = d.base_amount if d.base_amount is not None else total
        fee = d.fee_amount if d.fee_amount is not None else total - base
        label = d.fee_label or ("GST" if d.currency == "INR" else "Intl. fee")
        sans, semi, bold = _font("Sans", "Helvetica"), _font("SansSemi", "Helvetica-Bold"), _font("SansBold", "Helvetica-Bold")
        L, V, R = 52, 220, 548
        rule = HexColor("#D8E7F5")

        when = d.transaction_date
        when_txt = when.strftime("%d %B %Y, %I:%M %p") if isinstance(when, datetime) else fmt_date(when)
        rows = [("Transaction ID", d.transaction_id), ("Transaction Date", when_txt), ("Student Name", proper_name(d.student_name)),
                ("Student ID", d.student_number), ("Program", d.program_name), ("Payment Status", d.payment_status),
                ("Payment Method", d.payment_method)]
        y = 258
        for k, v in rows:
            c.setFillColor(MUTED); c.setFont(sans, 10.5); c.drawString(L, h - y, k)
            c.setFillColor(GREEN if k == "Payment Status" else NAVY); c.setFont(semi, 10.5); c.drawString(V, h - y, str(v))
            c.setStrokeColor(rule); c.setLineWidth(0.7); c.line(L, h - y - 9, R, h - y - 9)
            y += 25

        # Payment summary box
        top, bot = y + 2, y + 92
        c.setFillColor(HexColor("#EEF5FC")); c.setStrokeColor(HexColor("#C9DCF0")); c.setLineWidth(0.8)
        c.roundRect(L, h - bot, R - L, bot - top, 10, stroke=1, fill=1)
        c.setFillColor(HexColor("#1254A6")); c.setFont(bold, 9); c.drawString(L + 16, h - (top + 18), "PAYMENT SUMMARY")
        c.setFillColor(MUTED); c.setFont(sans, 9.5)
        c.drawString(L + 16, h - (top + 40), f"{'Price + GST' if d.currency == 'INR' else 'Price + international processing fee'}")
        c.drawString(L + 16, h - (top + 56), "Thank you for enrolling with us.")
        bx, br = 300, R - 16
        for yy, k, v in ((top + 20, "Programme fee", money(base)), (top + 38, label, money(fee))):
            c.setFillColor(MUTED); c.setFont(sans, 10.5); c.drawString(bx, h - yy, k)
            c.setFillColor(NAVY); c.setFont(semi, 10.5); c.drawRightString(br, h - yy, v)
        c.setStrokeColor(HexColor("#B7CFEA")); c.line(bx, h - (top + 48), br, h - (top + 48))
        c.setFillColor(NAVY); c.setFont(bold, 13); c.drawString(bx, h - (top + 72), "Total Paid")
        c.setFillColor(GREEN); c.setFont(bold, 20); c.drawRightString(br, h - (top + 73), money(total))
    return _merge("payment_invoice.pdf", draw)
