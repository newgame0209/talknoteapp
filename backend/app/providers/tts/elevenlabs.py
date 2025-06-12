"""
ElevenLabs TTS Provider implementation.
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import httpx
import time

from app.core.settings import settings
from .base import BaseTTSProvider, SynthesisResult, VoiceInfo, SentenceTimestamp

logger = logging.getLogger(__name__)


class ElevenLabsTTSProvider(BaseTTSProvider):
    """ElevenLabs TTS Provider for high-quality multilingual speech synthesis."""
    
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.base_url = settings.ELEVENLABS_BASE_URL
        self.default_language = "ja-JP"
        
        if not self.api_key:
            logger.warning("ElevenLabs API key not configured")
        
        # ElevenLabs用の音声ID定義（日本語特化音声）
        self.available_voices = {
            # 男性音声
            "JapaneseMan1": {
                "voice_id": "V3XiX7JWJpn959SS60pv",
                "name": "日本人男性1",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "自然な日本人男性の声",
                "sample_rate_hertz": 22050,
            },
            "JapaneseMan2": {
                "voice_id": "3JDquces8E8bkmvbh6Bc",
                "name": "日本人男性2",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "落ち着いた日本人男性の声",
                "sample_rate_hertz": 22050,
            },
            "JapaneseMan3": {
                "voice_id": "MlgbiBnm4o8N3DaDzblH",
                "name": "日本人男性3",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "明瞭な日本人男性の声",
                "sample_rate_hertz": 22050,
            },
            "JapaneseMan4": {
                "voice_id": "bqpOyYNUu11tjjvRUbKn",
                "name": "日本人男性4",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "若々しい日本人男性の声",
                "sample_rate_hertz": 22050,
            },
            "JapaneseMan5": {
                "voice_id": "GxxMAMfQkDlnqjpzjLHH",
                "name": "日本人男性5",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "深みのある日本人男性の声",
                "sample_rate_hertz": 22050,
            },
            # 女性音声
            "JapaneseWoman1": {
                "voice_id": "8EkOjt4xTPGMclNlh1pk",
                "name": "日本人女性1",
                "language_code": "ja-JP",
                "gender": "female",
                "description": "自然な日本人女性の声",
                "sample_rate_hertz": 22050,
            },
            "JapaneseWoman2": {
                "voice_id": "RBnMinrYKeccY3vaUxlZ",
                "name": "日本人女性2",
                "language_code": "ja-JP",
                "gender": "female",
                "description": "明るい日本人女性の声",
                "sample_rate_hertz": 22050,
            },
        }
    
    async def synthesize(
        self,
        text: str,
        voice_id: str = "JapaneseWoman1",
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "wav",
        sample_rate_hertz: int = 22050,
        **kwargs
    ) -> SynthesisResult:
        """
        ElevenLabs APIを使用してテキストを音声合成します。
        
        Args:
            text: 合成するテキスト
            voice_id: 音声ID（JapaneseWoman1, JapaneseWoman2, JapaneseMan1-5）
            language_code: 言語コード（ja-JP, en-US）
            speaking_rate: 話速（0.25-4.0）
            pitch: ピッチ調整（使用されません - ElevenLabsでは音声モデルで制御）
            volume_gain_db: 音量調整（0.0-1.0に変換）
            audio_format: 出力形式（mp3, wav）
            sample_rate_hertz: サンプルレート
            
        Returns:
            SynthesisResult: 合成結果
        """
        if not self.api_key:
            raise ValueError("ElevenLabs API key not configured")
        
        # テキスト検証
        if not await self.validate_text(text):
            raise ValueError(f"Invalid text for synthesis: {text[:50]}...")
        
        # 音声設定の調整
        if voice_id not in self.available_voices:
            logger.warning(f"Unknown voice_id: {voice_id}, using default JapaneseWoman1")
            voice_id = "JapaneseWoman1"
        
        # ElevenLabs API固有のパラメータ設定
        voice_info = VoiceInfo(**self.available_voices[voice_id])
        elevenlabs_voice_id = self.available_voices[voice_id]["voice_id"]
        
        try:
            # ElevenLabs TTS APIリクエスト
            audio_data = await self._call_elevenlabs_api(
                text=text,
                voice_id=elevenlabs_voice_id,
                speed=speaking_rate,
                volume=volume_gain_db,
                audio_format=audio_format
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
                    "provider": "elevenlabs",
                    "voice_id": voice_id,
                    "elevenlabs_voice_id": elevenlabs_voice_id,
                    "speaking_rate": speaking_rate,
                    "volume_gain_db": volume_gain_db,
                    "api_version": "v1",
                    "generated_at": time.time()
                }
            )
            
        except Exception as e:
            logger.error(f"ElevenLabs TTS synthesis failed: {e}")
            raise RuntimeError(f"Failed to synthesize with ElevenLabs: {str(e)}")
    
    async def _call_elevenlabs_api(
        self,
        text: str,
        voice_id: str,
        speed: float,
        volume: float,
        audio_format: str
    ) -> bytes:
        """ElevenLabs TTS APIを呼び出します。"""
        
        # APIエンドポイント（ElevenLabs正式仕様）
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        # ElevenLabsの音声設定
        voice_settings = {
            "stability": 0.5,           # 音声の安定性（0-1）
            "similarity_boost": 0.8,    # 音声の類似性（0-1）
            "style": 0.2,              # スタイルの強度（0-1）
            "use_speaker_boost": True   # 話者強調の使用
        }
        
        # 速度調整（ElevenLabsでは直接的な速度調整は限定的）
        if speed != 1.0:
            # 安定性を調整して間接的に速度に影響
            if speed > 1.0:
                voice_settings["stability"] = min(0.8, voice_settings["stability"] + 0.2)
            else:
                voice_settings["stability"] = max(0.2, voice_settings["stability"] - 0.2)
        
        # 音量調整（similarity_boostで間接的に調整）
        if volume != 0.0:
            volume_factor = max(0.0, min(1.0, (volume + 20.0) / 40.0))  # -20dB~+20dB → 0~1
            voice_settings["similarity_boost"] = volume_factor
        
        # リクエストペイロード（ElevenLabs正式仕様）
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",  # 多言語対応モデル
            "voice_settings": voice_settings,
            "output_format": "mp3_22050_32" if audio_format.lower() == "mp3" else "pcm_22050"
        }
        
        # ElevenLabs APIは出力形式をペイロードで指定（paramsは不要）
        
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg" if audio_format.lower() == "mp3" else "audio/wav"
        }
        
        # APIコール実行
        async with httpx.AsyncClient(timeout=60.0) as client:  # ElevenLabsは処理時間が長い場合がある
            try:
                logger.info(f"Calling ElevenLabs TTS API for {len(text)} characters")
                
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.content
                else:
                    error_detail = "Unknown error"
                    try:
                        error_data = response.json()
                        error_detail = error_data.get("detail", {}).get("message", str(error_data))
                    except:
                        error_detail = response.text or f"HTTP {response.status_code}"
                    
                    raise httpx.HTTPStatusError(
                        f"ElevenLabs API error: {error_detail}",
                        request=response.request,
                        response=response
                    )
                    
            except httpx.TimeoutException:
                raise RuntimeError("ElevenLabs API request timed out")
            except httpx.RequestError as e:
                raise RuntimeError(f"ElevenLabs API request failed: {e}")
    
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
                confidence=0.92  # ElevenLabsは高品質
            ))
            
            current_time = end_time
        
        return timestamps
    
    async def get_available_voices(
        self, 
        language_code: Optional[str] = None
    ) -> List[VoiceInfo]:
        """利用可能な音声一覧を取得します。"""
        voices = []
        
        for voice_data in self.available_voices.values():
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
        """ElevenLabs固有のテキスト検証を行います。"""
        # 基本検証
        if not await super().validate_text(text):
            return False
        
        # ElevenLabs固有の制限
        if len(text) > 2500:  # ElevenLabsの推奨文字数制限
            return False
        
        return True
    
    async def estimate_duration(self, text: str, speaking_rate: float = 1.0) -> float:
        """ElevenLabs音声の時間を推定します。"""
        char_count = len(text)
        
        # 多言語対応の推定（日本語・英語を考慮）
        if any('\u3040' <= char <= '\u309F' or '\u30A0' <= char <= '\u30FF' or '\u4E00' <= char <= '\u9FAF' for char in text):
            # 日本語が含まれる場合: 約250文字/分
            base_duration_minutes = char_count / 250
        else:
            # 英語の場合: 約180単語/分 ≈ 900文字/分
            base_duration_minutes = char_count / 900
        
        duration_seconds = (base_duration_minutes * 60) / speaking_rate
        
        # 最小1秒、最大15分の制限
        return max(1.0, min(900.0, duration_seconds)) 