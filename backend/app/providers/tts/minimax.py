"""
MiniMax TTS Provider implementation.
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import httpx
import hashlib
import time

from app.core.settings import settings
from .base import BaseTTSProvider, SynthesisResult, VoiceInfo, SentenceTimestamp

logger = logging.getLogger(__name__)


class MinimaxTTSProvider(BaseTTSProvider):
    """MiniMax TTS Provider for high-quality Japanese speech synthesis."""
    
    def __init__(self):
        self.api_key = settings.MINIMAX_API_KEY
        self.group_id = settings.MINIMAX_GROUP_ID
        self.base_url = settings.MINIMAX_BASE_URL
        self.default_language = "ja-JP"
        
        if not self.api_key:
            logger.warning("MiniMax API key not configured")
        
        # 日本語用の音声ID定義
        self.japanese_voices = {
            "female_1": {
                "voice_id": "female_1",
                "name": "あいり（女性）",
                "language_code": "ja-JP",
                "gender": "female",
                "description": "優しく自然な女性の声",
                "sample_rate_hertz": 24000,
            },
            "male_1": {
                "voice_id": "male_1", 
                "name": "たくみ（男性）",
                "language_code": "ja-JP",
                "gender": "male",
                "description": "落ち着いた男性の声",
                "sample_rate_hertz": 24000,
            },
            "female_2": {
                "voice_id": "female_2",
                "name": "ゆい（女性・高めの声）",
                "language_code": "ja-JP",
                "gender": "female",
                "description": "明るく高めの女性の声",
                "sample_rate_hertz": 24000,
            },
        }
    
    async def synthesize(
        self,
        text: str,
        voice_id: str = "female_1",
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "wav",
        sample_rate_hertz: int = 24000,
        **kwargs
    ) -> SynthesisResult:
        """
        MiniMax APIを使用してテキストを音声合成します。
        
        Args:
            text: 合成するテキスト
            voice_id: 音声ID（female_1, male_1, female_2）
            language_code: 言語コード（ja-JPのみサポート）
            speaking_rate: 話速（0.5-2.0）
            pitch: ピッチ調整（-20.0 to 20.0）
            volume_gain_db: 音量調整（-20.0 to 20.0）
            audio_format: 出力形式（wav, mp3）
            sample_rate_hertz: サンプルレート
            
        Returns:
            SynthesisResult: 合成結果
        """
        if not self.api_key:
            raise ValueError("MiniMax API key not configured")
        
        # テキスト検証
        if not await self.validate_text(text):
            raise ValueError(f"Invalid text for synthesis: {text[:50]}...")
        
        # 音声設定の調整
        if voice_id not in self.japanese_voices:
            logger.warning(f"Unknown voice_id: {voice_id}, using default female_1")
            voice_id = "female_1"
        
        # MiniMax API固有のパラメータ設定
        voice_info = VoiceInfo(**self.japanese_voices[voice_id])
        
        try:
            # MiniMax TTS APIリクエスト
            audio_data = await self._call_minimax_api(
                text=text,
                voice_id=voice_id,
                speed=speaking_rate,
                pitch=pitch,
                volume=volume_gain_db,
                audio_format=audio_format,
                sample_rate=sample_rate_hertz
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
                    "provider": "minimax",
                    "voice_id": voice_id,
                    "speaking_rate": speaking_rate,
                    "pitch": pitch,
                    "volume_gain_db": volume_gain_db,
                    "api_version": "v1",
                    "generated_at": time.time()
                }
            )
            
        except Exception as e:
            logger.error(f"MiniMax TTS synthesis failed: {e}")
            raise RuntimeError(f"Failed to synthesize with MiniMax: {str(e)}")
    
    async def _call_minimax_api(
        self,
        text: str,
        voice_id: str,
        speed: float,
        pitch: float,
        volume: float,
        audio_format: str,
        sample_rate: int
    ) -> bytes:
        """MiniMax TTS APIを呼び出します。"""
        
        # APIエンドポイント - MiniMax公式API仕様
        url = f"{self.base_url}/t2a_v2"
        
        # リクエストペイロード - MiniMax公式API仕様に準拠
        payload = {
            "model": "speech-01",
            "text": text,
            "voice_setting": {
                "voice_id": voice_id,
                "speed": max(0.5, min(2.0, speed)),
                "vol": max(0.5, min(2.0, volume + 1.0)),
                "pitch": max(-12, min(12, int(pitch)))
            },
            "audio_setting": {
                "sample_rate": sample_rate,
                "bitrate": 128000,
                "format": audio_format.lower()
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # グループIDが設定されている場合は追加
        if self.group_id:
            headers["Group-Id"] = self.group_id
        
        # APIコール実行
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                logger.info(f"Calling MiniMax TTS API for {len(text)} characters")
                
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers
                )
                
                logger.info(f"MiniMax API response: status={response.status_code}, headers={dict(response.headers)}")
                
                if response.status_code == 200:
                    # レスポンスがJSONの場合は音声URLを取得、バイナリの場合は直接返す
                    content_type = response.headers.get("content-type", "")
                    
                    # レスポンス内容をログに出力（デバッグ用）
                    try:
                        response_text = response.text[:500] if len(response.text) > 500 else response.text
                        logger.info(f"MiniMax API response text: {response_text}")
                    except:
                        logger.info(f"MiniMax API response size: {len(response.content)} bytes")
                    
                    if "application/json" in content_type:
                        # JSON形式のレスポンス（音声URLが含まれる場合）
                        result = response.json()
                        logger.info(f"MiniMax API JSON response keys: {list(result.keys())}")
                        
                        # MiniMax API仕様のレスポンス構造を確認
                        audio_url = None
                        
                        # MiniMax特有のレスポンス構造を処理
                        if "base_resp" in result and result["base_resp"].get("status_code") == 0:
                            # 成功レスポンス
                            if "data" in result and "audio" in result["data"]:
                                audio_url = result["data"]["audio"]
                                logger.info(f"Found MiniMax audio URL: {audio_url}")
                            elif "audio_url" in result.get("data", {}):
                                audio_url = result["data"]["audio_url"]
                                logger.info(f"Found MiniMax audio_url: {audio_url}")
                        
                        if audio_url:
                            # 音声ファイルをダウンロード
                            audio_response = await client.get(audio_url)
                            if audio_response.status_code == 200:
                                return audio_response.content
                            else:
                                raise ValueError(f"Failed to download audio from URL: {audio_url}")
                        else:
                            # レスポンス全体をログに出力
                            logger.error(f"MiniMax API full response: {result}")
                            if "base_resp" in result:
                                status_code = result["base_resp"].get("status_code", "unknown")
                                error_msg = result["base_resp"].get("status_msg", "Unknown error")
                                logger.error(f"MiniMax API error: status_code={status_code}, msg={error_msg}")
                                
                                # 一般的なMiniMaxエラーコードの解釈
                                if status_code == 2049:
                                    raise ValueError(f"MiniMax API認証エラー: APIキーが無効または期限切れです。新しいAPIキーを取得してください。")
                                elif status_code == 2050:
                                    raise ValueError(f"MiniMax API権限エラー: このAPIキーには音声合成の権限がありません。")
                                elif status_code == 1000:
                                    raise ValueError(f"MiniMax APIリクエストエラー: リクエスト形式が正しくありません。")
                                else:
                                    raise ValueError(f"MiniMax API error (code {status_code}): {error_msg}")
                            raise ValueError(f"No audio URL found in MiniMax response. Available keys: {list(result.keys())}")
                    else:
                        # バイナリ形式の直接レスポンス
                        logger.info("MiniMax API returned binary audio data directly")
                        return response.content
                        
                else:
                    error_detail = "Unknown error"
                    try:
                        error_data = response.json()
                        error_detail = error_data.get("error", {}).get("message", str(error_data))
                        logger.error(f"MiniMax API error response: {error_data}")
                    except:
                        error_detail = response.text or f"HTTP {response.status_code}"
                        logger.error(f"MiniMax API error text: {response.text}")
                    
                    logger.error(f"MiniMax API failed with status {response.status_code}: {error_detail}")
                    raise httpx.HTTPStatusError(
                        f"MiniMax API error: {error_detail}",
                        request=response.request,
                        response=response
                    )
                    
            except httpx.TimeoutException:
                raise RuntimeError("MiniMax API request timed out")
            except httpx.RequestError as e:
                logger.error(f"MiniMax API request failed: {e}")
                raise RuntimeError(f"MiniMax API request failed: {e}")
            except Exception as e:
                logger.error(f"MiniMax API unexpected error: {e}")
                raise RuntimeError(f"MiniMax API unexpected error: {e}")
    
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
                confidence=0.95  # MiniMaxは高精度と仮定
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
            }
        ]
    
    async def validate_text(self, text: str) -> bool:
        """MiniMax固有のテキスト検証を行います。"""
        # 基本検証
        if not await super().validate_text(text):
            return False
        
        # MiniMax固有の制限
        if len(text) > 3000:  # MiniMaxの文字数制限
            return False
        
        # 特殊文字の除外（必要に応じて）
        forbidden_chars = ['<', '>', '{', '}']
        if any(char in text for char in forbidden_chars):
            return False
        
        return True
    
    async def estimate_duration(self, text: str, speaking_rate: float = 1.0) -> float:
        """MiniMax音声の時間を推定します。"""
        # 日本語特化の推定（ひらがな・カタカナ・漢字を考慮）
        char_count = len(text)
        
        # 日本語の平均読み上げ速度: 約300文字/分
        base_duration_minutes = char_count / 300
        duration_seconds = (base_duration_minutes * 60) / speaking_rate
        
        # 最小1秒、最大20分の制限
        return max(1.0, min(1200.0, duration_seconds)) 