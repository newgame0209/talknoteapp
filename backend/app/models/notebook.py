"""
しゃべるノート - ノートブックモデル
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class Notebook(Base):
    """ノートブックモデル"""
    __tablename__ = "notebooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # 所有者
    user_id = Column(String, ForeignKey("users.uid"), nullable=False)
    user = relationship("User", back_populates="notebooks")
    
    # フォルダ構造
    folder = Column(String, nullable=True, default="/")
    
    # 論理削除
    deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    pages = relationship("Page", back_populates="notebook", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="notebook_tags", back_populates="notebooks")
    
    def __repr__(self):
        return f"<Notebook {self.title}>"
