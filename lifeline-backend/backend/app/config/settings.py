from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Lifeline Backend"
    ENVIRONMENT: str = "development"
    GOOGLE_VISION_API_KEY: str
    # =========================
    # Supabase
    # =========================
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # =========================
    # JWT Authentication
    # =========================
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    # Short-lived token issued to patients after OTP verification (Step 3+)
    PATIENT_JWT_EXPIRE_MINUTES: int = 15
    # How many days an approved consent grant remains valid (Step 5+)
    CONSENT_ACCESS_DURATION_DAYS: int = 7

    # =========================
    # Logging
    # =========================
    LOG_LEVEL: str = "INFO"

    # =========================
    # AI Configuration
    # =========================
    AI_PROVIDER: str = "groq"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    GEMINI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
