"""
STT (Speech-to-Text) API endpoints.
"""
import asyncio
import logging
import json
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
if settings.STT_PROVIDER == "google":
    try:
        # Google STTプロバイダー
        stt_provider = GoogleSTTProvider()
        logger.info("Using Google STT Provider")
    except Exception as e:
        # 初期化エラーの場合はモックプロバイダーにフォールバック
        logger.warning(f"Failed to initialize Google STT Provider: {e}. Using Mock STT Provider instead.")
        stt_provider = MockSTTProvider()
else:
    # テスト用モックプロバイダー
    stt_provider = MockSTTProvider()
    logger.info("Using Mock STT Provider for development.")


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
    # 認証チェック（開発環境ではバイパス可能）
    if not settings.BYPASS_AUTH:
        # 本番環境では認証チェックを実装
        # 現在は開発環境のため、認証チェックをスキップ
        pass
    
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
                    # メッセージタイプを確認
                    message = await websocket.receive()
                    
                    # バイナリデータの場合
                    if "bytes" in message:
                        data = message["bytes"]
                        await audio_queue.put(data)
                    # JSONメッセージの場合（終了信号など）
                    elif "text" in message:
                        try:
                            data = json.loads(message["text"])
                            if data.get("type") == "end":
                                logger.info("Received end signal")
                                break
                        except json.JSONDecodeError:
                            logger.warning(f"Invalid JSON message: {message['text']}")
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
            logger.info(f"Starting STT processing with provider: {type(stt_provider).__name__}")
            async for result in stt_provider.transcribe_stream(
                audio_stream=audio_stream(),
                language_code=config.language_code,
                sample_rate_hertz=config.sample_rate_hertz,
                interim_results=config.interim_results,
                enable_automatic_punctuation=config.enable_automatic_punctuation,
                model=config.model,
                phrases=config.phrases if config.phrases else None,
            ):
                logger.info(f"STT result: text='{result.text}', is_final={getattr(result, 'is_final', False)}, confidence={result.confidence}")
                
                # Send the result back to the client
                response_data = {
                    "text": result.text,
                    "confidence": result.confidence,
                    "is_final": getattr(result, 'is_final', False),
                    "stability": getattr(result, 'stability', 1.0),
                    "language": result.language_code
                }
                
                # WebSocket接続状態を確認してから送信
                if websocket.client_state.name == 'CONNECTED':
                    await websocket.send_json(response_data)
                    logger.info(f"Sent STT result to client: {response_data}")
                else:
                    logger.warning(f"WebSocket not connected, cannot send result. State: {websocket.client_state.name}")
                    break
                    
        except Exception as e:
            logger.exception(f"Error in STT processing: {str(e)}")
            error_response = {"error": str(e)}
            try:
                if websocket.client_state.name == 'CONNECTED':
                    await websocket.send_json(error_response)
            except Exception as send_error:
                logger.error(f"Failed to send error response: {send_error}")
        
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
        languages = stt_provider.get_supported_languages()
        return {"languages": languages}
    except Exception as e:
        logger.exception(f"Error getting supported languages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get supported languages: {str(e)}"
        )
