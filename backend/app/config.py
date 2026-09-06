"""EchoSphere config — env-backed settings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pydantic
import pydantic_settings  # type: ignore[import-untyped]
from dotenv import load_dotenv

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Load .env into os.environ; override=True so rotated keys take effect on restart
load_dotenv(BACKEND_DIR / ".env", override=True)
load_dotenv(".env", override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(BACKEND_DIR / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/echosphere",
        description="Async SQLAlchemy connection URL (Supabase Postgres).",
    )
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    agora_app_id: str = ""
    agora_app_certificate: str = ""
    agora_convoai_api_key: str = ""

    gemini_api_key: str = ""
    
    anam_api_key: str = ""
    anam_avatar_id: str = ""
    anam_voice_id: str = "6bfbe25a-979d-40f3-a92b-5394170af54b"
    anam_llm_id: str = "ANAM_GPT_4O_MINI_V1"

    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""

    email_provider: str = "console"
    email_api_key: str = ""
    email_from_domain: str = "echosphere.app"

    mcp_whiteboard_listen_host: str = "127.0.0.1"
    mcp_whiteboard_listen_port: int = 8001

    app_host: str = "127.0.0.1"
    app_port: int = 8000
    debug: bool = False

    @property
    def whiteboard_mcp_server_url(self) -> str:
        host = self.mcp_whiteboard_listen_host
        if host in ("0.0.0.0", "::", "localhost"):
            host = "localhost"
        return f"http://{host}:{self.mcp_whiteboard_listen_port}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
