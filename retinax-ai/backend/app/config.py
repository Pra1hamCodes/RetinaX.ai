from functools import lru_cache
from pathlib import Path
from typing import List, Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    # FastAPI
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_cors_origins: str = "http://localhost:5173"
    api_v1_prefix: str = "/api/v1"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_cookie_name: str = "retinax_access"
    jwt_cookie_secure: bool = False
    jwt_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # Database
    database_url: str

    # Celery / Redis
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # Storage
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_dir: Path = Path("/app/storage")
    storage_public_base_url: str = "/storage"

    # ML
    ml_models_dir: Path = Path("/app/ml/models")
    ml_data_dir: Path = Path("/data/colored_images")
    ml_train_csv: Path = Path("/data/train.csv")
    ml_metrics_dir: Path = Path("/app/ml/metrics")
    ml_input_size: int = 224
    ml_binary_threshold: float = 0.5
    ml_ensemble_w_binary: float = 0.2
    ml_ensemble_w_multi: float = 0.3
    ml_ensemble_w_effnet: float = 0.5

    # Standalone runs the backend without Celery/Redis/Postgres.
    standalone_mode: bool = False

    @property
    def cors_origins(self) -> List[str]:
        return [s.strip() for s in self.backend_cors_origins.split(",") if s.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def upload_dir(self) -> Path:
        return self.storage_local_dir / "uploads"

    @property
    def heatmap_dir(self) -> Path:
        return self.storage_local_dir / "heatmaps"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
