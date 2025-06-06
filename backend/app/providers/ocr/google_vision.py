"""
Google Vision API OCR Provider

Google Cloud Vision APIを使用してOCR（光学文字認識）を実行するプロバイダーです。
高精度な日本語・英語の文字認識に対応しています。
"""

import logging
from typing import Dict, List, Optional, Any
import io

try:
    from google.cloud import vision
    from google.api_core import exceptions as gcp_exceptions
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    GOOGLE_VISION_AVAILABLE = False
    vision = None
    gcp_exceptions = None

from .base import OCRProvider, OCRResult, OCRError

logger = logging.getLogger(__name__)


class GoogleVisionOCRProvider(OCRProvider):
    """Google Vision APIを使用したOCRプロバイダー"""
    
    def __init__(self, **kwargs):
        """
        Google Vision OCRプロバイダーを初期化
        
        Args:
            **kwargs: 設定パラメータ
                - project_id: Google Cloud プロジェクトID
                - credentials_path: サービスアカウントキーのパス
        """
        super().__init__(**kwargs)
        
        if not GOOGLE_VISION_AVAILABLE:
            raise OCRError(
                "Google Cloud Vision library is not available. "
                "Install with: pip install google-cloud-vision",
                provider="google_vision"
            )
        
        try:
            # Vision APIクライアントを初期化
            self.client = vision.ImageAnnotatorClient()
            logger.info("Google Vision OCR Provider initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Vision client: {e}")
            raise OCRError(
                f"Failed to initialize Google Vision client: {e}",
                provider="google_vision"
            )
    
    async def extract_text(
        self, 
        image_data: bytes, 
        language_hints: Optional[List[str]] = None
    ) -> OCRResult:
        """
        Google Vision APIを使用して画像からテキストを抽出
        
        Args:
            image_data: 画像のバイナリデータ
            language_hints: 言語ヒント（例: ['ja', 'en']）
            
        Returns:
            OCRResult: 抽出結果
        """
        try:
            # 画像データを前処理
            processed_image_data = self.preprocess_image(image_data)
            
            # Vision API用の画像オブジェクトを作成
            image = vision.Image(content=processed_image_data)
            
            # 画像コンテキストを設定（言語ヒントがある場合）
            image_context = None
            if language_hints:
                image_context = vision.ImageContext(
                    language_hints=language_hints
                )
            
            # テキスト検出を実行
            if image_context:
                response = self.client.text_detection(
                    image=image, 
                    image_context=image_context
                )
            else:
                response = self.client.text_detection(image=image)
            
            # エラーチェック
            if response.error.message:
                raise OCRError(
                    f"Google Vision API error: {response.error.message}",
                    provider="google_vision",
                    error_code=str(response.error.code)
                )
            
            # テキスト注釈を取得
            texts = response.text_annotations
            
            if not texts:
                # テキストが検出されなかった場合
                return OCRResult(
                    text="",
                    confidence=0.0,
                    language=None,
                    metadata={"provider": "google_vision", "texts_count": 0}
                )
            
            # 最初の要素が全体のテキスト
            full_text = texts[0].description
            
            # 信頼度を計算（個別の文字の信頼度の平均）
            total_confidence = 0.0
            confidence_count = 0
            
            # 境界ボックス情報を収集
            bounding_boxes = []
            
            for text in texts[1:]:  # 最初の要素はスキップ（全体テキスト）
                # 境界ボックス情報を追加
                vertices = text.bounding_poly.vertices
                bounding_box = {
                    "text": text.description,
                    "vertices": [
                        {"x": vertex.x, "y": vertex.y} 
                        for vertex in vertices
                    ]
                }
                bounding_boxes.append(bounding_box)
            
            # 言語検出
            detected_language = None
            if hasattr(response, 'text_annotations') and response.text_annotations:
                # 最初のテキスト注釈から言語を推定
                # Google Vision APIは言語を直接返さないため、
                # テキストの内容から推定する簡易的な方法を使用
                detected_language = self._detect_language(full_text)
            
            # 信頼度の計算（簡易版）
            # Google Vision APIは文字レベルの信頼度を直接提供しないため、
            # テキストの長さと検出された文字数から推定
            confidence = min(0.95, len(full_text.strip()) / max(1, len(full_text)) * 0.9 + 0.1)
            
            return OCRResult(
                text=full_text,
                confidence=confidence,
                language=detected_language,
                bounding_boxes=bounding_boxes,
                metadata={
                    "provider": "google_vision",
                    "texts_count": len(texts),
                    "has_bounding_boxes": len(bounding_boxes) > 0
                }
            )
            
        except gcp_exceptions.GoogleAPIError as e:
            logger.error(f"Google Vision API error: {e}")
            raise OCRError(
                f"Google Vision API error: {e}",
                provider="google_vision",
                error_code=str(e.code) if hasattr(e, 'code') else None
            )
        except Exception as e:
            logger.error(f"Unexpected error in Google Vision OCR: {e}")
            raise OCRError(
                f"Unexpected error in Google Vision OCR: {e}",
                provider="google_vision"
            )
    
    def is_available(self) -> bool:
        """
        Google Vision APIが利用可能かチェック
        
        Returns:
            bool: 利用可能な場合True
        """
        if not GOOGLE_VISION_AVAILABLE:
            return False
        
        try:
            # 簡単なテストリクエストを送信
            # 実際にはクライアントの初期化が成功していればOK
            return hasattr(self, 'client') and self.client is not None
        except Exception:
            return False
    
    def _detect_language(self, text: str) -> Optional[str]:
        """
        テキストから言語を推定（簡易版）
        
        Args:
            text: 分析するテキスト
            
        Returns:
            str: 推定された言語コード（'ja', 'en', etc.）
        """
        if not text:
            return None
        
        # 日本語文字（ひらがな、カタカナ、漢字）の検出
        japanese_chars = 0
        total_chars = 0
        
        for char in text:
            if char.isalpha() or ord(char) > 127:  # 非ASCII文字
                total_chars += 1
                # 日本語文字の範囲をチェック
                char_code = ord(char)
                if (0x3040 <= char_code <= 0x309F or  # ひらがな
                    0x30A0 <= char_code <= 0x30FF or  # カタカナ
                    0x4E00 <= char_code <= 0x9FAF):   # 漢字
                    japanese_chars += 1
        
        if total_chars == 0:
            return None
        
        # 日本語文字の割合が30%以上なら日本語と判定
        japanese_ratio = japanese_chars / total_chars
        if japanese_ratio >= 0.3:
            return "ja"
        else:
            return "en" 