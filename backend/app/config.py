from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HomeBrain AI"
    environment: str = "development"
    database_url: str = "sqlite:///./homebrain.db"
    cors_origins: str = "http://localhost:3000,https://homebrain-ai.vercel.app"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
