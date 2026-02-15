from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
    )

    APP_NAME: str = "SecurePosture"
    APP_VERSION: str = "1.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-to-random-string"

    DATABASE_URL: str

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5176,http://localhost:3000,http://192.168.200.69:5173,http://192.168.200.69:5176,http://192.168.200.69:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
