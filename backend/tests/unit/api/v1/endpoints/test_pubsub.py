"""
Unit tests for the Pub/Sub endpoints in app/api/api_v1/endpoints/pubsub.py
"""
import base64
import json
import pytest
import sys
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

# app.workers.media_workerモジュールをモック
sys.modules['app.workers.media_worker'] = MagicMock()
sys.modules['app.workers.media_worker'].process_media_task = AsyncMock(return_value=True)

# データベース接続をモック
@pytest.fixture(autouse=True)
def mock_db_connection():
    # 実際のデータベース接続をモック
    with patch("app.core.database.create_engine"), \
         patch("app.core.database.sessionmaker"), \
         patch("app.core.database.get_db"):
        yield

# process_media_taskのモックを作成
@pytest.fixture
def mock_process_media_task():
    async def _process_media_task(db, media_id):
        return True
    return _process_media_task

# 直接インポートするのではなく、パッチを適用してからインポートする
# from app.api.api_v1.endpoints.pubsub import handle_media_new, PubSubMessage
# from app.main import app


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def test_client():
    with patch("app.core.settings.settings") as mock_settings:
        mock_settings.GCP_PROJECT_ID = "test-project-id"
        mock_settings.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/credentials.json"
        
        # appをインポートする前にパッチを適用
        from app.main import app
        return TestClient(app)


