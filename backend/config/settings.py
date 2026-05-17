from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/botcore"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ENCRYPTION_KEY: str = ""  # Fernet key — auto-generated if blank

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_URL: str = ""  # e.g. https://your-backend.railway.app/api/telegram/webhook

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://your-frontend.vercel.app"

    # Phase 6 — Multichannel tokens (can also be set via Admin UI)
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "botcore_wh_verify"
    FACEBOOK_PAGE_TOKEN: str = ""
    FACEBOOK_PAGE_ID: str = ""
    FACEBOOK_VERIFY_TOKEN: str = "botcore_fb_verify"
    FACEBOOK_APP_SECRET: str = ""
    INSTAGRAM_ACCESS_TOKEN: str = ""
    INSTAGRAM_ACCOUNT_ID: str = ""

    # Phase 4 — Multimodal
    # Voice: "groq" (default, free) | "openai" | "local" (whisper package)
    WHISPER_PROVIDER: str = "groq"
    WHISPER_MODEL: str = "whisper-large-v3"
    # Image OCR: "tesseract" (default, free) | "google"
    IMAGE_PROVIDER: str = "tesseract"
    GOOGLE_VISION_API_KEY: str = ""
    # Max file size for uploads (bytes) — default 20 MB
    MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024

    # Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
