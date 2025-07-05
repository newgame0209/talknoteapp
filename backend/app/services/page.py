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
from app.providers.storage import get_storage_provider


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
    
    # 🆕 写真スキャン専用メソッド
    async def save_photo_page(
        self,
        db: Session,
        *,
        note_id: str,
        page_id: str,
        page_number: int,
        notebook_id: UUID,
        content: str,
        image_data: Optional[bytes] = None,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        写真スキャンページを保存（画像 + データベース）
        
        Args:
            db: データベースセッション
            note_id: ノートID
            page_id: ページID
            page_number: ページ番号
            notebook_id: ノートブックID
            content: ページコンテンツ（OCR/AI整形済みテキスト）
            image_data: 画像バイナリデータ（オプション）
            user_id: ユーザーID
            metadata: ページメタデータ（オプション）
            
        Returns:
            Dict[str, Any]: 保存結果
        """
        try:
            # Step 1: 画像をストレージに保存（画像データがある場合）
            image_storage_result = None
            if image_data:
                storage_provider = get_storage_provider()
                image_storage_result = await storage_provider.upload_photo_scan_image(
                    note_id=note_id,
                    page_id=page_id,
                    image_data=image_data,
                    user_id=user_id
                )
                
                if image_storage_result.get("status") != "success":
                    # 画像保存失敗でもページ作成は続行（グレースフルフォールバック）
                    print(f"⚠️ 画像保存失敗（ページ作成は続行）: {image_storage_result.get('error')}")
            
            # Step 2: ページメタデータの構築
            page_metadata = metadata or {}
            if image_storage_result:
                page_metadata.update({
                    "image_storage": {
                        "backend_stored": image_storage_result.get("status") == "success",
                        "file_path": image_storage_result.get("file_path"),
                        "local_url": image_storage_result.get("local_url"),
                        "gcs_url": image_storage_result.get("public_url"),
                        "stored_at": image_storage_result.get("created_at"),
                        "error": image_storage_result.get("error") if image_storage_result.get("status") != "success" else None
                    }
                })
            
            # Step 3: データベースにページを作成
            page_create_data = PageCreate(
                notebook_id=notebook_id,
                page_number=page_number,
                title=f"ページ {page_number}",
                content=content,
                content_type="photo_scan",
                metadata=page_metadata
            )
            
            db_page = self.create_with_notebook(db, obj_in=page_create_data)
            
            # Step 4: 保存結果の返却
            result = {
                "status": "success",
                "note_id": note_id,
                "page_id": page_id,
                "db_page_id": str(db_page.id),
                "page_number": page_number,
                "content_length": len(content),
                "image_stored": image_storage_result is not None and image_storage_result.get("status") == "success",
                "storage_result": image_storage_result,
                "metadata": page_metadata
            }
            
            print(f"✅ 写真スキャンページ保存完了: {page_id} (DB: {db_page.id})")
            return result
            
        except Exception as e:
            # エラーハンドリング
            error_message = f"写真スキャンページ保存エラー: {str(e)}"
            print(f"❌ {error_message}")
            
            return {
                "status": "error",
                "note_id": note_id,
                "page_id": page_id,
                "page_number": page_number,
                "error": error_message,
                "image_stored": False
            }
    
    async def save_multiple_photo_pages(
        self,
        db: Session,
        *,
        note_id: str,
        notebook_id: UUID,
        pages_data: List[Dict[str, Any]],
        user_id: str
    ) -> Dict[str, Any]:
        """
        複数の写真スキャンページを一括保存
        
        Args:
            db: データベースセッション
            note_id: ノートID
            notebook_id: ノートブックID
            pages_data: ページデータのリスト
            user_id: ユーザーID
            
        Returns:
            Dict[str, Any]: 一括保存結果
        """
        try:
            saved_pages = []
            failed_pages = []
            
            for i, page_data in enumerate(pages_data):
                page_id = page_data.get("page_id", f"{note_id}-page-{i}")
                
                try:
                    result = await self.save_photo_page(
                        db=db,
                        note_id=note_id,
                        page_id=page_id,
                        page_number=i + 1,
                        notebook_id=notebook_id,
                        content=page_data.get("content", ""),
                        image_data=page_data.get("image_data"),
                        user_id=user_id,
                        metadata=page_data.get("metadata")
                    )
                    
                    if result.get("status") == "success":
                        saved_pages.append(result)
                    else:
                        failed_pages.append(result)
                        
                except Exception as page_error:
                    failed_pages.append({
                        "page_id": page_id,
                        "page_number": i + 1,
                        "error": str(page_error)
                    })
            
            return {
                "status": "completed",
                "note_id": note_id,
                "total_pages": len(pages_data),
                "successful_pages": len(saved_pages),
                "failed_pages": len(failed_pages),
                "saved_pages": saved_pages,
                "failed_pages": failed_pages
            }
            
        except Exception as e:
            return {
                "status": "error",
                "note_id": note_id,
                "error": f"一括保存エラー: {str(e)}",
                "total_pages": len(pages_data),
                "successful_pages": 0,
                "failed_pages": len(pages_data)
            }


# CRUDページのインスタンス
page = CRUDPage(Page)
