"""
Google Cloud TTS Provider implementation.
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import base64
import time

try:
    from google.cloud import texttospeech
    from google.api_core import exceptions as gcp_exceptions
    GOOGLE_TTS_AVAILABLE = True
except ImportError:
    GOOGLE_TTS_AVAILABLE = False
    logger.warning("Google Cloud TTS client not available")

from app.core.settings import settings
from .base import BaseTTSProvider, SynthesisResult, VoiceInfo, SentenceTimestamp

logger = logging.getLogger(__name__)


class GoogleTTSProvider(BaseTTSProvider):
    """Google Cloud TTS Provider for reliable speech synthesis."""
    
    def __init__(self):
        self.default_language = "ja-JP"
        self.client = None
        
        if GOOGLE_TTS_AVAILABLE:
            try:
                self.client = texttospeech.TextToSpeechClient()
                logger.info("Google Cloud TTS client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Google TTS client: {e}")
        else:
            logger.warning("Google Cloud TTS not available - install google-cloud-texttospeech")
        
        # Google TTS日本語音声の定義
        self.japanese_voices = {
            "ja-JP-Neural2-B": {
                "voice_id": "ja-JP-Neural2-B",
                "name": "Neural2-B（女性）",
                "language_code": "ja-JP", 
                "gender": "female",
                "description": "自然で流暢な女性の声（Neural2）",
                "sample_rate_hertz": 24000,
            },
            "ja-JP-Neural2-C": {
                "voice_id": "ja-JP-Neural2-C",
                "name": "Neural2-C（男性）",
                "language_code": "ja-JP",
                "gender": "male", 
                "description": "落ち着いた男性の声（Neural2）",
                "sample_rate_hertz": 24000,
            },
            "ja-JP-Wavenet-A": {
                "voice_id": "ja-JP-Wavenet-A",
                "name": "Wavenet-A（女性）",
                "language_code": "ja-JP",
                "gender": "female",
                "description": "高品質な女性の声（Wavenet）",
                "sample_rate_hertz": 22050,
            },
            "ja-JP-Wavenet-C": {
                "voice_id": "ja-JP-Wavenet-C", 
                "name": "Wavenet-C（男性）",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "高品質な男性の声（Wavenet）",
                "sample_rate_hertz": 22050,
            },
        }
    
    async def synthesize(
        self,
        text: str,
        voice_id: str = "ja-JP-Neural2-B",
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "wav",
        sample_rate_hertz: int = 24000,
        **kwargs
    ) -> SynthesisResult:
        """
        Google Cloud TTS APIを使用してテキストを音声合成します。
        
        Args:
            text: 合成するテキスト
            voice_id: 音声ID（ja-JP-Neural2-B, ja-JP-Neural2-C, 等）
            language_code: 言語コード（ja-JP）
            speaking_rate: 話速（0.25-4.0）
            pitch: ピッチ調整（-20.0 to 20.0 semitones）
            volume_gain_db: 音量調整（-96.0 to 16.0 dB）
            audio_format: 出力形式（wav, mp3）
            sample_rate_hertz: サンプルレート
            
        Returns:
            SynthesisResult: 合成結果
        """
        if not self.client:
            raise ValueError("Google Cloud TTS client not available")
        
        # テキスト検証
        if not await self.validate_text(text):
            raise ValueError(f"Invalid text for synthesis: {text[:50]}...")
        
        # 音声設定の調整
        if voice_id not in self.japanese_voices:
            logger.warning(f"Unknown voice_id: {voice_id}, using default ja-JP-Neural2-B")
            voice_id = "ja-JP-Neural2-B"
        
        voice_info = VoiceInfo(**self.japanese_voices[voice_id])
        
        try:
            # Google Cloud TTS APIリクエスト
            audio_data = await self._call_google_tts_api(
                text=text,
                voice_id=voice_id,
                language_code=language_code,
                speaking_rate=speaking_rate,
                pitch=pitch,
                volume_gain_db=volume_gain_db,
                audio_format=audio_format,
                sample_rate_hertz=sample_rate_hertz
            )
            
            # 文章分割とタイムスタンプ生成
            sentences = self.split_text_into_sentences(text)
            duration = await self.estimate_duration(text, speaking_rate)
            sentence_timestamps = self._generate_sentence_timestamps(sentences, duration)
            
            return SynthesisResult(
                audio_data=audio_data,
                audio_format=audio_format,
                sample_rate_hertz=sample_rate_hertz,
                duration_seconds=duration,
                text=text,
                voice_info=voice_info,
                sentences=sentence_timestamps,
                metadata={
                    "provider": "google",
                    "voice_id": voice_id,
                    "language_code": language_code,
                    "speaking_rate": speaking_rate,
                    "pitch": pitch,
                    "volume_gain_db": volume_gain_db,
                    "api_version": "v1",
                    "generated_at": time.time()
                }
            )
            
        except Exception as e:
            logger.error(f"Google TTS synthesis failed: {e}")
            raise RuntimeError(f"Failed to synthesize with Google TTS: {str(e)}")
    
    async def _call_google_tts_api(
        self,
        text: str,
        voice_id: str,
        language_code: str,
        speaking_rate: float,
        pitch: float,
        volume_gain_db: float,
        audio_format: str,
        sample_rate_hertz: int
    ) -> bytes:
        """Google Cloud TTS APIを呼び出します。"""
        
        # テキスト入力設定
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # 音声設定
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_id
        )
        
        # オーディオ設定
        if audio_format.lower() == "wav":
            audio_encoding = texttospeech.AudioEncoding.LINEAR16
        elif audio_format.lower() == "mp3":
            audio_encoding = texttospeech.AudioEncoding.MP3
        else:
            audio_encoding = texttospeech.AudioEncoding.LINEAR16
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=audio_encoding,
            sample_rate_hertz=sample_rate_hertz,
            speaking_rate=max(0.25, min(4.0, speaking_rate)),  # Google TTS範囲
            pitch=max(-20.0, min(20.0, pitch)),  # semitone単位
            volume_gain_db=max(-96.0, min(16.0, volume_gain_db))  # dB単位
        )
        
        try:
            logger.info(f"Calling Google TTS API for {len(text)} characters")
            
            # 同期APIを非同期で実行
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self.client.synthesize_speech,
                {
                    "input": synthesis_input,
                    "voice": voice,
                    "audio_config": audio_config
                }
            )
            
            return response.audio_content
            
        except gcp_exceptions.GoogleAPIError as e:
            raise RuntimeError(f"Google TTS API error: {e}")
        except Exception as e:
            raise RuntimeError(f"Google TTS request failed: {e}")
    
    def _generate_sentence_timestamps(
        self, 
        sentences: List[str], 
        total_duration: float
    ) -> List[SentenceTimestamp]:
        """文章の時間スタンプを生成します。"""
        if not sentences:
            return []
        
        timestamps = []
        current_time = 0.0
        
        # 各文章の長さに基づいて時間を配分
        total_chars = sum(len(s) for s in sentences)
        
        for i, sentence in enumerate(sentences):
            # 文章の文字数比例で時間を計算
            sentence_duration = (len(sentence) / total_chars) * total_duration
            end_time = current_time + sentence_duration
            
            timestamps.append(SentenceTimestamp(
                text=sentence,
                start_time=current_time,
                end_time=end_time,
                confidence=0.98  # Google TTSは最高品質
            ))
            
            current_time = end_time
        
        return timestamps
    
    async def get_available_voices(
        self, 
        language_code: Optional[str] = None
    ) -> List[VoiceInfo]:
        """利用可能な音声一覧を取得します。"""
        voices = []
        
        for voice_data in self.japanese_voices.values():
            if language_code is None or voice_data["language_code"] == language_code:
                voices.append(VoiceInfo(**voice_data))
        
        return voices
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """サポートする言語一覧を取得します。"""
        return [
            {
                "code": "ja-JP",
                "name": "Japanese (Japan)",
                "native_name": "日本語"
            },
            {
                "code": "en-US",
                "name": "English (United States)",
                "native_name": "English"
            }
        ]
    
    async def validate_text(self, text: str) -> bool:
        """Google TTS固有のテキスト検証を行います。"""
        # 基本検証
        if not await super().validate_text(text):
            return False
        
        # Google TTS固有の制限
        if len(text) > 5000:  # Google TTSの文字数制限
            return False
        
        return True
    
    async def estimate_duration(self, text: str, speaking_rate: float = 1.0) -> float:
        """Google TTS音声の時間を推定します。"""
        char_count = len(text)
        
        # 日本語の平均読み上げ速度: 約280文字/分（Google TTSは高品質で少し早め）
        base_duration_minutes = char_count / 280
        duration_seconds = (base_duration_minutes * 60) / speaking_rate
        
        # 最小1秒、最大30分の制限
        return max(1.0, min(1800.0, duration_seconds)) 