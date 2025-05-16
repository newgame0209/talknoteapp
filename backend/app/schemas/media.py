"""
しゃべるノート - メディアアセットスキーマ
Pydanticモデルを使用してAPI入出力のバリデーションと型変換を行う
"""
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.media import MediaType, ProcessingStatus


class MediaAssetBase(BaseModel):
    """メディアアセットの基本スキーマ"""
    filename: str
    media_type: MediaType
    mime_type: Optional[str] = None
    duration: Optional[int] = None  # 音声の場合、秒単位


class MediaAssetCreate(MediaAssetBase):
    """メディアアセット作成スキーマ"""
    page_id: UUID
    storage_path: str


class MediaAssetUpdate(BaseModel):
    """メディアアセット更新スキーマ"""
    filename: Optional[str] = None
    status: Optional[ProcessingStatus] = None
    error_message: Optional[str] = None
    duration: Optional[int] = None
    mime_type: Optional[str] = None
    processed_at: Optional[datetime] = None


class MediaAsset(MediaAssetBase):
    """メディアアセットレスポンススキーマ"""
    id: UUID
    page_id: UUID
    storage_path: str
    status: ProcessingStatus
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MediaAssetList(BaseModel):
    """メディアアセット一覧レスポンススキーマ"""
    items: List[MediaAsset]
    total: int
