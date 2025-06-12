"""
TTS Service - 統合音声合成サービス

このサービスは複数のTTSプロバイダーを管理し、
設定に基づいて最適なプロバイダーを選択します。
失敗時には自動的にフォールバックプロバイダーに切り替えます。
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
import time
from functools import wraps

from app.core.settings import settings
from app.providers.tts.base import BaseTTSProvider, SynthesisResult, VoiceInfo
from app.providers.tts.minimax import MinimaxTTSProvider
from app.providers.tts.elevenlabs import ElevenLabsTTSProvider
from app.providers.tts.google import GoogleTTSProvider
from app.providers.tts.gemini import GeminiTTSProvider

logger = logging.getLogger(__name__)


def tts_error_handler(func):
    """TTSエラーハンドリングデコレータ"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"TTS operation failed: {e}")
            raise
    return wrapper


class TTSService:
    """音声合成統合サービス"""
    
    def __init__(self):
        self.providers: Dict[str, BaseTTSProvider] = {}
        self.primary_provider = settings.TTS_DEFAULT_PROVIDER  # 環境変数から読み込み
        self.fallback_providers = settings.TTS_FALLBACK_PROVIDERS.copy()
        self.enabled = settings.TTS_ENABLED
        
        # TTS_AVAILABLE_PROVIDERSが文字列の場合はリストに変換
        if isinstance(settings.TTS_AVAILABLE_PROVIDERS, str):
            self.available_providers = [p.strip() for p in settings.TTS_AVAILABLE_PROVIDERS.split(",")]
        else:
            self.available_providers = settings.TTS_AVAILABLE_PROVIDERS.copy()
        
        # プロバイダー初期化
        self._initialize_providers()
        
    def _initialize_providers(self):
        """TTSプロバイダーを初期化します"""
        provider_classes = {
            "google": GoogleTTSProvider,
            "minimax": MinimaxTTSProvider,
            "gemini": GeminiTTSProvider,
            "elevenlabs": ElevenLabsTTSProvider
        }
        
        for name, provider_class in provider_classes.items():
            try:
                provider = provider_class()
                self.providers[name] = provider
                logger.info(f"TTS Provider '{name}' initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize TTS provider '{name}': {e}")
                
        if not self.providers:
            logger.error("No TTS providers available")
            self.enabled = False
        
        # プライマリプロバイダーが利用できない場合の調整
        if self.primary_provider not in self.providers:
            available_providers = list(self.providers.keys())
            if available_providers:
                old_primary = self.primary_provider
                self.primary_provider = available_providers[0]
                logger.warning(f"Primary provider '{old_primary}' not available, using '{self.primary_provider}'")
            else:
                logger.error("No TTS providers available")
                self.enabled = False
    
    @tts_error_handler
    async def synthesize_text(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language_code: str = "ja-JP",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        audio_format: str = "wav",
        sample_rate_hertz: Optional[int] = None,
        provider_name: Optional[str] = None,
        **kwargs
    ) -> SynthesisResult:
        """
        テキストを音声合成します。
        
        Args:
            text: 合成するテキスト
            voice_id: 音声ID（プロバイダー固有、Noneの場合はデフォルト）
            language_code: 言語コード（デフォルト: ja-JP）
            speaking_rate: 話速（0.5-2.0、デフォルト: 1.0）
            pitch: ピッチ調整（-20.0~20.0、デフォルト: 0.0）
            volume_gain_db: 音量調整（-20.0~20.0、デフォルト: 0.0）
            audio_format: 出力形式（wav, mp3、デフォルト: wav）
            sample_rate_hertz: サンプルレート（プロバイダー固有、Noneで自動）
            provider_name: 使用するプロバイダー名（指定しない場合は設定順）
            
        Returns:
            SynthesisResult: 音声合成結果
            
        Raises:
            ValueError: 無効なパラメータ
            RuntimeError: 全てのプロバイダーで合成に失敗
        """
        if not self.enabled:
            raise RuntimeError("TTS service is disabled")
        
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # プロバイダー順序の決定
        provider_order = self._get_provider_order(provider_name)
        
        # 各プロバイダーで試行
        last_error = None
        for provider_name in provider_order:
            if provider_name not in self.providers:
                continue
                
            provider = self.providers[provider_name]
            
            try:
                logger.info(f"Attempting synthesis with provider: {provider_name}")
                start_time = time.time()
                
                # プロバイダー固有のパラメータ調整
                synthesis_params = self._adjust_parameters_for_provider(
                    provider_name=provider_name,
                    voice_id=voice_id,
                    language_code=language_code,
                    speaking_rate=speaking_rate,
                    pitch=pitch,
                    volume_gain_db=volume_gain_db,
                    audio_format=audio_format,
                    sample_rate_hertz=sample_rate_hertz,
                    text=text,  # テキストを明示的に追加
                    **kwargs
                )
                
                # 音声合成実行
                result = await provider.synthesize(**synthesis_params)
                
                synthesis_time = time.time() - start_time
                logger.info(f"Synthesis completed with {provider_name} in {synthesis_time:.2f}s")
                
                # 統計情報の追加
                if not result.metadata:
                    result.metadata = {}
                result.metadata.update({
                    "synthesis_time": synthesis_time,
                    "attempted_providers": provider_order[:provider_order.index(provider_name) + 1],
                    "successful_provider": provider_name
                })
                
                return result
                
            except Exception as e:
                last_error = e
                logger.warning(f"Synthesis failed with {provider_name}: {e}")
                continue
        
        # 全てのプロバイダーで失敗した場合
        error_msg = f"All TTS providers failed. Last error: {last_error}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    def _get_provider_order(self, preferred_provider: Optional[str] = None) -> List[str]:
        """プロバイダーの試行順序を取得します"""
        if preferred_provider and preferred_provider in self.providers:
            # 指定されたプロバイダーを最優先
            order = [preferred_provider]
            order.extend([p for p in [self.primary_provider] + self.fallback_providers 
                         if p != preferred_provider and p in self.providers])
        else:
            # 設定順序に従う
            order = [self.primary_provider] + self.fallback_providers
            order = [p for p in order if p in self.providers]
        
        return order
    
    def _adjust_parameters_for_provider(
        self,
        provider_name: str,
        voice_id: Optional[str],
        language_code: str,
        speaking_rate: float,
        pitch: float,
        volume_gain_db: float,
        audio_format: str,
        sample_rate_hertz: Optional[int],
        text: str,  # textパラメータを明示的に追加
        **kwargs
    ) -> Dict[str, Any]:
        """プロバイダー固有のパラメータ調整を行います"""
        params = {
            "text": text,  # kwargsではなく明示的なパラメータを使用
            "language_code": language_code,
            "speaking_rate": speaking_rate,
            "pitch": pitch,
            "volume_gain_db": volume_gain_db,
            "audio_format": audio_format,
        }
        
        # プロバイダー固有の音声ID設定
        if voice_id:
            params["voice_id"] = voice_id
        else:
            # デフォルト音声の設定
            default_voices = {
                "minimax": "female_1",
                "elevenlabs": "Bella",
                "google": "ja-JP-Neural2-B"
            }
            params["voice_id"] = default_voices.get(provider_name, "default")
        
        # プロバイダー固有のサンプルレート設定
        if sample_rate_hertz:
            params["sample_rate_hertz"] = sample_rate_hertz
        else:
            # デフォルトサンプルレート
            default_sample_rates = {
                "minimax": 24000,
                "elevenlabs": 22050,
                "google": 24000
            }
            params["sample_rate_hertz"] = default_sample_rates.get(provider_name, 22050)
        
        # プロバイダー固有の範囲制限
        if provider_name == "minimax":
            params["speaking_rate"] = max(0.5, min(2.0, speaking_rate))
        elif provider_name == "elevenlabs":
            params["speaking_rate"] = max(0.25, min(4.0, speaking_rate))
        elif provider_name == "google":
            params["speaking_rate"] = max(0.25, min(4.0, speaking_rate))
        
        return params
    
    async def get_available_voices(
        self,
        provider_name: Optional[str] = None,
        language_code: Optional[str] = None
    ) -> Dict[str, List[VoiceInfo]]:
        """利用可能な音声一覧を取得します"""
        if provider_name and provider_name in self.providers:
            providers_to_check = [provider_name]
        else:
            providers_to_check = list(self.providers.keys())
        
        voices_by_provider = {}
        
        for name in providers_to_check:
            try:
                provider = self.providers[name]
                voices = await provider.get_available_voices(language_code)
                voices_by_provider[name] = voices
            except Exception as e:
                logger.warning(f"Failed to get voices from {name}: {e}")
                voices_by_provider[name] = []
        
        return voices_by_provider
    
    async def get_supported_languages(
        self,
        provider_name: Optional[str] = None
    ) -> Dict[str, List[Dict[str, str]]]:
        """サポートする言語一覧を取得します"""
        if provider_name and provider_name in self.providers:
            providers_to_check = [provider_name]
        else:
            providers_to_check = list(self.providers.keys())
        
        languages_by_provider = {}
        
        for name in providers_to_check:
            try:
                provider = self.providers[name]
                languages = await provider.get_supported_languages()
                languages_by_provider[name] = languages
            except Exception as e:
                logger.warning(f"Failed to get languages from {name}: {e}")
                languages_by_provider[name] = []
        
        return languages_by_provider
    
    def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """プロバイダーの状態を取得します"""
        status = {
            "enabled": self.enabled,
            "primary_provider": self.primary_provider,
            "fallback_providers": self.fallback_providers,
            "providers": {}
        }
        
        for name, provider in self.providers.items():
            try:
                # プロバイダーの基本情報
                provider_status = {
                    "available": True,
                    "class": provider.__class__.__name__,
                    "default_language": getattr(provider, "default_language", "unknown")
                }
                
                # プロバイダー固有の設定情報
                if hasattr(provider, "api_key"):
                    provider_status["api_key_configured"] = bool(provider.api_key)
                
                status["providers"][name] = provider_status
                
            except Exception as e:
                status["providers"][name] = {
                    "available": False,
                    "error": str(e)
                }
        
        return status


# シングルトンインスタンス
tts_service = TTSService() 