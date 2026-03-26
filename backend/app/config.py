"""
Centralized configuration for the FusionBite backend.
Uses pydantic-settings to load from environment variables / .env file.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    fda_api_key: str = ""
    google_ai_api_key: str = ""

    # Firebase
    firebase_database_url: str = "https://fusionbite-default-rtdb.firebaseio.com"
    firebase_service_account_path: str = "firebase-service-account.json"

    # FDA API
    fda_api_endpoint: str = "https://api.nal.usda.gov/fdc/v1"

    # Server
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
