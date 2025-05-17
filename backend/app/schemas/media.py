"""
しゃべるノート - メディアアセットスキーマ
Pydanticモデルを使用してAPI入出力のバリデーションと型変換を行う
"""
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, validator

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


# チャンク分割アップロード関連スキーマ

class UploadUrlRequest(BaseModel):
    """アップロードURLリクエストスキーマ"""
    file_type: str = Field(..., description="ファイルのMIMEタイプ")
    file_size: int = Field(..., description="ファイルサイズ（バイト）")
    chunk_size: Optional[int] = Field(None, description="チャンクサイズ（バイト）")
    total_chunks: Optional[int] = Field(None, description="全チャンク数")


class UploadUrlResponse(BaseModel):
    """アップロードURLレスポンススキーマ"""
    media_id: str = Field(..., description="メディアID")
    upload_url: Optional[str] = Field(None, description="署名付きURL（直接アップロード用）")
    chunk_upload_enabled: bool = Field(False, description="チャンクアップロードが必要か")
    max_chunk_size: int = Field(5242880, description="最大チャンクサイズ（バイト）")


class ChunkUploadResponse(BaseModel):
    """チャンクアップロードレスポンススキーマ"""
    media_id: str = Field(..., description="メディアID")
    chunk_index: int = Field(..., description="チャンクインデックス")
    received_bytes: int = Field(..., description="受信バイト数")
    status: str = Field("success", description="ステータス")


class CompleteUploadRequest(BaseModel):
    """アップロード完了リクエストスキーマ"""
    media_id: str = Field(..., description="メディアID")
    total_chunks: int = Field(..., description="全チャンク数")
    total_size: int = Field(..., description="合計サイズ（バイト）")
    md5_hash: Optional[str] = Field(None, description="MD5ハッシュ（整合性チェック用）")


class MediaStatusResponse(BaseModel):
    """メディア処理状況レスポンススキーマ"""
    media_id: str = Field(..., description="メディアID")
    status: str = Field(..., description="処理状況 (processing|completed|error)")
    progress: float = Field(..., description="進捗度 (0.0〜1.0)")
    error: Optional[str] = Field(None, description="エラーメッセージ")
    result: Optional[Dict[str, Any]] = Field(None, description="処理結果")


class MediaAssetList(BaseModel):
    """メディアアセット一覧レスポンススキーマ"""
    items: List[MediaAsset]
    total: int
