import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("email")


def send_email(to: str, subject: str, body: str) -> None:
    """Sends a plain-text email over SMTP using the SMTP_* env settings. Without SMTP_HOST
    configured, logs the message instead of sending — lets the rest of the app (and OTP flow)
    work in dev without real mail credentials."""
    if not settings.SMTP_HOST:
        logger.warning("SMTP not configured — logging email instead of sending.\nTo: %s\nSubject: %s\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)
