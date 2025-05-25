"""
しゃべるノート - 文字起こしCRUDサービス
文字起こしの作成・取得・更新・削除操作を提供
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.transcript import Transcript
from app.schemas.transcript import TranscriptCreate, TranscriptUpdate
from app.services.base import CRUDBase


class CRUDTranscript(CRUDBase[Transcript, TranscriptCreate, TranscriptUpdate]):
    """文字起こしCRUDサービス"""
    
    def get_by_media_asset(
        self, db: Session, *, media_asset_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Transcript]:
        """
        メディアアセットIDに基づく文字起こし一覧取得
        
        Args:
            db: データベースセッション
            media_asset_id: メディアアセットID
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[Transcript]: 文字起こしリスト
        """
        return (
            db.query(Transcript)
            .filter(Transcript.media_asset_id == media_asset_id)
            .order_by(Transcript.start_time)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_count_by_media_asset(self, db: Session, *, media_asset_id: UUID) -> int:
        """
        メディアアセットIDに基づく文字起こし数取得
        
        Args:
            db: データベースセッション
            media_asset_id: メディアアセットID
            
        Returns:
            int: 文字起こし数
        """
        return (
            db.query(func.count(Transcript.id))
            .filter(Transcript.media_asset_id == media_asset_id)
            .scalar()
        )
    
    def get_by_provider(
        self, db: Session, *, media_asset_id: UUID, provider: str
    ) -> Optional[Transcript]:
        """
        メディアアセットIDとプロバイダーに基づく文字起こし取得
        
        Args:
            db: データベースセッション
            media_asset_id: メディアアセットID
            provider: プロバイダー名
            
        Returns:
            Optional[Transcript]: 文字起こし（存在しない場合はNone）
        """
        return (
            db.query(Transcript)
            .filter(
                Transcript.media_asset_id == media_asset_id,
                Transcript.provider == provider
            )
            .first()
        )
    
    def create_with_media_asset(
        self, db: Session, *, obj_in: TranscriptCreate
    ) -> Transcript:
        """
        メディアアセット付き文字起こし作成
        
        Args:
            db: データベースセッション
            obj_in: 作成データ
            
        Returns:
            Transcript: 作成された文字起こし
        """
        obj_in_data = obj_in.dict()
        db_obj = Transcript(**obj_in_data)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update_transcript(
        self, db: Session, *, db_obj: Transcript, obj_in: TranscriptUpdate
    ) -> Transcript:
        """
        文字起こし更新
        
        Args:
            db: データベースセッション
            db_obj: 更新対象文字起こし
            obj_in: 更新データ
            
        Returns:
            Transcript: 更新された文字起こし
        """
        update_data = obj_in.dict(exclude_unset=True)
        
        # 基本フィールドの更新
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# CRUD文字起こしのインスタンス
transcript = CRUDTranscript(Transcript)

# 互換性のための別名エクスポート
crud_transcript = transcript
