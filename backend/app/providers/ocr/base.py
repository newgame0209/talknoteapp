"""
OCR Provider Base Class

OCR（光学文字認識）プロバイダーの基底クラスです。
異なるOCRサービス（Google Vision API、AWS Textract等）を
統一的に扱うためのインターフェースを定義します。
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import io


@dataclass
class OCRResult:
    """OCR処理結果を格納するデータクラス"""
    text: str  # 抽出されたテキスト
    confidence: float  # 信頼度（0.0-1.0）
    language: Optional[str] = None  # 検出された言語
    bounding_boxes: Optional[List[Dict[str, Any]]] = None  # 文字の位置情報
    metadata: Optional[Dict[str, Any]] = None  # その他のメタデータ


class OCRProvider(ABC):
    """OCRプロバイダーの基底クラス"""
    
    def __init__(self, **kwargs):
        """
        OCRプロバイダーを初期化
        
        Args:
            **kwargs: プロバイダー固有の設定パラメータ
        """
        self.config = kwargs
    
    @abstractmethod
    async def extract_text(
        self, 
        image_data: bytes, 
        language_hints: Optional[List[str]] = None
    ) -> OCRResult:
        """
        画像からテキストを抽出
        
        Args:
            image_data: 画像のバイナリデータ
            language_hints: 言語ヒント（例: ['ja', 'en']）
            
        Returns:
            OCRResult: 抽出結果
            
        Raises:
            OCRError: OCR処理でエラーが発生した場合
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        プロバイダーが利用可能かチェック
        
        Returns:
            bool: 利用可能な場合True
        """
        pass
    
    def preprocess_image(self, image_data: bytes) -> bytes:
        """
        画像の前処理（オプション）
        
        Args:
            image_data: 元の画像データ
            
        Returns:
            bytes: 前処理済み画像データ
        """
        # デフォルトでは何もしない
        return image_data


class OCRError(Exception):
    """OCR処理エラー"""
    
    def __init__(self, message: str, provider: str = None, error_code: str = None):
        super().__init__(message)
        self.provider = provider
        self.error_code = error_code 