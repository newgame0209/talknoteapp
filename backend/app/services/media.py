"""
しゃべるノート - メディアアセットCRUDサービス
メディアアセットの作成・取得・更新・削除操作を提供
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.media import MediaAsset, MediaType, ProcessingStatus
from app.schemas.media import MediaAssetCreate, MediaAssetUpdate
from app.services.base import CRUDBase


class CRUDMediaAsset(CRUDBase[MediaAsset, MediaAssetCreate, MediaAssetUpdate]):
    """メディアアセットCRUDサービス"""
    
    def get_by_page(
        self, db: Session, *, page_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[MediaAsset]:
        """
        ページIDに基づくメディアアセット一覧取得
        
        Args:
            db: データベースセッション
            page_id: ページID
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[MediaAsset]: メディアアセットリスト
        """
        return (
            db.query(MediaAsset)
            .filter(MediaAsset.page_id == page_id)
            .order_by(MediaAsset.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_count_by_page(self, db: Session, *, page_id: UUID) -> int:
        """
        ページIDに基づくメディアアセット数取得
        
        Args:
            db: データベースセッション
            page_id: ページID
            
        Returns:
            int: メディアアセット数
        """
        return (
            db.query(func.count(MediaAsset.id))
            .filter(MediaAsset.page_id == page_id)
            .scalar()
        )
    
    def get_by_type(
        self, db: Session, *, page_id: UUID, media_type: MediaType, skip: int = 0, limit: int = 100
    ) -> List[MediaAsset]:
        """
        ページIDとメディアタイプに基づくメディアアセット一覧取得
        
        Args:
            db: データベースセッション
            page_id: ページID
            media_type: メディアタイプ
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[MediaAsset]: メディアアセットリスト
        """
        return (
            db.query(MediaAsset)
            .filter(
                MediaAsset.page_id == page_id,
                MediaAsset.media_type == media_type
            )
            .order_by(MediaAsset.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def create_with_page(
        self, db: Session, *, obj_in: MediaAssetCreate
    ) -> MediaAsset:
        """
        ページ付きメディアアセット作成
        
        Args:
            db: データベースセッション
            obj_in: 作成データ
            
        Returns:
            MediaAsset: 作成されたメディアアセット
        """
        obj_in_data = obj_in.dict()
        db_obj = MediaAsset(**obj_in_data)
        
        # 初期状態を設定
        db_obj.status = ProcessingStatus.PENDING
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update_status(
        self, db: Session, *, db_obj: MediaAsset, status: ProcessingStatus, error_message: Optional[str] = None
    ) -> MediaAsset:
        """
        メディアアセットの処理状態を更新
        
        Args:
            db: データベースセッション
            db_obj: 更新対象メディアアセット
            status: 新しい処理状態
            error_message: エラーメッセージ（失敗時）
            
        Returns:
            MediaAsset: 更新されたメディアアセット
        """
        db_obj.status = status
        
        if status == ProcessingStatus.COMPLETED or status == ProcessingStatus.FAILED:
            db_obj.processed_at = datetime.utcnow()
        
        if error_message:
            db_obj.error_message = error_message
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# CRUDメディアアセットのインスタンス
media_asset = CRUDMediaAsset(MediaAsset)
