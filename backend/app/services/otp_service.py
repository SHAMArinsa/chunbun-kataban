import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.auth import EmailOtp
from app.services.email_service import send_email

OTP_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_VERIFY_ATTEMPTS = 5
VERIFIED_WINDOW_MINUTES = 30


def request_email_otp(db: Session, email: str, purpose: str = "signup") -> None:
    recent = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email, EmailOtp.purpose == purpose)
        .order_by(EmailOtp.id.desc())
        .first()
    )
    if recent and recent.created_at > datetime.now(timezone.utc) - timedelta(seconds=RESEND_COOLDOWN_SECONDS):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Please wait a minute before requesting another code")

    code = f"{random.randint(0, 999999):06d}"
    otp = EmailOtp(
        email=email, code_hash=hash_password(code), purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()

    send_email(
        to=email,
        subject="Your ARINSA AI MINDS verification code",
        body=f"Your verification code is {code}. It expires in {OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.",
    )


def verify_email_otp(db: Session, email: str, code: str, purpose: str = "signup") -> None:
    otp = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email, EmailOtp.purpose == purpose, EmailOtp.verified_at.is_(None))
        .order_by(EmailOtp.id.desc())
        .first()
    )
    if otp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending verification code for this email — request a new one")
    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many incorrect attempts — request a new code")
    if datetime.now(timezone.utc) > otp.expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This code has expired — request a new one")

    otp.attempts += 1
    if not verify_password(code, otp.code_hash):
        db.add(otp)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect code")

    otp.verified_at = datetime.now(timezone.utc)
    db.add(otp)
    db.commit()


def is_email_verified(db: Session, email: str, purpose: str = "signup") -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=VERIFIED_WINDOW_MINUTES)
    return (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email, EmailOtp.purpose == purpose, EmailOtp.verified_at.isnot(None), EmailOtp.verified_at >= cutoff)
        .first()
        is not None
    )
