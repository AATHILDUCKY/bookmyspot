from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'bookmyspot API'
    app_env: str = 'development'
    secret_key: str = Field(default='change-me-super-secret')
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = 'HS256'

    database_url: str = Field(default='postgresql+psycopg://postgres:postgres@localhost:5432/book_my_saloon')

    sendgrid_api_key: str | None = None
    sender_email: str = 'noreply@bookmyspot.local'

    smtp_host: str | None = None
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_pass: str | None = None
    smtp_from: str | None = None

    admin_name: str = 'Platform Admin'
    admin_email: str = 'admin@bookmyspot.local'
    admin_phone: str = '+10000000000'
    admin_password: str = 'ChangeMe123!'
    otp_expire_minutes: int = 10


settings = Settings()
