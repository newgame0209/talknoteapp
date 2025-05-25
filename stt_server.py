"""
STT WebSocket サーバー - 単独実行版
Google STT APIを使用した音声認識サーバー
"""
import asyncio
import logging
import os
import json
from typing import Dict, List, Optional

from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pydantic import BaseModel

load_dotenv() # Call load_dotenv() early

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__) # Initialize logger

# FastAPIアプリケーション
app = FastAPI(title="STT WebSocket Server") # Initialize app

# Google Cloud Speech-to-Text SDKをインポート
from google.auth.exceptions import DefaultCredentialsError
try:
    # For initial availability check, we can use the sync client briefly
    from google.cloud import speech_v1p1beta1 as speech_sync
    # For actual async operations
    from google.cloud.speech_v1p1beta1.services.speech.async_client import SpeechAsyncClient
    from google.cloud.speech_v1p1beta1.types import RecognitionConfig, StreamingRecognitionConfig, StreamingRecognizeRequest, SpeechContext

    try:
        # This check can remain synchronous for simplicity, or also be async.
        # It's just to set a flag.
        _ = speech_sync.SpeechClient() # Check if credentials load
        GOOGLE_STT_AVAILABLE = True
        logger.info("Google Cloud Speech-to-Text SDK is available and credentials likely found (via env or .env).")
    except DefaultCredentialsError:
        logger.warning("Google Cloud Default Credentials NOT found (even after trying .env). Falling back to mock STT.")
        GOOGLE_STT_AVAILABLE = False
except ImportError:
    logger.warning("Google Cloud Speech-to-Text SDK not found. Falling back to mock STT.")
    GOOGLE_STT_AVAILABLE = False


class STTConfig(BaseModel):
    """Configuration for STT processing."""
    language_code: str = "ja-JP"
    sample_rate_hertz: int = 16000
    interim_results: bool = True
    phrases: Optional[List[str]] = None
    enable_automatic_punctuation: bool = True
    model: Optional[str] = None


async def mock_recognize_stream(websocket: WebSocket):
    # Simulate receiving audio data and sending back mock transcriptions
    print("Using mock STT provider.")
    try:
        while True:
            # Simulate receiving audio data (though we don't process it in mock)
            _ = await websocket.receive_bytes() 
            # Send a mock transcription
            mock_transcription = {
                "transcript": "これはモックの文字起こし結果です。",
                "is_final": True,
                "stability": 0.9
            }
            await websocket.send_json(mock_transcription)
            # Simulate some processing delay
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Client disconnected from mock STT")
    except Exception as e:
        print(f"Error in mock STT: {e}")


@app.websocket("/api/v1/stt/stream")
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
    logger.info("WebSocket connection accepted")
    
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
        if GOOGLE_STT_AVAILABLE:
            # Google STTを使用した実際の音声認識
            client = SpeechAsyncClient() # Use Async Client
            
            # Configure streaming recognition
            # Types are now directly imported (e.g., RecognitionConfig instead of speech.RecognitionConfig)
            streaming_config_obj = StreamingRecognitionConfig(
                config=RecognitionConfig(
                    encoding=RecognitionConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=config.sample_rate_hertz,
                    language_code=config.language_code,
                    enable_automatic_punctuation=config.enable_automatic_punctuation,
                    model=config.model or "default", # Ensure model is not None
                ),
                interim_results=config.interim_results,
            )
            
            # Add speech context if phrases are provided
            if config.phrases:
                streaming_config_obj.config.speech_contexts = [SpeechContext(phrases=config.phrases)]
            
            # Create a generator that yields audio chunks
            async def requests_generator():
                # First request must contain only the config
                yield StreamingRecognizeRequest(streaming_config=streaming_config_obj)
                
                # Subsequent requests contain audio data
                async for chunk in audio_stream():
                    yield StreamingRecognizeRequest(audio_content=chunk)
            
            logger.info("Starting Google STT streaming recognize...")
            logger.info("Attempting to call client.streaming_recognize...")
            responses = await client.streaming_recognize(requests=requests_generator())
            logger.info("client.streaming_recognize call completed. Iterating responses...")

            # Process responses asynchronously
            response_received_from_google = False
            async for response in responses:
                response_received_from_google = True
                logger.info(f"Raw response from Google STT: {response}")
                if not response.results:
                    logger.info("Google STT response has no results, skipping.")
                    continue
                
                for result in response.results:
                    if not result.alternatives:
                        logger.info("Google STT result has no alternatives, skipping.")
                        continue
                    
                    alternative = result.alternatives[0]
                    is_final = result.is_final
                    
                    # Check WebSocket state before sending
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "text": alternative.transcript,
                            "confidence": alternative.confidence if hasattr(alternative, "confidence") else 0.0,
                            "is_final": is_final,
                            "stability": result.stability if hasattr(result, "stability") else 1.0
                        })
                        logger.info(f"Sent transcription to client: {alternative.transcript}")
                    else:
                        logger.warning("WebSocket no longer connected, cannot send transcription.")
            if not response_received_from_google:
                logger.warning("No responses received from Google STT stream.")
            else:
                logger.info("Finished processing Google STT responses.")
        else:
            # モック応答を使用したテスト用実装
            await mock_recognize_stream(websocket)
        
        # Wait for the receive task to complete
        await receive_task
        
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.exception(f"Error in STT WebSocket: {str(e)}")
        try:
            # Check WebSocket state before sending error
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json({
                    "error": str(e)
                })
                logger.info(f"Sent error to client: {str(e)}")
            else:
                logger.warning("WebSocket no longer connected, cannot send error message.")
        except Exception as send_err: # Catch error during sending error
            logger.error(f"Failed to send error to client: {send_err}")
    finally:
        # Ensure the WebSocket is closed
        try:
            await websocket.close()
        except:
            pass


@app.get("/")
async def root():
    """Root endpoint for health check"""
    return {
        "status": "ok",
        "message": "STT WebSocket Server is running",
        "google_stt_available": GOOGLE_STT_AVAILABLE
    }


if __name__ == "__main__":
    # Check if GOOGLE_APPLICATION_CREDENTIALS is set
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path:
        logger.info(f"Using Google credentials from: {credentials_path}")
    else:
        logger.warning("GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. STT will use mock responses.")
    
    # Run the server
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
