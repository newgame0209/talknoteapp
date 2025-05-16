"""
しゃべるノート - データベース接続設定
SQLAlchemyを使用してPostgreSQLに接続
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.settings import settings

# エンジン作成
engine = create_engine(
    settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"),  # psycopg2で使用する形式に変換
    pool_pre_ping=True,  # 接続が生きているか確認
    pool_recycle=3600,   # 1時間ごとに接続をリサイクル
)

# セッションファクトリ
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# モデルのベースクラス
Base = declarative_base()


def get_db():
    """
    依存性注入用のデータベースセッションジェネレータ
    
    Yields:
        Session: データベースセッション
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
