"""
しゃべるノート - ノートブックCRUDサービス
ノートブックの作成・取得・更新・削除操作を提供
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.notebook import Notebook
from app.models.tag import Tag
from app.schemas.notebook import NotebookCreate, NotebookUpdate
from app.services.base import CRUDBase


class CRUDNotebook(CRUDBase[Notebook, NotebookCreate, NotebookUpdate]):
    """ノートブックCRUDサービス"""
    
    def get_by_user(
        self, db: Session, *, user_id: str, skip: int = 0, limit: int = 100
    ) -> List[Notebook]:
        """
        ユーザーIDに基づくノートブック一覧取得
        
        Args:
            db: データベースセッション
            user_id: ユーザーID
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[Notebook]: ノートブックリスト
        """
        return (
            db.query(Notebook)
            .filter(Notebook.user_id == user_id, Notebook.deleted == False)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_count_by_user(self, db: Session, *, user_id: str) -> int:
        """
        ユーザーIDに基づくノートブック数取得
        
        Args:
            db: データベースセッション
            user_id: ユーザーID
            
        Returns:
            int: ノートブック数
        """
        return (
            db.query(func.count(Notebook.id))
            .filter(Notebook.user_id == user_id, Notebook.deleted == False)
            .scalar()
        )
    
    def search_by_user(
        self, db: Session, *, user_id: str, query: str, skip: int = 0, limit: int = 100
    ) -> List[Notebook]:
        """
        ユーザーIDとクエリに基づくノートブック検索
        
        Args:
            db: データベースセッション
            user_id: ユーザーID
            query: 検索クエリ
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[Notebook]: ノートブックリスト
        """
        search_term = f"%{query}%"
        return (
            db.query(Notebook)
            .filter(
                Notebook.user_id == user_id,
                Notebook.deleted == False,
                or_(
                    Notebook.title.ilike(search_term),
                    Notebook.description.ilike(search_term)
                )
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def create_with_owner(
        self, db: Session, *, obj_in: NotebookCreate, user_id: str
    ) -> Notebook:
        """
        所有者付きノートブック作成
        
        Args:
            db: データベースセッション
            obj_in: 作成データ
            user_id: 所有者ID
            
        Returns:
            Notebook: 作成されたノートブック
        """
        obj_in_data = obj_in.dict(exclude={"tags"})
        
        # タイトル重複チェックと連番付加
        base_title = obj_in_data["title"]
        unique_title = base_title
        counter = 1
        
        # 同一ユーザーの同一タイトルのノートブックを検索
        while db.query(Notebook).filter(
            Notebook.user_id == user_id,
            Notebook.title == unique_title,
            Notebook.deleted == False
        ).first():
            # 重複がある場合は連番を付加
            unique_title = f"{base_title}({counter})"
            counter += 1
            
        # 一意なタイトルを設定
        obj_in_data["title"] = unique_title
        
        db_obj = Notebook(**obj_in_data, user_id=user_id)
        
        # タグの処理
        if obj_in.tags:
            for tag_name in obj_in.tags:
                # 既存のタグを検索
                tag = db.query(Tag).filter(
                    Tag.name == tag_name,
                    Tag.user_id == user_id
                ).first()
                
                # タグが存在しない場合は作成
                if not tag:
                    tag = Tag(name=tag_name, user_id=user_id)
                    db.add(tag)
                
                # ノートブックにタグを関連付け
                db_obj.tags.append(tag)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update_notebook(
        self, db: Session, *, db_obj: Notebook, obj_in: NotebookUpdate
    ) -> Notebook:
        """
        ノートブック更新（タグ処理含む）
        
        Args:
            db: データベースセッション
            db_obj: 更新対象ノートブック
            obj_in: 更新データ
            
        Returns:
            Notebook: 更新されたノートブック
        """
        update_data = obj_in.dict(exclude_unset=True, exclude={"tags"})
        
        # タイトル更新時の重複チェックと連番付加
        if "title" in update_data:
            base_title = update_data["title"]
            unique_title = base_title
            counter = 1
            
            # 同一ユーザーの同一タイトルのノートブックを検索（自分自身を除く）
            while db.query(Notebook).filter(
                Notebook.user_id == db_obj.user_id,
                Notebook.title == unique_title,
                Notebook.deleted == False,
                Notebook.id != db_obj.id  # 自分自身は除外
            ).first():
                # 重複がある場合は連番を付加
                unique_title = f"{base_title}({counter})"
                counter += 1
                
            # 一意なタイトルを設定
            update_data["title"] = unique_title
        
        # 基本フィールドの更新
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        
        # タグの処理
        if obj_in.tags is not None:
            # 既存のタグをクリア
            db_obj.tags = []
            
            # 新しいタグを設定
            for tag_name in obj_in.tags:
                # 既存のタグを検索
                tag = db.query(Tag).filter(
                    Tag.name == tag_name,
                    Tag.user_id == db_obj.user_id
                ).first()
                
                # タグが存在しない場合は作成
                if not tag:
                    tag = Tag(name=tag_name, user_id=db_obj.user_id)
                    db.add(tag)
                
                # ノートブックにタグを関連付け
                db_obj.tags.append(tag)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def soft_delete(self, db: Session, *, db_obj: Notebook) -> Notebook:
        """
        ノートブックの論理削除
        
        Args:
            db: データベースセッション
            db_obj: 削除対象ノートブック
            
        Returns:
            Notebook: 論理削除されたノートブック
        """
        from datetime import datetime
        
        db_obj.deleted = True
        db_obj.deleted_at = datetime.utcnow()
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# CRUDノートブックのインスタンス
notebook = CRUDNotebook(Notebook)
