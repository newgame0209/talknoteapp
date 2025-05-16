"""
しゃべるノート - ノートブックスキーマ
Pydanticモデルを使用してAPI入出力のバリデーションと型変換を行う
"""
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class TagBase(BaseModel):
    """タグの基本スキーマ"""
    name: str
    color: Optional[str] = None


class TagCreate(TagBase):
    """タグ作成スキーマ"""
    pass


class Tag(TagBase):
    """タグレスポンススキーマ"""
    id: UUID
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotebookBase(BaseModel):
    """ノートブックの基本スキーマ"""
    title: str
    description: Optional[str] = None
    folder: Optional[str] = Field(default="/")


class NotebookCreate(NotebookBase):
    """ノートブック作成スキーマ"""
    tags: Optional[List[str]] = []  # タグ名のリスト


class NotebookUpdate(BaseModel):
    """ノートブック更新スキーマ"""
    title: Optional[str] = None
    description: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[List[str]] = None  # タグ名のリスト


class Notebook(NotebookBase):
    """ノートブックレスポンススキーマ"""
    id: UUID
    user_id: str
    created_at: datetime
    updated_at: datetime
    tags: List[Tag] = []

    class Config:
        from_attributes = True


class NotebookList(BaseModel):
    """ノートブック一覧レスポンススキーマ"""
    items: List[Notebook]
    total: int
