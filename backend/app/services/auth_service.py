from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_refresh_token, hash_refresh_token
from app.models.auth import RefreshToken


def issue_refresh_token(db: Session, user_id: int, user_agent: str | None, ip_address: str | None) -> str:
    raw_token = generate_refresh_token()
    token_row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(token_row)
    db.commit()
    return raw_token


def find_valid_refresh_token(db: Session, raw_token: str) -> RefreshToken | None:
    now = datetime.now(timezone.utc)
    return (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == hash_refresh_token(raw_token),
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > now,
        )
        .first()
    )


def revoke_refresh_token(db: Session, token_row: RefreshToken) -> None:
    token_row.revoked = True
    token_row.revoked_at = datetime.now(timezone.utc)
    db.add(token_row)
    db.commit()
