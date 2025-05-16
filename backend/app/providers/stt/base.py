"""
Base class for STT (Speech-to-Text) providers.
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import BinaryIO, Dict, List, Optional, Union

class TranscriptionStatus(str, Enum):
    """Status of a transcription job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionResult:
    """Result of a transcription job."""
    
    def __init__(
        self,
        text: str,
        confidence: float,
        language_code: str,
        segments: Optional[List[Dict]] = None,
        metadata: Optional[Dict] = None,
    ):
        self.text = text
        self.confidence = confidence
        self.language_code = language_code
        self.segments = segments or []
        self.metadata = metadata or {}


class BaseSTTProvider(ABC):
    """Base class for STT providers."""
    
    @abstractmethod
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
        Transcribe an audio file.
        
        Args:
            audio_file: Audio file object (file-like object)
            language_code: Language code (e.g., "ja-JP", "en-US")
            audio_format: Audio format (e.g., "wav", "mp3")
            sample_rate_hertz: Sample rate in hertz
            enable_word_time_offsets: Whether to include word time offsets
            enable_automatic_punctuation: Whether to add punctuation
            model: Model name (provider-specific)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            TranscriptionResult: The transcription result
        """
        pass
    
    @abstractmethod
    async def transcribe_stream(
        self,
        audio_stream,
        language_code: str = "ja-JP",
        sample_rate_hertz: int = 16000,
        interim_results: bool = True,
        **kwargs
    ):
        """
        Transcribe an audio stream in real-time.
        
        Args:
            audio_stream: Audio stream
            language_code: Language code (e.g., "ja-JP", "en-US")
            sample_rate_hertz: Sample rate in hertz
            interim_results: Whether to return interim results
            **kwargs: Additional provider-specific parameters
            
        Returns:
            AsyncGenerator yielding TranscriptionResult
        """
        pass
    
    @abstractmethod
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """
        Get a list of supported languages.
        
        Returns:
            List of dictionaries with language information
            Example: [{"code": "ja-JP", "name": "Japanese (Japan)"}]
        """
        pass
