"""
Google Cloud Speech-to-Text provider implementation.
"""
import asyncio
import io
from typing import AsyncGenerator, BinaryIO, Dict, List, Optional, Union

from google.cloud import speech_v1p1beta1 as speech
from google.cloud.speech_v1p1beta1 import RecognitionConfig, SpeechContext
from google.api_core.exceptions import GoogleAPIError

from .base import BaseSTTProvider, TranscriptionResult, TranscriptionStatus


class GoogleSTTProvider(BaseSTTProvider):
    """Google Cloud Speech-to-Text provider."""
    
    def __init__(self, credentials_path: Optional[str] = None):
        """
        Initialize the Google STT provider.
        
        Args:
            credentials_path: Path to Google Cloud credentials JSON file.
                              If None, uses default credentials.
        """
        self.client = speech.SpeechClient.from_service_account_json(credentials_path) if credentials_path else speech.SpeechClient()
        
    async def transcribe_file(
        self,
        audio_file: BinaryIO,
        language_code: str = "ja-JP",
        audio_format: str = "wav",
        sample_rate_hertz: int = 16000,
        enable_word_time_offsets: bool = False,
        enable_automatic_punctuation: bool = True,
        model: Optional[str] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe an audio file using Google Cloud Speech-to-Text.
        
        Args:
            audio_file: Audio file object (file-like object)
            language_code: Language code (e.g., "ja-JP", "en-US")
            audio_format: Audio format (e.g., "wav", "mp3")
            sample_rate_hertz: Sample rate in hertz
            enable_word_time_offsets: Whether to include word time offsets
            enable_automatic_punctuation: Whether to add punctuation
            model: Model name (e.g., "default", "phone_call", "video")
            **kwargs: Additional parameters
                - phrases: List of phrases to boost recognition
                - profanity_filter: Whether to filter profanity
                - max_alternatives: Maximum number of alternatives to return
                
        Returns:
            TranscriptionResult: The transcription result
        """
        try:
            # Read the audio file content
            content = audio_file.read()
            
            # Configure audio
            audio = speech.RecognitionAudio(content=content)
            
            # Configure recognition
            config = speech.RecognitionConfig(
                encoding=self._get_encoding_from_format(audio_format),
                sample_rate_hertz=sample_rate_hertz,
                language_code=language_code,
                enable_word_time_offsets=enable_word_time_offsets,
                enable_automatic_punctuation=enable_automatic_punctuation,
                model=model or "default",
                profanity_filter=kwargs.get("profanity_filter", False),
                max_alternatives=kwargs.get("max_alternatives", 1),
            )
            
            # Add speech context if phrases are provided
            if "phrases" in kwargs and kwargs["phrases"]:
                config.speech_contexts = [SpeechContext(phrases=kwargs["phrases"])]
            
            # Run in an executor to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: self.client.recognize(config=config, audio=audio)
            )
            
            # Process the response
            if not response.results:
                return TranscriptionResult(
                    text="",
                    confidence=0.0,
                    language_code=language_code,
                )
            
            result = response.results[0]
            alternative = result.alternatives[0]
            
            # Extract word-level timing information if available
            segments = []
            if enable_word_time_offsets and hasattr(alternative, "words") and alternative.words:
                for word in alternative.words:
                    segments.append({
                        "word": word.word,
                        "start_time": word.start_time.total_seconds(),
                        "end_time": word.end_time.total_seconds(),
                        "confidence": alternative.confidence
                    })
            
            return TranscriptionResult(
                text=alternative.transcript,
                confidence=alternative.confidence,
                language_code=language_code,
                segments=segments,
                metadata={"provider": "google", "model": model or "default"}
            )
            
        except GoogleAPIError as e:
            # Log the error and return an empty result
            print(f"Google STT API error: {str(e)}")
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language_code=language_code,
                metadata={"error": str(e), "provider": "google"}
            )
    
    async def transcribe_stream(
        self,
        audio_stream,
        language_code: str = "ja-JP",
        sample_rate_hertz: int = 16000,
        interim_results: bool = True,
        **kwargs
    ) -> AsyncGenerator[TranscriptionResult, None]:
        """
        Transcribe an audio stream in real-time using Google Cloud Speech-to-Text.
        
        Args:
            audio_stream: Audio stream
            language_code: Language code (e.g., "ja-JP", "en-US")
            sample_rate_hertz: Sample rate in hertz
            interim_results: Whether to return interim results
            **kwargs: Additional parameters
                - phrases: List of phrases to boost recognition
                - profanity_filter: Whether to filter profanity
                
        Yields:
            TranscriptionResult objects as they become available
        """
        # Configure streaming recognition
        config = speech.StreamingRecognitionConfig(
            config=speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=sample_rate_hertz,
                language_code=language_code,
                enable_automatic_punctuation=kwargs.get("enable_automatic_punctuation", True),
                model=kwargs.get("model", "default"),
                profanity_filter=kwargs.get("profanity_filter", False),
            ),
            interim_results=interim_results,
        )
        
        # Add speech context if phrases are provided
        if "phrases" in kwargs and kwargs["phrases"]:
            config.config.speech_contexts = [SpeechContext(phrases=kwargs["phrases"])]
        
        # 音声データを処理するためのキュー
        audio_queue = asyncio.Queue()
        
        # 音声ストリームからデータを読み込むタスク
        async def read_audio_stream():
            try:
                async for chunk in audio_stream:
                    await audio_queue.put(chunk)
            except Exception as e:
                print(f"Error reading audio stream: {e}")
            finally:
                await audio_queue.put(None)  # 終了信号
        
        # 音声データを読み込むタスクを開始
        read_task = asyncio.create_task(read_audio_stream())
        
        # リクエストイテレータ
        def request_iterator():
            # 最初のリクエストは設定のみ
            yield speech.StreamingRecognizeRequest(streaming_config=config)
            
            # 以降のリクエストは音声データ
            while True:
                chunk = asyncio.run_coroutine_threadsafe(audio_queue.get(), asyncio.get_event_loop()).result()
                if chunk is None:  # 終了信号
                    break
                yield speech.StreamingRecognizeRequest(audio_content=chunk)
        
        try:
            # ストリーミング認識を開始
            streaming_recognize = self.client.streaming_recognize(
                config=config,
                requests=request_iterator()
            )
            
            # レスポンスを処理
            async for response in streaming_recognize:
                if not response.results:
                    continue
                
                for result in response.results:
                    if not result.alternatives:
                        continue
                    
                    alternative = result.alternatives[0]
                    is_final = result.is_final
                    
                    # 単語レベルのタイミング情報を抽出
                    segments = []
                    if hasattr(alternative, "words") and alternative.words:
                        for word in alternative.words:
                            segments.append({
                                "word": word.word,
                                "start_time": word.start_time.total_seconds(),
                                "end_time": word.end_time.total_seconds(),
                                "confidence": alternative.confidence if hasattr(alternative, "confidence") else 0.0
                            })
                    
                    yield TranscriptionResult(
                        text=alternative.transcript,
                        confidence=alternative.confidence if hasattr(alternative, "confidence") else 0.0,
                        language_code=language_code,
                        segments=segments,
                        metadata={
                            "provider": "google",
                            "is_final": is_final,
                            "stability": result.stability if hasattr(result, "stability") else 1.0
                        }
                    )
        except GoogleAPIError as e:
            print(f"Google STT streaming API error: {str(e)}")
            yield TranscriptionResult(
                text="",
                confidence=0.0,
                language_code=language_code,
                metadata={"error": str(e), "provider": "google"}
            )
        finally:
            # 読み込みタスクをキャンセル
            read_task.cancel()
            try:
                await read_task
            except asyncio.CancelledError:
                pass
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """
        Get a list of supported languages from Google Cloud Speech-to-Text.
        
        Returns:
            List of dictionaries with language information
            Example: [{"code": "ja-JP", "name": "Japanese (Japan)"}]
        """
        try:
            # Run in an executor to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: self.client.list_languages()
            )
            
            languages = []
            for language in response.languages:
                languages.append({
                    "code": language.language_code,
                    "name": language.name
                })
            
            return languages
        except GoogleAPIError as e:
            print(f"Google STT API error when listing languages: {str(e)}")
            return []
    
    def _get_encoding_from_format(self, audio_format: str) -> speech.RecognitionConfig.AudioEncoding:
        """
        Convert audio format string to Google Cloud Speech encoding enum.
        
        Args:
            audio_format: Audio format string (e.g., "wav", "mp3")
            
        Returns:
            RecognitionConfig.AudioEncoding enum value
        """
        format_map = {
            "wav": speech.RecognitionConfig.AudioEncoding.LINEAR16,
            "mp3": speech.RecognitionConfig.AudioEncoding.MP3,
            "flac": speech.RecognitionConfig.AudioEncoding.FLAC,
            "ogg": speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
        }
        
        return format_map.get(audio_format.lower(), speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED)
