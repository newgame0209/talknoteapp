"""
しゃべるノート - 文字起こしモデル
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, func, Text, Float, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from app.core.database import Base


class Transcript(Base):
    """文字起こしモデル"""
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # 所属するメディアアセット
    media_asset_id = Column(UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False)
    media_asset = relationship("MediaAsset", back_populates="transcripts")
    
    # 文字起こしプロバイダー
    provider = Column(String, nullable=False)  # google, parakeet, local
    
    # 文字起こしテキスト
    text = Column(Text, nullable=False)
    
    # 開始・終了時間（秒）
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    
    # 信頼度スコア（0-1）
    confidence = Column(Float, nullable=True)
    
    # 追加メタデータ（言語、話者識別など）
    transcript_metadata = Column(JSONB, nullable=True, comment="文字起こしの追加メタデータ")
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    
    def __repr__(self):
        return f"<Transcript {self.id} ({self.provider})>"
