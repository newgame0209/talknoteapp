"""
OCR Schemas

OCR（光学文字認識）機能のPydanticスキーマです。
APIリクエスト・レスポンスの型定義を行います。
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class OCRRequest(BaseModel):
    """OCRリクエストスキーマ（Base64画像用）"""
    
    image_data: str = Field(
        ..., 
        description="Base64エンコードされた画像データ",
        example="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
    )
    language_hints: Optional[List[str]] = Field(
        None,
        description="言語ヒント（例: ['ja', 'en']）",
        example=["ja", "en"]
    )
    provider: Optional[str] = Field(
        None,
        description="使用するOCRプロバイダー（省略時は自動選択）",
        example="google_vision"
    )
    desired_rotation: Optional[int] = Field(
        None,
        description="画像の回転角度（90, 180, 270度）- 横向き画像のOCR精度向上用",
        example=90
    )


class BoundingBox(BaseModel):
    """文字の境界ボックス情報"""
    
    text: str = Field(..., description="検出されたテキスト")
    vertices: List[Dict[str, int]] = Field(
        ..., 
        description="境界ボックスの頂点座標",
        example=[
            {"x": 100, "y": 50},
            {"x": 200, "y": 50},
            {"x": 200, "y": 80},
            {"x": 100, "y": 80}
        ]
    )


class OCRResponse(BaseModel):
    """OCRレスポンススキーマ"""
    
    text: str = Field(
        ..., 
        description="抽出されたテキスト",
        example="これはサンプルテキストです。"
    )
    confidence: float = Field(
        ..., 
        description="認識の信頼度（0.0-1.0）",
        ge=0.0,
        le=1.0,
        example=0.95
    )
    language: Optional[str] = Field(
        None,
        description="検出された言語コード",
        example="ja"
    )
    provider: Optional[str] = Field(
        None,
        description="使用されたOCRプロバイダー",
        example="google_vision"
    )
    bounding_boxes: Optional[List[BoundingBox]] = Field(
        None,
        description="文字の境界ボックス情報（利用可能な場合）"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="追加のメタデータ",
        example={
            "provider": "google_vision",
            "texts_count": 5,
            "has_bounding_boxes": True
        }
    )
    error: Optional[str] = Field(
        None,
        description="エラーメッセージ（エラー時のみ）",
        example=None
    )


class OCRProviderInfo(BaseModel):
    """OCRプロバイダー情報"""
    
    name: str = Field(..., description="プロバイダー名", example="google_vision")
    available: bool = Field(..., description="利用可能かどうか", example=True)
    description: str = Field(
        ..., 
        description="プロバイダーの説明",
        example="Google Cloud Vision API - 高精度な日本語・英語OCR"
    )


class OCRProvidersResponse(BaseModel):
    """OCRプロバイダー一覧レスポンス"""
    
    providers: List[OCRProviderInfo] = Field(..., description="利用可能なプロバイダーのリスト")
    default_provider: Optional[str] = Field(
        None,
        description="デフォルトプロバイダー",
        example="google_vision"
    ) 