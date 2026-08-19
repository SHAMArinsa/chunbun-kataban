from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_refresh_token, hash_refresh_token
from app.models.auth import RefreshToken


def _refresh_token_sequence_is_stale(error: IntegrityError) -> bool:
    """Identify only the recoverable primary-key collision caused by a stale sequence."""
    constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", "")
    return constraint_name == "refresh_tokens_pkey"


def _synchronize_refresh_token_sequence(db: Session) -> None:
    db.execute(
        text(
            """
            SELECT setval(
                pg_get_serial_sequence('refresh_tokens', 'id'),
                COALESCE((SELECT MAX(id) FROM refresh_tokens), 1),
                true
            )
            """
        )
    )
    db.commit()


def issue_refresh_token(db: Session, user_id: int, user_agent: str | None, ip_address: str | None) -> str:
    raw_token = generate_refresh_token()
    token_data = {
        "user_id": user_id,
        "token_hash": hash_refresh_token(raw_token),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "user_agent": user_agent,
        "ip_address": ip_address,
    }
    token_row = RefreshToken(**token_data)
    db.add(token_row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if not _refresh_token_sequence_is_stale(error):
            raise
        _synchronize_refresh_token_sequence(db)
        db.add(RefreshToken(**token_data))
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
