"""
Unit tests for the Pub/Sub integration in the Media API endpoints
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

# 直接インポートせず、パッチ適用後にインポート
# from app.api.api_v1.endpoints.media import create_media_asset
from app.models.media import MediaType, ProcessingStatus
from app.schemas.media import MediaAssetCreate
from app.utils.pubsub import PubSubClient


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def mock_current_user():
    return {"uid": "test-user-id", "email": "test@example.com"}


@pytest.fixture
def mock_page():
    page = MagicMock()
    page.id = uuid4()
    page.notebook_id = uuid4()
    return page


@pytest.fixture
def mock_notebook(mock_current_user):
    notebook = MagicMock()
    notebook.id = uuid4()
    notebook.user_id = mock_current_user["uid"]
    notebook.deleted = False
    return notebook


@pytest.fixture
def mock_media_asset():
    media = MagicMock()
    media.id = uuid4()
    media.media_type = MediaType.AUDIO
    media.storage_path = "/path/to/audio.wav"
    media.processing_status = ProcessingStatus.PENDING
    return media


@pytest.fixture
def media_asset_create_data(mock_page):
    return MediaAssetCreate(
        page_id=mock_page.id,
        filename="test-audio.wav",
        media_type=MediaType.AUDIO,
        storage_path="/path/to/audio.wav",
        language="ja-JP"
    )


@pytest.mark.asyncio
class TestMediaPubSubIntegration:
    """Test cases for Pub/Sub integration in Media API endpoints."""

    async def test_create_media_asset_with_pubsub_enabled(
        self, mock_db, mock_current_user, mock_page, mock_notebook, 
        mock_media_asset, media_asset_create_data, patch_settings, patch_media_worker
    ):
        """Test creating a media asset with Pub/Sub enabled."""
        # Mock dependencies
        with patch("app.api.api_v1.endpoints.media.page.get", return_value=mock_page), \
             patch("app.api.api_v1.endpoints.media.notebook.get", return_value=mock_notebook), \
             patch("app.api.api_v1.endpoints.media.media_asset.create_with_page", return_value=mock_media_asset), \
             patch("app.api.api_v1.endpoints.media.pubsub_client") as mock_pubsub_client:
            
            # Configure settings
            patch_settings.PUBSUB_ENABLED = True
            
            # パッチ適用後にインポート
            from app.api.api_v1.endpoints.media import create_media_asset
            
            # Call the endpoint
            result = await create_media_asset(
                db=mock_db,
                current_user=mock_current_user,
                media_in=media_asset_create_data
            )
            
            # Assert
            assert result == mock_media_asset
            
            # Verify Pub/Sub message was published
            mock_pubsub_client.publish_message.assert_called_once()
            
            # Check message content
            call_args = mock_pubsub_client.publish_message.call_args[1]
            assert call_args["topic_id"] == "media-new"
            
            # Check message data
            message = call_args["message"]
            assert message["media_id"] == str(mock_media_asset.id)
            assert message["media_type"] == mock_media_asset.media_type.value
            assert message["storage_path"] == mock_media_asset.storage_path
            assert message["user_id"] == mock_current_user["uid"]
            
            # Check attributes
            attributes = call_args["attributes"]
            assert attributes["media_type"] == mock_media_asset.media_type.value
            assert attributes["user_id"] == mock_current_user["uid"]

    async def test_create_media_asset_with_pubsub_disabled(
        self, mock_db, mock_current_user, mock_page, mock_notebook, 
        mock_media_asset, media_asset_create_data
    ):
        """Test creating a media asset with Pub/Sub disabled."""
        # Mock dependencies
        with patch("app.api.api_v1.endpoints.media.page.get", return_value=mock_page), \
             patch("app.api.api_v1.endpoints.media.notebook.get", return_value=mock_notebook), \
             patch("app.api.api_v1.endpoints.media.media_asset.create_with_page", return_value=mock_media_asset), \
             patch("app.api.api_v1.endpoints.media.settings") as mock_settings, \
             patch("app.api.api_v1.endpoints.media.pubsub_client") as mock_pubsub_client:
            
            # Configure settings
            mock_settings.PUBSUB_ENABLED = False
            
            # Call the endpoint
            result = await create_media_asset(
                db=mock_db,
                current_user=mock_current_user,
                media_in=media_asset_create_data
            )
            
            # Assert
            assert result == mock_media_asset
            
            # Verify Pub/Sub message was NOT published
            mock_pubsub_client.publish_message.assert_not_called()

    async def test_create_media_asset_pubsub_exception(
        self, mock_db, mock_current_user, mock_page, mock_notebook, 
        mock_media_asset, media_asset_create_data
    ):
        """Test handling of exceptions when publishing Pub/Sub message."""
        # Mock dependencies
        with patch("app.api.api_v1.endpoints.media.page.get", return_value=mock_page), \
             patch("app.api.api_v1.endpoints.media.notebook.get", return_value=mock_notebook), \
             patch("app.api.api_v1.endpoints.media.media_asset.create_with_page", return_value=mock_media_asset), \
             patch("app.api.api_v1.endpoints.media.settings") as mock_settings, \
             patch("app.api.api_v1.endpoints.media.pubsub_client") as mock_pubsub_client, \
             patch("app.api.api_v1.endpoints.media.logger") as mock_logger:
            
            # Configure settings and mock
            mock_settings.PUBSUB_ENABLED = True
            mock_pubsub_client.publish_message.side_effect = Exception("Pub/Sub error")
            
            # Call the endpoint - should not raise exception even if Pub/Sub fails
            result = await create_media_asset(
                db=mock_db,
                current_user=mock_current_user,
                media_in=media_asset_create_data
            )
            
            # Assert
            assert result == mock_media_asset
            
            # Verify error was logged
            mock_logger.error.assert_called_once()
            assert "Error publishing Pub/Sub message" in mock_logger.error.call_args[0][0]

    async def test_create_media_asset_non_processable_type(
        self, mock_db, mock_current_user, mock_page, mock_notebook,
        media_asset_create_data
    ):
        """Test creating a media asset with a type that doesn't need processing."""
        # Create a media asset with a type that doesn't need processing
        mock_media_asset = MagicMock()
        mock_media_asset.id = uuid4()
        mock_media_asset.media_type = MediaType.OTHER  # Not a processable type
        mock_media_asset.storage_path = "/path/to/file.txt"
        
        # Update create data
        media_asset_create_data.media_type = MediaType.OTHER
        
        # Mock dependencies
        with patch("app.api.api_v1.endpoints.media.page.get", return_value=mock_page), \
             patch("app.api.api_v1.endpoints.media.notebook.get", return_value=mock_notebook), \
             patch("app.api.api_v1.endpoints.media.media_asset.create_with_page", return_value=mock_media_asset), \
             patch("app.api.api_v1.endpoints.media.settings") as mock_settings, \
             patch("app.api.api_v1.endpoints.media.pubsub_client") as mock_pubsub_client:
            
            # Configure settings
            mock_settings.PUBSUB_ENABLED = True
            
            # Call the endpoint
            result = await create_media_asset(
                db=mock_db,
                current_user=mock_current_user,
                media_in=media_asset_create_data
            )
            
            # Assert
            assert result == mock_media_asset
            
            # Verify Pub/Sub message was NOT published for non-processable type
            mock_pubsub_client.publish_message.assert_not_called()
