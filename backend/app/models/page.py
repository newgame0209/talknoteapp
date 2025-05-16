"""
しゃべるノート - ページモデル
"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class Page(Base):
    """ページモデル"""
    __tablename__ = "pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=True)
    
    # 所属するノートブック
    notebook_id = Column(UUID(as_uuid=True), ForeignKey("notebooks.id"), nullable=False)
    notebook = relationship("Notebook", back_populates="pages")
    
    # ページ順序
    page_number = Column(Integer, nullable=False, default=1)
    
    # キャンバスデータ (JSON形式)
    canvas_data = Column(JSON, nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    media_assets = relationship("MediaAsset", back_populates="page", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Page {self.title or f'Page {self.page_number}'}>"
