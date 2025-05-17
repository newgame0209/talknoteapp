"""
しゃべるノート - AIプロバイダーファクトリー
設定に基づいて適切なAIプロバイダーを選択する
"""
import logging
from typing import Optional

from app.core.settings import settings
from app.providers.ai.base import BaseAIProvider
from app.providers.ai.openai import OpenAIProvider
from app.providers.ai.anthropic import AnthropicProvider

# ロギング設定
logger = logging.getLogger(__name__)


class AIProviderFactory:
    """
    AIプロバイダーファクトリー
    設定に基づいて適切なAIプロバイダーを選択する
    """
    
    @staticmethod
    def get_research_provider() -> BaseAIProvider:
        """
        リサーチ用のAIプロバイダーを取得する
        
        Returns:
            BaseAIProvider: リサーチ用のAIプロバイダー
        """
        provider_name = settings.RESEARCH_PROVIDER.lower()
        
        if provider_name == "anthropic" and settings.ANTHROPIC_API_KEY:
            logger.info("Using Anthropic provider for research")
            return AnthropicProvider()
        elif provider_name == "google":
            # 将来的にGoogleプロバイダーを実装する場合はここに追加
            logger.warning("Google provider for research is not implemented yet, falling back to OpenAI")
            return OpenAIProvider()
        else:
            logger.info("Using OpenAI provider for research (default)")
            return OpenAIProvider()
    
    @staticmethod
    def get_chat_provider() -> BaseAIProvider:
        """
        チャット用のAIプロバイダーを取得する
        
        Returns:
            BaseAIProvider: チャット用のAIプロバイダー
        """
        # チャットはOpenAIをデフォルトとする
        if settings.OPENAI_API_KEY:
            logger.info("Using OpenAI provider for chat")
            return OpenAIProvider()
        elif settings.ANTHROPIC_API_KEY:
            logger.info("Using Anthropic provider for chat (fallback)")
            return AnthropicProvider()
        else:
            logger.warning("No API keys set for AI providers")
            return OpenAIProvider()  # APIキーがなくてもエラーメッセージを返せるようにする
    
    @staticmethod
    def get_provider(provider_type: Optional[str] = None) -> BaseAIProvider:
        """
        指定されたタイプのAIプロバイダーを取得する
        
        Args:
            provider_type: プロバイダータイプ（"research", "chat", "openai", "anthropic"）
            
        Returns:
            BaseAIProvider: AIプロバイダー
        """
        if not provider_type:
            return AIProviderFactory.get_chat_provider()
        
        provider_type = provider_type.lower()
        
        if provider_type == "research":
            return AIProviderFactory.get_research_provider()
        elif provider_type == "chat":
            return AIProviderFactory.get_chat_provider()
        elif provider_type == "openai":
            return OpenAIProvider()
        elif provider_type == "anthropic":
            return AnthropicProvider()
        else:
            logger.warning(f"Unknown provider type: {provider_type}, using default")
            return AIProviderFactory.get_chat_provider()
