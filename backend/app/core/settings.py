"""
しゃべるノート - アプリケーション設定
環境変数から設定を読み込み、型安全に管理します
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any, List, Union
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """アプリケーション設定"""
    # 基本設定
    PROJECT_NAME: str = "しゃべるノート API"
    API_V1_STR: str = "/api/v1"  # APIバージョンをURLパスに反映
    DEBUG: bool = False
    VERSION: str = "0.1.0"
    
    # 開発環境用設定
    BYPASS_AUTH: bool = False  # ローカル開発環境での認証バイパス
    TEST_USER_EMAIL: str = "test@example.com"  # テスト用ユーザーメール

    # サーバー設定
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Firebase Auth
    FIREBASE_PROJECT_ID: Optional[str] = "talknoteapp"  # デフォルト値を設定
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Google Cloud
    GCP_PROJECT_ID: Optional[str] = "talknoteapp"  # デフォルト値を設定
    GCS_BUCKET_NAME: str = "talknote-media"
    GCS_UPLOAD_FOLDER: str = "uploads"
    
    # ストレージ設定
    STORAGE_PROVIDER: str = "local"  # local, gcs
    LOCAL_STORAGE_PATH: str = "/tmp/talknote_storage"
    MAX_DIRECT_UPLOAD_SIZE: int = 5242880  # 5MB
    MAX_CHUNK_SIZE: int = 5242880  # 5MB
    API_BASE_URL: Optional[str] = None
    
    # Pub/Sub
    PUBSUB_ENABLED: bool = False
    PUBSUB_MEDIA_TOPIC: str = "media-new"

    # STT/TTS
    STT_ENABLED: bool = True
    STT_PROVIDER: str = "google"  # google, parakeet, local
    GOOGLE_STT_API_KEY: Optional[str] = None
    GOOGLE_TTS_API_KEY: Optional[str] = None
    PARAKEET_ENDPOINT: Optional[str] = None
    PARAKEET_ENABLED: bool = False

    # TTS専用設定
    TTS_ENABLED: bool = True
    TTS_DEFAULT_PROVIDER: str = "google"  # 環境変数から読み込み、デフォルトはGoogle TTS
    TTS_PROVIDER: str = "google"  # Google TTSをプライマリに変更
    TTS_FALLBACK_PROVIDERS: List[str] = []  # フォールバック無効化
    
    # MiniMax TTS
    MINIMAX_TTS_API_KEY: Optional[str] = None
    MINIMAX_TTS_ENDPOINT: str = "https://api.minimax.chat/v1/tts"
    
    # Gemini TTS
    GEMINI_TTS_API_KEY: Optional[str] = None
    GEMINI_TTS_ENDPOINT: str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-tts:generate"
    
    # ElevenLabs TTS
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_BASE_URL: str = "https://api.elevenlabs.io/v1"
    
    # 使用可能なTTSプロバイダー一覧
    TTS_AVAILABLE_PROVIDERS: Union[str, List[str]] = ["google", "minimax", "gemini", "elevenlabs"]
    
    # TTS音声設定
    DEFAULT_VOICE_ID: str = "default"
    DEFAULT_SPEAKING_RATE: float = 1.0
    DEFAULT_PITCH: float = 0.0
    DEFAULT_VOLUME_GAIN_DB: float = 0.0
    TTS_CACHE_ENABLED: bool = True
    TTS_CACHE_TTL: int = 3600  # 1時間

    # AI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"
    RESEARCH_PROVIDER: str = "anthropic"  # anthropic, google
    
    # Yahoo! API
    YAHOO_API_CLIENT_ID: Optional[str] = None
    YAHOO_FURIGANA_API_URL: str = "https://jlp.yahooapis.jp/FuriganaService/V2/furigana"
    YAHOO_DICTIONARY_API_URL: str = "https://jlp.yahooapis.jp/DAService/V2/parse"

    # Database（開発環境では自動的にSQLiteを使用）
    DATABASE_URL: Optional[str] = None

    # 機能フラグ
    FEATURE_OFFLINE_MODE: bool = False
    FEATURE_PUBSUB: bool = True
    FEATURE_ASYNC_PROCESSING: bool = True
    FEATURE_OCR: bool = True
    FEATURE_AI_CHAT: bool = True
    FEATURE_RESEARCH: bool = True
    
    # URL インポート分割機能フラグ
    IMPORT_SPLIT_ENABLED: bool = True  # 🆕 Phase 7: 複数ページ機能有効化

    # CORS設定
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @validator("TTS_DEFAULT_PROVIDER", pre=True)
    def validate_tts_provider(cls, v, values):
        """環境変数からTTSプロバイダーを読み込み"""
        # 環境変数TTS_DEFAULT_PROVIDERが設定されている場合はそれを使用
        env_provider = os.getenv("TTS_DEFAULT_PROVIDER")
        if env_provider:
            return env_provider
        return v or "google"  # デフォルトはGoogle TTS

    @validator("TTS_AVAILABLE_PROVIDERS", pre=True)
    def validate_available_providers(cls, v, values):
        """環境変数から使用可能プロバイダーを読み込み"""
        env_providers = os.getenv("TTS_AVAILABLE_PROVIDERS")
        if env_providers:
            return [p.strip() for p in env_providers.split(",")]
        return v or ["google", "minimax", "gemini", "elevenlabs"]

    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v, values):
        """開発環境では自動的にSQLiteを使用"""
        if v is None:
            # DEBUGモードまたはDATABASE_URLが未設定の場合はSQLiteを使用
            debug_mode = values.get('DEBUG', False)
            return "sqlite:///./talknote_dev.db"
        return v

    model_config = {
        "env_file": [
            ".env",
            "../.env", 
            str(Path(__file__).parent.parent.parent / ".env"),  # 絶対パス
        ],
        "case_sensitive": True,
        "extra": "ignore"  # 余分な環境変数を無視する設定
    }


# グローバル設定インスタンス
settings = Settings()