class TestPubSubMessage:
    """Test cases for PubSubMessage class."""

    def test_init_with_valid_data(self):
        """Test initialization with valid data."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings:
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            
            # PubSubMessageクラスをインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import PubSubMessage
            
            # Prepare test data
            data = {"media_id": "test-media-id"}
            encoded_data = base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "publishTime": "2025-05-17T10:00:00Z",
                    "attributes": {"attr1": "value1"},
                    "data": encoded_data
                }
            }
            
            # Create PubSubMessage
            message = PubSubMessage(request_json)
            
            # Assert
            assert message.message_id == "test-message-id"
            assert message.publish_time == "2025-05-17T10:00:00Z"
            assert message.attributes == {"attr1": "value1"}
            assert message.data == {"media_id": "test-media-id"}

    def test_init_with_empty_data(self):
        """Test initialization with empty data."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings:
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            
            # PubSubMessageクラスをインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import PubSubMessage
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "publishTime": "2025-05-17T10:00:00Z",
                    "attributes": {}
                }
            }
            
            # Create PubSubMessage
            message = PubSubMessage(request_json)
            
            # Assert
            assert message.message_id == "test-message-id"
            assert message.publish_time == "2025-05-17T10:00:00Z"
            assert message.attributes == {}
            assert message.data == {}

    def test_init_with_invalid_data(self):
        """Test initialization with invalid base64 data."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings:
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            
            # PubSubMessageクラスをインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import PubSubMessage
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "data": "invalid-base64"  # Invalid base64
                }
            }
            
            # This should raise an exception
            with pytest.raises(Exception):
                PubSubMessage(request_json)


@pytest.mark.asyncio
class TestHandleMediaNew:
    """Test cases for handle_media_new endpoint."""

    async def test_handle_media_new_success(self, mock_db, mock_process_media_task):
        """Test successful handling of media-new message."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings, \
             patch("app.core.database.settings") as mock_db_settings, \
             patch("app.api.api_v1.endpoints.pubsub.process_media_task", return_value=True):
            
            # 必要な設定をモック
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            mock_db_settings.DATABASE_URL = "sqlite:///./test.db"
            
            # handle_media_new関数をインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import handle_media_new
            
            # Prepare test data
            data = {"media_id": "test-media-id"}
            encoded_data = base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "data": encoded_data
                }
            }
            
            # Mock request
            mock_request = AsyncMock()
            mock_request.json.return_value = request_json
            
            # Mock process_media_task
            with patch("app.api.api_v1.endpoints.pubsub.process_media_task", return_value=True) as mock_process:
                # Call the endpoint
                result = await handle_media_new(mock_request, mock_db)
                
                # Assert
                mock_process.assert_called_once_with(mock_db, "test-media-id")
                assert result == {"status": "success", "media_id": "test-media-id"}

    async def test_handle_media_new_processing_failure(self, mock_db, mock_process_media_task):
        """Test handling when media processing fails."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings, \
             patch("app.core.database.settings") as mock_db_settings, \
             patch("app.api.api_v1.endpoints.pubsub.process_media_task", return_value=False):
            
            # 必要な設定をモック
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            mock_db_settings.DATABASE_URL = "sqlite:///./test.db"
            
            # handle_media_new関数をインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import handle_media_new
            
            # Prepare test data
            data = {"media_id": "test-media-id"}
            encoded_data = base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "data": encoded_data
                }
            }
            
            # Mock request
            mock_request = AsyncMock()
            mock_request.json.return_value = request_json
            
            # Mock process_media_task to return False (processing failed)
            with patch("app.api.api_v1.endpoints.pubsub.process_media_task", return_value=False) as mock_process:
                # Call the endpoint
                result = await handle_media_new(mock_request, mock_db)
                
                # Assert
                mock_process.assert_called_once_with(mock_db, "test-media-id")
                assert result == {"status": "error", "media_id": "test-media-id"}

    async def test_handle_media_new_invalid_request(self, mock_db, mock_process_media_task):
        """Test handling of invalid request body."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings, \
             patch("app.core.database.settings") as mock_db_settings:
            
            # 必要な設定をモック
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            mock_db_settings.DATABASE_URL = "sqlite:///./test.db"
            
            # handle_media_new関数をインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import handle_media_new
            
            # Mock request that raises an exception when json() is called
            mock_request = AsyncMock()
            mock_request.json.side_effect = Exception("Invalid JSON")
            
            # Call the endpoint and expect an HTTPException
            with pytest.raises(HTTPException) as excinfo:
                await handle_media_new(mock_request, mock_db)
            
            # Assert
            assert excinfo.value.status_code == 400
            assert "Invalid request body" in excinfo.value.detail

    async def test_handle_media_new_missing_media_id(self, mock_db, mock_process_media_task):
        """Test handling when media_id is missing from the message."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings, \
             patch("app.core.database.settings") as mock_db_settings:
            
            # 必要な設定をモック
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            mock_db_settings.DATABASE_URL = "sqlite:///./test.db"
            
            # handle_media_new関数をインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import handle_media_new
            
            # Prepare test data with missing media_id
            data = {"some_other_field": "value"}
            encoded_data = base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "data": encoded_data
                }
            }
            
            # Mock request
            mock_request = AsyncMock()
            mock_request.json.return_value = request_json
            
            # Call the endpoint and expect an HTTPException
            with pytest.raises(HTTPException) as excinfo:
                await handle_media_new(mock_request, mock_db)
            
            # Assert
            assert excinfo.value.status_code == 500
            assert "Error processing Pub/Sub message" in excinfo.value.detail

    async def test_handle_media_new_processing_exception(self, mock_db, mock_process_media_task):
        """Test handling when process_media_task raises an exception."""
        # 環境変数の依存関係を解決するためのパッチ
        with patch("app.core.settings.settings") as mock_settings, \
             patch("app.core.database.settings") as mock_db_settings:
            
            # 必要な設定をモック
            mock_settings.GCP_PROJECT_ID = "test-project-id"
            mock_db_settings.DATABASE_URL = "sqlite:///./test.db"
            
            # handle_media_new関数をインポート（パッチ適用後）
            from app.api.api_v1.endpoints.pubsub import handle_media_new
            
            # Prepare test data
            data = {"media_id": "test-media-id"}
            encoded_data = base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")
            
            request_json = {
                "message": {
                    "messageId": "test-message-id",
                    "data": encoded_data
                }
            }
            
            # Mock request
            mock_request = AsyncMock()
            mock_request.json.return_value = request_json
            
            # Mock process_media_task to raise an exception
            with patch("app.api.api_v1.endpoints.pubsub.process_media_task", side_effect=Exception("Processing error")) as mock_process:
                # Call the endpoint and expect an HTTPException
                with pytest.raises(HTTPException) as excinfo:
                    await handle_media_new(mock_request, mock_db)
            
                # Assert
                mock_process.assert_called_once_with(mock_db, "test-media-id")
                assert excinfo.value.status_code == 500
                assert "Error processing Pub/Sub message" in excinfo.value.detail
