"""Explicit read projections for settings and audit history."""
from app.schemas.admin_ops import SettingOut, ActivityLogOut

SECRET_MARKERS = ("secret", "password", "token", "credential", "private", "smtp_user", "api_key", "access_key", "connection", "database_url")


def setting_out(row) -> SettingOut:
    result = SettingOut.model_validate(row)
    if any(marker in f"{row.category} {row.key}".lower() for marker in SECRET_MARKERS):
        result.value = None
        result.description = None
    return result


def audit_out(row) -> ActivityLogOut:
    result = ActivityLogOut.model_validate(row)
    # Historical descriptions are arbitrary strings, not a secret-safe format.
    # Keep events/actors/entities/timestamps; do not echo free text to clients.
    result.description = None
    return result
