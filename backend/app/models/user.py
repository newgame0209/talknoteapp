"""
しゃべるノート - ユーザーモデル
"""
from sqlalchemy import Column, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """ユーザーモデル"""
    __tablename__ = "users"

    # Firebase UIDをプライマリキーとして使用
    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False)
    
    # タイムスタンプ
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    notebooks = relationship("Notebook", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.email}>"
