"""
Gemini TTS Provider implementation.
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import base64
import time
import aiohttp

from app.core.settings import settings
from .base import BaseTTSProvider, SynthesisResult, VoiceInfo, SentenceTimestamp

logger = logging.getLogger(__name__)


class GeminiTTSProvider(BaseTTSProvider):
    """Gemini TTS Provider for speech synthesis."""
    
    def __init__(self):
        self.default_language = "ja-JP"
        self.api_key = settings.GEMINI_TTS_API_KEY
        self.endpoint = settings.GEMINI_TTS_ENDPOINT
        
        if not self.api_key:
            logger.warning("Gemini TTS API key not configured")
        else:
            logger.info("Gemini TTS provider initialized")
    
    async def synthesize(
        self,
        text: str,
        voice_id: str = "ja-JP-Standard-A",
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "mp3",
        sample_rate_hertz: int = 22050,
        **kwargs
    ) -> SynthesisResult:
        """
        Synthesize text using Gemini TTS API.
        """
        if not self.api_key:
            raise RuntimeError("Gemini TTS API key not configured")
        
        try:
            # Gemini TTS API request payload
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": language_code,
                    "name": voice_id
                },
                "audioConfig": {
                    "audioEncoding": "MP3" if audio_format.lower() == "mp3" else "LINEAR16",
                    "speakingRate": max(0.25, min(4.0, speaking_rate)),
                    "pitch": max(-20.0, min(20.0, pitch)),
                    "volumeGainDb": max(-96.0, min(16.0, volume_gain_db)),
                    "sampleRateHertz": sample_rate_hertz
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            start_time = time.time()
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.endpoint,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise RuntimeError(f"Gemini TTS API error {response.status}: {error_text}")
                    
                    result_data = await response.json()
            
            processing_time = time.time() - start_time
            
            # Extract audio data
            audio_content = base64.b64decode(result_data.get("audioContent", ""))
            
            if not audio_content:
                raise RuntimeError("No audio content received from Gemini TTS")
            
            # Generate sentence timestamps (simplified)
            sentences = self._generate_sentence_timestamps(text, processing_time)
            
            return SynthesisResult(
                audio_data=audio_content,
                audio_format=audio_format,
                sample_rate=sample_rate_hertz,
                duration=len(audio_content) / (sample_rate_hertz * 2),  # Rough estimate
                voice_id=voice_id,
                language_code=language_code,
                sentences=sentences,
                metadata={
                    "provider": "gemini",
                    "processing_time": processing_time,
                    "voice_name": voice_id,
                    "text_length": len(text)
                }
            )
            
        except Exception as e:
            logger.error(f"Gemini TTS synthesis failed: {e}")
            raise
    
    async def get_available_voices(
        self,
        language_code: Optional[str] = None
    ) -> List[VoiceInfo]:
        """
        Get available voices for Gemini TTS.
        """
        # Gemini TTS standard voices for Japanese
        voices = [
            VoiceInfo(
                id="ja-JP-Standard-A",
                name="Japanese Standard A (Female)",
                language_code="ja-JP",
                gender="female",
                provider="gemini"
            ),
            VoiceInfo(
                id="ja-JP-Standard-B",
                name="Japanese Standard B (Female)",
                language_code="ja-JP",
                gender="female",
                provider="gemini"
            ),
            VoiceInfo(
                id="ja-JP-Standard-C",
                name="Japanese Standard C (Male)",
                language_code="ja-JP",
                gender="male",
                provider="gemini"
            ),
            VoiceInfo(
                id="ja-JP-Standard-D",
                name="Japanese Standard D (Male)",
                language_code="ja-JP",
                gender="male",
                provider="gemini"
            ),
        ]
        
        if language_code:
            voices = [v for v in voices if v.language_code == language_code]
        
        return voices
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """
        Get supported languages for Gemini TTS.
        """
        return [
            {"code": "ja-JP", "name": "Japanese (Japan)"},
            {"code": "en-US", "name": "English (United States)"},
        ]
    
    def _generate_sentence_timestamps(self, text: str, total_duration: float) -> List[SentenceTimestamp]:
        """
        Generate approximate sentence timestamps.
        """
        sentences = [s.strip() for s in text.split('。') if s.strip()]
        if not sentences:
            return []
        
        timestamps = []
        time_per_sentence = total_duration / len(sentences)
        
        for i, sentence in enumerate(sentences):
            start_time = i * time_per_sentence
            end_time = (i + 1) * time_per_sentence
            
            timestamps.append(SentenceTimestamp(
                text=sentence + ('。' if i < len(sentences) - 1 else ''),
                start_time=start_time,
                end_time=end_time
            ))
        
        return timestamps 