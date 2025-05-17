"""
Unit tests for the MediaWorker in app/workers/media_worker.py
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, mock_open

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media import MediaAsset, MediaType, ProcessingStatus
from app.providers.stt.google import GoogleSTTProvider, TranscriptionResult

# 直接インポートせず、パッチ適用後にインポート
# from app.workers.media_worker import MediaWorker, process_media_task


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_stt_provider():
    provider = AsyncMock(spec=GoogleSTTProvider)
    result = TranscriptionResult(
        text="テストの文字起こし",
        confidence=0.95,
        language_code="ja-JP",
        segments=[{"start_time": 0.0, "end_time": 1.0, "text": "テスト"}],
        metadata={"duration": 1.0}
    )
    provider.transcribe_file.return_value = result
    return provider


@pytest.fixture
def mock_media_asset_audio():
    media = MagicMock(spec=MediaAsset)
    media.id = "test-media-id"
    media.media_type = MediaType.AUDIO
    media.storage_path = "/path/to/audio.wav"
    media.language = "ja-JP"
    media.processing_status = ProcessingStatus.PENDING
    return media


@pytest.fixture
def mock_media_asset_image():
    media = MagicMock(spec=MediaAsset)
    media.id = "test-media-id"
    media.media_type = MediaType.IMAGE
    media.storage_path = "/path/to/image.jpg"
    media.processing_status = ProcessingStatus.PENDING
    return media


@pytest.mark.asyncio
class TestMediaWorker:
    """Test cases for MediaWorker class."""

    async def test_init(self, mock_db, patch_settings):
        """Test initialization of MediaWorker."""
        with patch("app.workers.media_worker.GoogleSTTProvider") as mock_provider_class:
            # パッチ適用後にインポート
            from app.workers.media_worker import MediaWorker
            
            worker = MediaWorker(mock_db)
            
            assert worker.db == mock_db
            mock_provider_class.assert_called_once()

    async def test_process_media_not_found(self, mock_db, patch_settings):
        """Test processing when media asset is not found."""
        # Mock crud_media.get to return None
        with patch("app.workers.media_worker.crud_media.get", return_value=None) as mock_get:
            # パッチ適用後にインポート
            from app.workers.media_worker import MediaWorker
            
            worker = MediaWorker(mock_db)
            result = await worker.process_media("nonexistent-id")
            
            # Assert
            mock_get.assert_called_once_with(mock_db, id="nonexistent-id")
            assert result is False

    async def test_process_audio_success(self, mock_db, mock_media_asset_audio, mock_stt_provider, patch_settings):
        """Test successful processing of audio media."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Mock dependencies
        with patch("app.workers.media_worker.crud_media.get", return_value=mock_media_asset_audio), \
             patch("app.workers.media_worker.crud_media.update") as mock_update, \
             patch("app.workers.media_worker.crud_transcript.create") as mock_create_transcript, \
             patch("app.workers.media_worker.os.path.exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=b"audio data")), \
             patch.object(MediaWorker, "stt_provider", mock_stt_provider):
            
            # Create worker and process media
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert
            assert result is True
            assert mock_update.call_count == 2  # Called for PROCESSING and COMPLETED
            
            # Check first update (to PROCESSING)
            first_call_args = mock_update.call_args_list[0][1]
            assert first_call_args["db_obj"] == mock_media_asset_audio
            assert first_call_args["obj_in"]["processing_status"] == ProcessingStatus.PROCESSING
            
            # Check second update (to COMPLETED)
            second_call_args = mock_update.call_args_list[1][1]
            assert second_call_args["db_obj"] == mock_media_asset_audio
            assert second_call_args["obj_in"]["processing_status"] == ProcessingStatus.COMPLETED
            
            # Check transcript creation
            mock_create_transcript.assert_called_once()
            transcript_data = mock_create_transcript.call_args[1]["obj_in"]
            assert transcript_data["media_asset_id"] == "test-media-id"
            assert transcript_data["text"] == "テストの文字起こし"
            assert transcript_data["provider"] == "google"
            assert transcript_data["confidence"] == 0.95
            assert transcript_data["language"] == "ja-JP"
            assert "segments" in transcript_data["metadata"]

    async def test_process_audio_file_not_found(self, mock_db, mock_media_asset_audio, patch_settings):
        """Test processing audio when file is not found."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Mock dependencies
        with patch("app.workers.media_worker.crud_media.get", return_value=mock_media_asset_audio), \
             patch("app.workers.media_worker.crud_media.update") as mock_update, \
             patch("app.workers.media_worker.os.path.exists", return_value=False):
            
            # Create worker and process media
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert
            assert result is False
            assert mock_update.call_count == 2  # Called for PROCESSING and FAILED
            
            # Check second update (to FAILED)
            second_call_args = mock_update.call_args_list[1][1]
            assert second_call_args["obj_in"]["processing_status"] == ProcessingStatus.FAILED

    async def test_process_audio_transcription_error(self, mock_db, mock_media_asset_audio, patch_settings):
        """Test processing audio when transcription fails."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Mock dependencies
        mock_stt_provider = AsyncMock(spec=GoogleSTTProvider)
        mock_stt_provider.transcribe_file.side_effect = Exception("Transcription error")
        
        with patch("app.workers.media_worker.crud_media.get", return_value=mock_media_asset_audio), \
             patch("app.workers.media_worker.crud_media.update") as mock_update, \
             patch("app.workers.media_worker.os.path.exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=b"audio data")), \
             patch.object(MediaWorker, "stt_provider", mock_stt_provider):
            
            # Create worker and process media
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert
            assert result is False
            assert mock_update.call_count == 2  # Called for PROCESSING and FAILED
            
            # Check second update (to FAILED)
            second_call_args = mock_update.call_args_list[1][1]
            assert second_call_args["obj_in"]["processing_status"] == ProcessingStatus.FAILED

    async def test_process_image(self, mock_db, mock_media_asset_image, patch_settings):
        """Test processing image media (currently just logs and returns success)."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Mock dependencies
        with patch("app.workers.media_worker.crud_media.get", return_value=mock_media_asset_image), \
             patch("app.workers.media_worker.crud_media.update") as mock_update:
            
            # Create worker and process media
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert
            assert result is True
            assert mock_update.call_count == 2  # Called for PROCESSING and COMPLETED
            
            # Check second update (to COMPLETED)
            second_call_args = mock_update.call_args_list[1][1]
            assert second_call_args["obj_in"]["processing_status"] == ProcessingStatus.COMPLETED

    async def test_process_media_exception(self, mock_db, mock_media_asset_audio, patch_settings):
        """Test handling of general exceptions during processing."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Mock crud_media.get to raise an exception
        with patch("app.workers.media_worker.crud_media.get", side_effect=Exception("Database error")):
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert
            assert result is False

    async def test_process_media_idempotency(self, mock_db, patch_settings):
        """Test that already processed media is handled correctly (idempotency)."""
        # パッチ適用後にインポート
        from app.workers.media_worker import MediaWorker
        
        # Create a media asset that's already in COMPLETED state
        completed_media = MagicMock(spec=MediaAsset)
        completed_media.id = "test-media-id"
        completed_media.media_type = MediaType.AUDIO
        completed_media.processing_status = ProcessingStatus.COMPLETED
        
        # Mock dependencies
        with patch("app.workers.media_worker.crud_media.get", return_value=completed_media), \
             patch("app.workers.media_worker.crud_media.update") as mock_update:
            
            # Create worker and process media
            worker = MediaWorker(mock_db)
            result = await worker.process_media("test-media-id")
            
            # Assert - should still return success but not process again
            assert result is True
            # Should update status to PROCESSING and then back to COMPLETED
            assert mock_update.call_count == 2


@pytest.mark.asyncio
class TestProcessMediaTask:
    """Test cases for process_media_task function."""

    async def test_process_media_task(self, mock_db, patch_settings):
        """Test the process_media_task function."""
        # パッチ適用後にインポート
        from app.workers.media_worker import process_media_task
        
        # Mock MediaWorker
        mock_worker = AsyncMock()
        mock_worker.process_media.return_value = True
        
        with patch("app.workers.media_worker.MediaWorker", return_value=mock_worker) as mock_worker_class:
            # Call the function
            result = await process_media_task(mock_db, "test-media-id")
            
            # Assert
            mock_worker_class.assert_called_once_with(mock_db)
            mock_worker.process_media.assert_called_once_with("test-media-id")
            assert result is True
