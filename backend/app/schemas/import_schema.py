"""
Import API Schemas

インポート機能のAPI用Pydanticスキーマです。
URLインポートとファイルインポートのリクエスト・レスポンスを定義します。
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, HttpUrl, Field, validator
from datetime import datetime
from enum import Enum


class ImportType(str, Enum):
    """インポートタイプ"""
    URL = "url"
    FILE = "file"


class ImportStatus(str, Enum):
    """インポート処理状況"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# URLインポート用スキーマ
class URLImportRequest(BaseModel):
    """URLインポートリクエスト"""
    url: HttpUrl = Field(..., description="インポート対象のURL")
    extract_options: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="抽出オプション（字幕言語、最大ページ数等）"
    )
    auto_title: bool = Field(default=True, description="AIによる自動タイトル生成を行うか")
    auto_split: bool = Field(default=True, description="2000文字を超える場合の自動ページ分割を行うか")
    
    @validator('url')
    def validate_url(cls, v):
        url_str = str(v)
        if not (url_str.startswith('http://') or url_str.startswith('https://')):
            raise ValueError('URL must start with http:// or https://')
        return v


class FileImportRequest(BaseModel):
    """ファイルインポートリクエスト"""
    media_id: str = Field(..., description="アップロード済みファイルのメディアID")
    extract_options: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="抽出オプション（エンコーディング、最大ページ数等）"
    )
    auto_title: bool = Field(default=True, description="AIによる自動タイトル生成を行うか")
    auto_split: bool = Field(default=True, description="2000文字を超える場合の自動ページ分割を行うか")


# 共通レスポンススキーマ
class ImportResponse(BaseModel):
    """インポートレスポンス"""
    import_id: str = Field(..., description="インポート処理ID")
    import_type: ImportType = Field(..., description="インポートタイプ")
    status: ImportStatus = Field(..., description="処理状況")
    source_info: Dict[str, Any] = Field(..., description="ソース情報（URL、ファイル名等）")
    created_at: datetime = Field(..., description="作成日時")
    estimated_completion_time: Optional[int] = Field(None, description="完了予定時間（秒）")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImportStatusResponse(BaseModel):
    """インポート状況レスポンス"""
    import_id: str = Field(..., description="インポート処理ID")
    import_type: ImportType = Field(..., description="インポートタイプ")
    status: ImportStatus = Field(..., description="処理状況")
    progress: float = Field(0.0, description="進捗率（0.0-1.0）", ge=0.0, le=1.0)
    
    # 処理結果（完了時）
    note_id: Optional[str] = Field(None, description="作成されたノートID（完了時）")
    total_pages: Optional[int] = Field(None, description="作成されたページ数（完了時）")
    extracted_text_length: Optional[int] = Field(None, description="抽出されたテキスト長（完了時）")
    title: Optional[str] = Field(None, description="生成されたタイトル（完了時）")
    
    # エラー情報（失敗時）
    error_message: Optional[str] = Field(None, description="エラーメッセージ（失敗時）")
    error_code: Optional[str] = Field(None, description="エラーコード（失敗時）")
    
    # タイムスタンプ
    created_at: datetime = Field(..., description="作成日時")
    updated_at: datetime = Field(..., description="更新日時")
    completed_at: Optional[datetime] = Field(None, description="完了日時")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImportResultDetail(BaseModel):
    """インポート結果詳細"""
    note_id: str = Field(..., description="作成されたノートID")
    title: str = Field(..., description="ノートタイトル")
    total_pages: int = Field(..., description="総ページ数")
    pages: List[Dict[str, Any]] = Field(..., description="ページ詳細情報")
    
    # 抽出メタデータ
    source_metadata: Dict[str, Any] = Field(..., description="ソースメタデータ")
    extraction_metadata: Dict[str, Any] = Field(..., description="抽出処理メタデータ")
    
    # 処理時間
    processing_time: float = Field(..., description="処理時間（秒）")
    created_at: datetime = Field(..., description="作成日時")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImportListResponse(BaseModel):
    """インポート履歴一覧レスポンス"""
    items: List[ImportStatusResponse] = Field(..., description="インポート履歴リスト")
    total: int = Field(..., description="総件数")
    page: int = Field(..., description="現在のページ番号")
    page_size: int = Field(..., description="ページサイズ")
    has_next: bool = Field(..., description="次のページがあるか")


# エラーレスポンス
class ImportErrorResponse(BaseModel):
    """インポートエラーレスポンス"""
    error_code: str = Field(..., description="エラーコード")
    error_message: str = Field(..., description="エラーメッセージ")
    details: Optional[Dict[str, Any]] = Field(None, description="エラー詳細情報")
    timestamp: datetime = Field(..., description="エラー発生時刻")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        } 