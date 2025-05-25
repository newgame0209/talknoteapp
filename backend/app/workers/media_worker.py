"""
Media worker for processing media files asynchronously.

This worker handles:
1. Speech-to-Text processing for audio files
2. OCR processing for image files
3. Text extraction for PDF files
"""
import asyncio
import logging
import os
from typing import Dict, Optional, Union
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.models.media import MediaAsset, MediaType, ProcessingStatus
from app.models.transcript import Transcript
from app.providers.stt.google import GoogleSTTProvider
from app.services.media import media_asset
from app.services.transcript import crud_transcript

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MediaWorker:
    """Worker for processing media files asynchronously."""
    
    def __init__(self, db: AsyncSession):
        """
        Initialize the media worker.
        
        Args:
            db: Database session
        """
        self.db = db
        self.stt_provider = GoogleSTTProvider(
            credentials_path=settings.GOOGLE_APPLICATION_CREDENTIALS
        )
        
    async def process_media(self, media_id: Union[str, UUID]) -> bool:
        """
        Process a media file based on its type.
        
        Args:
            media_id: ID of the media asset to process
            
        Returns:
            bool: True if processing was successful, False otherwise
        """
        try:
            # Get the media asset from the database
            media = await crud_media.get(self.db, id=media_id)
            if not media:
                logger.error(f"Media asset not found: {media_id}")
                return False
            
            # Update status to processing
            await crud_media.update(
                self.db,
                db_obj=media,
                obj_in={"processing_status": ProcessingStatus.PROCESSING}
            )
            
            # Process based on media type
            success = False
            if media.media_type == MediaType.AUDIO:
                success = await self._process_audio(media)
            elif media.media_type == MediaType.IMAGE:
                # OCR processing will be implemented in the future
                logger.info(f"OCR processing not yet implemented for image: {media_id}")
                success = True
            elif media.media_type == MediaType.PDF:
                # PDF text extraction will be implemented in the future
                logger.info(f"PDF processing not yet implemented for: {media_id}")
                success = True
            elif media.media_type == MediaType.URL:
                # URL content extraction will be implemented in the future
                logger.info(f"URL processing not yet implemented for: {media_id}")
                success = True
            else:
                logger.warning(f"Unsupported media type: {media.media_type}")
                success = False
            
            # Update status based on processing result
            status = ProcessingStatus.COMPLETED if success else ProcessingStatus.FAILED
            await crud_media.update(
                self.db,
                db_obj=media,
                obj_in={"processing_status": status}
            )
            
            return success
        
        except Exception as e:
            logger.exception(f"Error processing media {media_id}: {str(e)}")
            
            # Try to update the status to failed
            try:
                media = await crud_media.get(self.db, id=media_id)
                if media:
                    await crud_media.update(
                        self.db,
                        db_obj=media,
                        obj_in={"processing_status": ProcessingStatus.FAILED}
                    )
            except Exception as update_error:
                logger.error(f"Failed to update media status: {str(update_error)}")
                
            return False
    
    async def _process_audio(self, media: MediaAsset) -> bool:
        """
        Process an audio file using STT.
        
        Args:
            media: Media asset to process
            
        Returns:
            bool: True if processing was successful, False otherwise
        """
        try:
            # Get the file path
            file_path = media.storage_path
            if not os.path.exists(file_path):
                logger.error(f"Audio file not found: {file_path}")
                return False
            
            # Open the file and transcribe
            with open(file_path, "rb") as audio_file:
                # Determine audio format from file extension
                file_ext = os.path.splitext(file_path)[1].lower().replace(".", "")
                audio_format = file_ext if file_ext in ["wav", "mp3", "flac", "ogg"] else "wav"
                
                # Transcribe the audio
                result = await self.stt_provider.transcribe_file(
                    audio_file=audio_file,
                    language_code=media.language or "ja-JP",
                    audio_format=audio_format,
                    enable_word_time_offsets=True
                )
            
            # Create transcript in the database
            transcript_data = {
                "media_asset_id": media.id,
                "text": result.text,
                "provider": "google",
                "confidence": result.confidence,
                "language": result.language_code,
                "metadata": {
                    "segments": result.segments,
                    **result.metadata
                }
            }
            
            await crud_transcript.create(self.db, obj_in=transcript_data)
            logger.info(f"Created transcript for media {media.id}")
            
            return True
            
        except Exception as e:
            logger.exception(f"Error transcribing audio {media.id}: {str(e)}")
            return False


async def process_media_task(db: AsyncSession, media_id: Union[str, UUID]) -> bool:
    """
    Task function to process a media file.
    This can be called by a Pub/Sub handler or other event triggers.
    
    Args:
        db: Database session
        media_id: ID of the media asset to process
        
    Returns:
        bool: True if processing was successful, False otherwise
    """
    worker = MediaWorker(db)
    return await worker.process_media(media_id)
