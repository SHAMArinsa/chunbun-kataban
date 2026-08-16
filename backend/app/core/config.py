from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_ROOT / ".env"), extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    # JWT_SECRET is the production name.  Keep JWT_SECRET_KEY as a local backwards-compatible alias.
    JWT_SECRET_KEY: str = Field(validation_alias=AliasChoices("JWT_SECRET", "JWT_SECRET_KEY"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    STUDENT_PORTAL_URL: str = Field("http://localhost:5173", validation_alias=AliasChoices("STUDENT_FRONTEND_URL", "STUDENT_PORTAL_URL"))
    ADMIN_PORTAL_URL: str = Field("http://localhost:5174", validation_alias=AliasChoices("ADMIN_FRONTEND_URL", "ADMIN_PORTAL_URL"))
    ALLOWED_ORIGINS: str = ""

    MAX_UPLOAD_SIZE_MB: int = 25
    UPLOAD_ROOT: str = "uploads"
    STORAGE_PROVIDER: str = "local"
    BLOB_READ_WRITE_TOKEN: str = ""

    SEED_ADMIN_EMAIL: str = "admin@arinsaaiminds.com"
    SEED_ADMIN_PASSWORD: str = "Admin@12345"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@arinsaaiminds.com"

    # Prefer explicit live credentials when present, while retaining the existing
    # names for local/test environments.
    RAZORPAY_KEY_ID: str = Field("", validation_alias=AliasChoices("RAZORPAY_LIVE_KEY_ID", "RAZORPAY_KEY_ID"))
    RAZORPAY_KEY_SECRET: str = Field("", validation_alias=AliasChoices("RAZORPAY_LIVE_KEY_SECRET", "RAZORPAY_KEY_SECRET"))
    RAZORPAY_WEBHOOK_SECRET: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        configured = [origin.strip().rstrip("/") for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return list(dict.fromkeys(configured or [self.STUDENT_PORTAL_URL.rstrip("/"), self.ADMIN_PORTAL_URL.rstrip("/")]))

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.STORAGE_PROVIDER not in {"local", "vercel_blob"}:
            raise ValueError("STORAGE_PROVIDER must be 'local' or 'vercel_blob'")
        if self.is_production:
            missing = []
            if not self.DATABASE_URL:
                missing.append("DATABASE_URL")
            if not self.JWT_SECRET_KEY:
                missing.append("JWT_SECRET")
            if not self.ALLOWED_ORIGINS:
                missing.append("ALLOWED_ORIGINS")
            if self.STORAGE_PROVIDER != "vercel_blob":
                missing.append("STORAGE_PROVIDER=vercel_blob")
            if not self.BLOB_READ_WRITE_TOKEN:
                missing.append("BLOB_READ_WRITE_TOKEN")
            if missing:
                raise ValueError("Production configuration missing: " + ", ".join(missing))
        return self

    @property
    def upload_path(self) -> Path:
        path = BACKEND_ROOT / self.UPLOAD_ROOT
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
