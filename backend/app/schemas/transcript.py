"""
しゃべるノート - 文字起こしスキーマ
Pydanticモデルを使用してAPI入出力のバリデーションと型変換を行う
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class TranscriptBase(BaseModel):
    """文字起こしの基本スキーマ"""
    provider: str  # google, parakeet, local
    text: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    confidence: Optional[float] = None
    transcript_metadata: Optional[Dict[str, Any]] = None


class TranscriptCreate(TranscriptBase):
    """文字起こし作成スキーマ"""
    media_asset_id: UUID


class TranscriptUpdate(BaseModel):
    """文字起こし更新スキーマ"""
    text: Optional[str] = None
    confidence: Optional[float] = None
    transcript_metadata: Optional[Dict[str, Any]] = None


class Transcript(TranscriptBase):
    """文字起こしレスポンススキーマ"""
    id: UUID
    media_asset_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class TranscriptList(BaseModel):
    """文字起こし一覧レスポンススキーマ"""
    items: List[Transcript]
    total: int
