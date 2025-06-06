"""
OCR Service

OCR（光学文字認識）処理を管理するサービス層です。
複数のOCRプロバイダーを統一的に管理し、
画像からテキストを抽出する機能を提供します。
"""

import logging
from typing import Dict, List, Optional, Any
import io
from PIL import Image
import asyncio

from app.providers.ocr.base import OCRProvider, OCRResult, OCRError
from app.providers.ocr.google_vision import GoogleVisionOCRProvider
from app.core.settings import settings

logger = logging.getLogger(__name__)


class OCRService:
    """OCR処理を管理するサービスクラス"""
    
    def __init__(self):
        """OCRサービスを初期化"""
        self.providers: Dict[str, OCRProvider] = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """利用可能なOCRプロバイダーを初期化"""
        try:
            # Google Vision APIプロバイダーを初期化
            google_provider = GoogleVisionOCRProvider(
                project_id=getattr(settings, 'GCP_PROJECT_ID', None)
            )
            if google_provider.is_available():
                self.providers['google_vision'] = google_provider
                logger.info("Google Vision OCR provider initialized successfully")
            else:
                logger.warning("Google Vision OCR provider is not available")
        except Exception as e:
            logger.error(f"Failed to initialize Google Vision OCR provider: {e}")
        
        if not self.providers:
            logger.warning("No OCR providers are available")
    
    async def extract_text_from_image(
        self,
        image_data: bytes,
        provider_name: Optional[str] = None,
        language_hints: Optional[List[str]] = None
    ) -> OCRResult:
        """
        画像からテキストを抽出
        
        Args:
            image_data: 画像のバイナリデータ
            provider_name: 使用するプロバイダー名（Noneの場合は自動選択）
            language_hints: 言語ヒント（例: ['ja', 'en']）
            
        Returns:
            OCRResult: 抽出結果
            
        Raises:
            OCRError: OCR処理でエラーが発生した場合
        """
        if not self.providers:
            raise OCRError("No OCR providers are available")
        
        # プロバイダーを選択
        if provider_name and provider_name in self.providers:
            provider = self.providers[provider_name]
        else:
            # デフォルトプロバイダーを選択（Google Vision優先）
            if 'google_vision' in self.providers:
                provider = self.providers['google_vision']
            else:
                provider = next(iter(self.providers.values()))
        
        try:
            # 画像データを検証・前処理
            validated_image_data = await self._validate_and_preprocess_image(image_data)
            
            # OCR処理を実行
            result = await provider.extract_text(
                validated_image_data, 
                language_hints=language_hints
            )
            
            logger.info(
                f"OCR completed successfully. "
                f"Provider: {provider.__class__.__name__}, "
                f"Text length: {len(result.text)}, "
                f"Confidence: {result.confidence:.2f}"
            )
            
            return result
            
        except OCRError:
            # OCRエラーはそのまま再発生
            raise
        except Exception as e:
            logger.error(f"Unexpected error in OCR processing: {e}")
            raise OCRError(f"Unexpected error in OCR processing: {e}")
    
    async def _validate_and_preprocess_image(self, image_data: bytes) -> bytes:
        """
        画像データを検証・前処理
        
        Args:
            image_data: 元の画像データ
            
        Returns:
            bytes: 検証・前処理済み画像データ
            
        Raises:
            OCRError: 画像データが無効な場合
        """
        try:
            # 画像データの基本検証
            if not image_data:
                raise OCRError("Image data is empty")
            
            # PILで画像を開いて検証
            image = Image.open(io.BytesIO(image_data))
            
            # 画像フォーマットの確認
            if image.format not in ['JPEG', 'PNG', 'WEBP', 'BMP']:
                logger.warning(f"Unsupported image format: {image.format}")
                # サポートされていない形式の場合、PNGに変換
                output = io.BytesIO()
                image.save(output, format='PNG')
                image_data = output.getvalue()
                logger.info("Image converted to PNG format")
            
            # 画像サイズの確認
            width, height = image.size
            max_dimension = 4096  # 最大サイズ制限
            
            if width > max_dimension or height > max_dimension:
                # 画像が大きすぎる場合はリサイズ
                ratio = min(max_dimension / width, max_dimension / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                
                resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                output = io.BytesIO()
                resized_image.save(output, format=image.format or 'PNG')
                image_data = output.getvalue()
                
                logger.info(f"Image resized from {width}x{height} to {new_width}x{new_height}")
            
            # ファイルサイズの確認
            max_file_size = 10 * 1024 * 1024  # 10MB
            if len(image_data) > max_file_size:
                raise OCRError(f"Image file size too large: {len(image_data)} bytes (max: {max_file_size} bytes)")
            
            return image_data
            
        except OCRError:
            # OCRエラーはそのまま再発生
            raise
        except Exception as e:
            logger.error(f"Error validating image: {e}")
            raise OCRError(f"Invalid image data: {e}")
    
    def get_available_providers(self) -> List[str]:
        """
        利用可能なOCRプロバイダーのリストを取得
        
        Returns:
            List[str]: プロバイダー名のリスト
        """
        return list(self.providers.keys())
    
    def is_provider_available(self, provider_name: str) -> bool:
        """
        指定されたプロバイダーが利用可能かチェック
        
        Args:
            provider_name: プロバイダー名
            
        Returns:
            bool: 利用可能な場合True
        """
        return provider_name in self.providers and self.providers[provider_name].is_available()


# グローバルOCRサービスインスタンス
ocr_service = OCRService() 