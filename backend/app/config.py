import os
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # App info
    app_name: str = "AutoTest AI"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # Database
    database_url: str = ""

    # AI Services
    anthropic_api_key: str = ""
    ai_agent_url: str = "http://127.0.0.1:8001"
    test_runner_url: str = "http://127.0.0.1:8002"

    # External integrations
    github_token: str = ""
    jira_base_url: str = ""
    jira_email: str = ""
    jira_api_token: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_database_path(self) -> Path:
        """Get the database path, using platform-specific data directory"""
        if self.database_url:
            # Extract path from sqlite URL
            return Path(self.database_url.replace("sqlite+aiosqlite:///", ""))

        # Default to user data directory
        if os.name == "nt":  # Windows
            base = Path(os.environ.get("APPDATA", ""))
        elif os.name == "darwin":  # macOS
            base = Path.home() / "Library" / "Application Support"
        else:  # Linux
            base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

        data_dir = base / "com.autotest.ai"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "autotest.db"


settings = Settings()
