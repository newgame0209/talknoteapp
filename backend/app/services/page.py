"""
しゃべるノート - ページCRUDサービス
ページの作成・取得・更新・削除操作を提供
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.page import Page
from app.schemas.page import PageCreate, PageUpdate
from app.services.base import CRUDBase


class CRUDPage(CRUDBase[Page, PageCreate, PageUpdate]):
    """ページCRUDサービス"""
    
    def get_by_notebook(
        self, db: Session, *, notebook_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Page]:
        """
        ノートブックIDに基づくページ一覧取得
        
        Args:
            db: データベースセッション
            notebook_id: ノートブックID
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[Page]: ページリスト
        """
        return (
            db.query(Page)
            .filter(Page.notebook_id == notebook_id)
            .order_by(Page.page_number)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_count_by_notebook(self, db: Session, *, notebook_id: UUID) -> int:
        """
        ノートブックIDに基づくページ数取得
        
        Args:
            db: データベースセッション
            notebook_id: ノートブックID
            
        Returns:
            int: ページ数
        """
        return (
            db.query(func.count(Page.id))
            .filter(Page.notebook_id == notebook_id)
            .scalar()
        )
    
    def create_with_notebook(
        self, db: Session, *, obj_in: PageCreate
    ) -> Page:
        """
        ノートブック付きページ作成
        
        Args:
            db: データベースセッション
            obj_in: 作成データ
            
        Returns:
            Page: 作成されたページ
        """
        # 同一ノートブック内の最大ページ番号を取得
        max_page_number = db.query(func.max(Page.page_number)).filter(
            Page.notebook_id == obj_in.notebook_id
        ).scalar() or 0
        
        # ページ番号が指定されていない場合は自動採番
        if obj_in.page_number <= 1:
            obj_in_data = obj_in.dict()
            obj_in_data["page_number"] = max_page_number + 1
        else:
            obj_in_data = obj_in.dict()
        
        db_obj = Page(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update_page(
        self, db: Session, *, db_obj: Page, obj_in: PageUpdate
    ) -> Page:
        """
        ページ更新
        
        Args:
            db: データベースセッション
            db_obj: 更新対象ページ
            obj_in: 更新データ
            
        Returns:
            Page: 更新されたページ
        """
        update_data = obj_in.dict(exclude_unset=True)
        
        # 基本フィールドの更新
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# CRUDページのインスタンス
page = CRUDPage(Page)
