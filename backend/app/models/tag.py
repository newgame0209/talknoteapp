"""
しゃべるノート - タグモデル
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, func, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


# ノートブックとタグの多対多関連付けテーブル
notebook_tags = Table(
    "notebook_tags",
    Base.metadata,
    Column("notebook_id", UUID(as_uuid=True), ForeignKey("notebooks.id"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)


class Tag(Base):
    """タグモデル"""
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    
    # 所有者（ユーザー固有のタグ）
    user_id = Column(String, ForeignKey("users.uid"), nullable=False)
    
    # タグの色（UI表示用）
    color = Column(String, nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    notebooks = relationship("Notebook", secondary="notebook_tags", back_populates="tags")
    
    def __repr__(self):
        return f"<Tag {self.name}>"
