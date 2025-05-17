"""
STT (Speech-to-Text) API endpoints.
"""
import asyncio
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.core.settings import settings
from app.core.deps import get_current_user
from app.providers.stt.google import GoogleSTTProvider
from app.providers.stt.mock import MockSTTProvider

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 環境変数に基づいてSTTプロバイダーを選択
if settings.STT_ENABLED:
    try:
        # 本番用STTプロバイダー
        stt_provider = GoogleSTTProvider(
            credentials_path=settings.GOOGLE_APPLICATION_CREDENTIALS
        )
        logger.info("Using Google STT Provider")
    except Exception as e:
        # 初期化エラーの場合はモックプロバイダーにフォールバック
        logger.warning(f"Failed to initialize Google STT Provider: {e}. Using Mock STT Provider instead.")
        stt_provider = MockSTTProvider()
else:
    # テスト用モックプロバイダー
    stt_provider = MockSTTProvider()
    logger.info("STT is disabled. Using Mock STT Provider.")


class STTConfig(BaseModel):
    """Configuration for STT processing."""
    language_code: str = "ja-JP"
    sample_rate_hertz: int = 16000
    interim_results: bool = True
    phrases: Optional[List[str]] = None
    enable_automatic_punctuation: bool = True
    model: Optional[str] = None


@router.websocket("/stream")
async def stt_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time speech-to-text.
    
    The client should:
    1. Connect to this WebSocket
    2. Send a JSON config message first
    3. Then send binary audio data in chunks
    4. Receive JSON transcription results
    """
    await websocket.accept()
    
    try:
        # First message should be the configuration
        config_data = await websocket.receive_json()
        config = STTConfig(**config_data)
        
        logger.info(f"STT WebSocket connected with config: {config}")
        
        # Create an async queue for audio chunks
        audio_queue = asyncio.Queue()
        
        # Task to receive audio chunks from the client
        async def receive_audio():
            try:
                while True:
                    # Receive binary data from the client
                    data = await websocket.receive_bytes()
                    await audio_queue.put(data)
            except WebSocketDisconnect:
                logger.info("Client disconnected")
            except Exception as e:
                logger.exception(f"Error receiving audio: {str(e)}")
            finally:
                # Signal the end of the stream
                await audio_queue.put(None)
        
        # Start the receiving task
        receive_task = asyncio.create_task(receive_audio())
        
        # Audio stream generator that yields chunks from the queue
        async def audio_stream():
            while True:
                chunk = await audio_queue.get()
                if chunk is None:  # End of stream
                    break
                yield chunk
        
        # Process the audio stream
        try:
            async for result in stt_provider.transcribe_stream(
                audio_stream=audio_stream(),
                language_code=config.language_code,
                sample_rate_hertz=config.sample_rate_hertz,
                interim_results=config.interim_results,
                phrases=config.phrases,
                enable_automatic_punctuation=config.enable_automatic_punctuation,
                model=config.model,
            ):
                # Send the result back to the client
                await websocket.send_json({
                    "text": result.text,
                    "confidence": result.confidence,
                    "is_final": result.metadata.get("is_final", False),
                    "stability": result.metadata.get("stability", 1.0),
                    "segments": result.segments
                })
        except Exception as e:
            logger.exception(f"Error in STT processing: {str(e)}")
            await websocket.send_json({
                "error": str(e)
            })
        
        # Wait for the receive task to complete
        await receive_task
        
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.exception(f"Error in STT WebSocket: {str(e)}")
        try:
            await websocket.send_json({
                "error": str(e)
            })
        except:
            pass
    finally:
        # Ensure the WebSocket is closed
        try:
            await websocket.close()
        except:
            pass


@router.get("/languages")
async def get_supported_languages():
    """
    Get a list of languages supported by the STT provider.
    
    Returns:
        List of language objects with code and name
    """
    try:
        languages = await stt_provider.get_supported_languages()
        return {"languages": languages}
    except Exception as e:
        logger.exception(f"Error getting supported languages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get supported languages: {str(e)}"
        )
