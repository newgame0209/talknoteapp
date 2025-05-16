"""
しゃべるノート - ページスキーマ
Pydanticモデルを使用してAPI入出力のバリデーションと型変換を行う
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class PageBase(BaseModel):
    """ページの基本スキーマ"""
    title: Optional[str] = None
    page_number: int = 1
    canvas_data: Optional[Dict[str, Any]] = None


class PageCreate(PageBase):
    """ページ作成スキーマ"""
    notebook_id: UUID


class PageUpdate(BaseModel):
    """ページ更新スキーマ"""
    title: Optional[str] = None
    page_number: Optional[int] = None
    canvas_data: Optional[Dict[str, Any]] = None


class Page(PageBase):
    """ページレスポンススキーマ"""
    id: UUID
    notebook_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PageList(BaseModel):
    """ページ一覧レスポンススキーマ"""
    items: List[Page]
    total: int
