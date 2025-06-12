"""
Base class for TTS (Text-to-Speech) providers.
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Optional, Union, BinaryIO
from dataclasses import dataclass


class SynthesisStatus(str, Enum):
    """Status of a synthesis job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class VoiceInfo:
    """Information about a voice."""
    voice_id: str
    name: str
    language_code: str
    gender: str  # "male", "female", "neutral"
    description: Optional[str] = None
    sample_rate_hertz: Optional[int] = None
    metadata: Optional[Dict] = None


@dataclass
class SentenceTimestamp:
    """Timestamp information for a sentence."""
    text: str
    start_time: float  # seconds
    end_time: float    # seconds
    confidence: Optional[float] = None


class SynthesisResult:
    """Result of a text-to-speech synthesis job."""
    
    def __init__(
        self,
        audio_data: bytes,
        audio_format: str,
        sample_rate_hertz: int,
        duration_seconds: float,
        text: str,
        voice_info: VoiceInfo,
        sentences: Optional[List[SentenceTimestamp]] = None,
        metadata: Optional[Dict] = None,
    ):
        self.audio_data = audio_data
        self.audio_format = audio_format
        self.sample_rate_hertz = sample_rate_hertz
        self.duration_seconds = duration_seconds
        self.text = text
        self.voice_info = voice_info
        self.sentences = sentences or []
        self.metadata = metadata or {}


class BaseTTSProvider(ABC):
    """Base class for TTS providers."""
    
    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_id: str = "default",
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "wav",
        sample_rate_hertz: int = 22050,
        **kwargs
    ) -> SynthesisResult:
        """
        Synthesize text to speech.
        
        Args:
            text: Text to synthesize
            voice_id: Voice identifier (provider-specific)
            language_code: Language code (e.g., "ja-JP", "en-US")
            speaking_rate: Speaking rate (0.25-4.0, 1.0 = normal)
            pitch: Pitch adjustment (-20.0 to 20.0, 0.0 = no change)
            volume_gain_db: Volume gain in dB (-96.0 to 16.0)
            audio_format: Output audio format ("wav", "mp3", "ogg")
            sample_rate_hertz: Sample rate in hertz
            **kwargs: Additional provider-specific parameters
            
        Returns:
            SynthesisResult: The synthesis result with audio data
        """
        pass
    
    @abstractmethod
    async def get_available_voices(
        self,
        language_code: Optional[str] = None
    ) -> List[VoiceInfo]:
        """
        Get a list of available voices.
        
        Args:
            language_code: Filter by language code (optional)
            
        Returns:
            List of VoiceInfo objects
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
    
    async def validate_text(self, text: str) -> bool:
        """
        Validate if the text can be synthesized.
        
        Args:
            text: Text to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not text or not text.strip():
            return False
        
        # Check for maximum length (can be overridden by providers)
        if len(text) > 5000:  # 5000 characters default limit
            return False
            
        return True
    
    def split_text_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences for processing.
        
        Args:
            text: Text to split
            
        Returns:
            List of sentence strings
        """
        import re
        
        # Simple sentence splitting for Japanese and English
        # Splits on periods, exclamation marks, and question marks
        sentences = re.split(r'[。！？\.!?]+', text)
        
        # Clean up and filter empty sentences
        sentences = [s.strip() for s in sentences if s.strip()]
        
        return sentences
    
    async def estimate_duration(self, text: str, speaking_rate: float = 1.0) -> float:
        """
        Estimate the duration of synthesized speech.
        
        Args:
            text: Text to synthesize
            speaking_rate: Speaking rate
            
        Returns:
            Estimated duration in seconds
        """
        # Rough estimation: ~150 characters per minute for Japanese
        # ~200 words per minute for English (average 5 chars per word = 1000 chars per minute)
        chars_per_minute = 150 if "ja" in getattr(self, 'default_language', 'ja-JP') else 1000
        
        duration_minutes = len(text) / chars_per_minute
        duration_seconds = (duration_minutes * 60) / speaking_rate
        
        return max(1.0, duration_seconds)  # Minimum 1 second 