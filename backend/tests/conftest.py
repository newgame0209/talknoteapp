"""
テスト用の共通設定とフィクスチャ
"""
import os
import pytest
from unittest.mock import patch, MagicMock

# テスト用の.env.testファイルを読み込むように設定
os.environ["ENV_FILE"] = ".env.test"


@pytest.fixture(scope="session", autouse=True)
def mock_settings_env():
    """
    テスト実行時に必要な環境変数をモックします。
    このフィクスチャはセッションスコープで自動的に適用されます。
    """
    env_vars = {
        "GCP_PROJECT_ID": "test-project-id",
        "FIREBASE_PROJECT_ID": "test-firebase-project",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json",
        "DATABASE_URL": "sqlite:///./test.db",
        "GCS_BUCKET": "test-bucket",
        "PUBSUB_ENABLED": "false",
        "PUBSUB_MEDIA_TOPIC": "test-media-topic",
        "STT_PROVIDER": "google",
        "FEATURE_ASYNC_PROCESSING": "true",
        "FEATURE_OCR": "true",
        "FEATURE_AI_CHAT": "true",
        "FEATURE_RESEARCH": "true",
    }
    
    # 既存の環境変数を保存
    original_env = {}
    for key in env_vars:
        if key in os.environ:
            original_env[key] = os.environ[key]
    
    # テスト用の環境変数を設定
    for key, value in env_vars.items():
        os.environ[key] = value
    
    yield
    
    # テスト終了後に元の環境変数を復元
    for key in env_vars:
        if key in original_env:
            os.environ[key] = original_env[key]
        else:
            del os.environ[key]


@pytest.fixture
def mock_pubsub_settings():
    """
    Pub/Sub関連の設定をモックするフィクスチャ
    """
    with patch("app.core.settings.settings") as mock_settings:
        mock_settings.GCP_PROJECT_ID = "test-project-id"
        mock_settings.PUBSUB_ENABLED = True
        mock_settings.PUBSUB_MEDIA_TOPIC = "test-media-topic"
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json"
        yield mock_settings

@pytest.fixture
def mock_pubsub_client():
    """
    PubSubClientをモックするフィクスチャ
    """
    with patch("app.utils.pubsub.pubsub_client") as mock_client:
        # 必要なメソッドのモック
        mock_client.publish_message.return_value = "mock-message-id"
        mock_client.create_subscription.return_value = "projects/test-project-id/subscriptions/test-subscription"
        yield mock_client


@pytest.fixture(scope="function")
def patch_settings():
    """
    統合的な設定モックフィクスチャ
    すべての app.core.settings.settings 参照をモックします
    """
    with patch("app.core.settings.settings") as mock_settings:
        # 基本設定
        mock_settings.GCP_PROJECT_ID = "test-project-id"
        mock_settings.FIREBASE_PROJECT_ID = "test-firebase-project"
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json"
        mock_settings.DATABASE_URL = "sqlite:///./test.db"
        
        # Pub/Sub設定
        mock_settings.PUBSUB_ENABLED = True
        mock_settings.PUBSUB_MEDIA_TOPIC = "test-media-topic"
        
        # ストレージ設定
        mock_settings.GCS_BUCKET = "test-bucket"
        
        # 機能フラグ
        mock_settings.FEATURE_ASYNC_PROCESSING = True
        mock_settings.FEATURE_OCR = True
        mock_settings.FEATURE_AI_CHAT = True
        mock_settings.FEATURE_RESEARCH = True
        
        # STT設定
        mock_settings.STT_PROVIDER = "google"
        
        yield mock_settings


@pytest.fixture(scope="function")
def patch_database():
    """
    データベース接続をモックするフィクスチャ
    SQLAlchemyのエンジン、セッションファクトリ、セッション生成をモックします
    """
    # エンジン作成をモック
    with patch("app.core.database.create_engine") as mock_create_engine, \
         patch("app.core.database.sessionmaker") as mock_sessionmaker, \
         patch("app.core.database.get_db") as mock_get_db:
        
        # モックセッションを設定
        mock_session = MagicMock()
        mock_sessionmaker.return_value = lambda: mock_session
        mock_get_db.return_value = mock_session
        
        yield {
            "engine": mock_create_engine,
            "sessionmaker": mock_sessionmaker,
            "session": mock_session,
            "get_db": mock_get_db
        }


@pytest.fixture(scope="function")
def patch_media_worker():
    """
    media_workerモジュールをモックするフィクスチャ
    process_media_taskをモックして、実際のメディア処理を回避します
    """
    with patch("app.workers.media_worker.process_media_task") as mock_process_media_task:
        # デフォルトでは成功を返す
        mock_process_media_task.return_value = True
        yield mock_process_media_task
