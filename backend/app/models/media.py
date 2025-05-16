"""
しゃべるノート - メディアアセットモデル
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, func, Text, Enum, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.core.database import Base


class MediaType(str, enum.Enum):
    """メディアタイプ列挙型"""
    AUDIO = "audio"
    IMAGE = "image"
    PDF = "pdf"
    URL = "url"


class ProcessingStatus(str, enum.Enum):
    """処理状態列挙型"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MediaAsset(Base):
    """メディアアセットモデル"""
    __tablename__ = "media_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    
    # メディアタイプと処理状態
    media_type = Column(Enum(MediaType), nullable=False)
    status = Column(Enum(ProcessingStatus), nullable=False, default=ProcessingStatus.PENDING)
    
    # Cloud Storage パス
    storage_path = Column(String, nullable=False)
    
    # 所属するページ
    page_id = Column(UUID(as_uuid=True), ForeignKey("pages.id"), nullable=False)
    page = relationship("Page", back_populates="media_assets")
    
    # メタデータ
    duration = Column(Integer, nullable=True)  # 音声の場合、秒単位
    mime_type = Column(String, nullable=True)
    
    # エラー情報
    error_message = Column(Text, nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    processed_at = Column(DateTime, nullable=True)
    
    # リレーションシップ
    transcripts = relationship("Transcript", back_populates="media_asset", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<MediaAsset {self.filename} ({self.media_type})>"
