"""
しゃべるノート - メディアアセットエンドポイント
メディアアセットの作成・取得・更新・削除APIを提供
"""
import json
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.media import media_asset
from app.services.page import page
from app.services.notebook import notebook
from app.models.media import MediaType, ProcessingStatus
from app.schemas.media import (
    MediaAsset,
    MediaAssetCreate,
    MediaAssetUpdate,
    MediaAssetList
)
from app.utils.pubsub import pubsub_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=MediaAssetList)
async def get_media_assets(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    page_id: UUID = Query(..., title="ページID"),
    media_type: Optional[MediaType] = Query(None, title="メディアタイプ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
) -> Any:
    """
    ページに属するメディアアセット一覧を取得
    
    - **page_id**: ページID
    - **media_type**: メディアタイプ（オプション）
    - **skip**: スキップするメディアアセット数
    - **limit**: 取得するメディアアセット数（最大100）
    """
    # ページの存在確認
    db_page = page.get(db=db, id=page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このページのメディアアセットにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # メディアアセット一覧を取得
    if media_type:
        assets = media_asset.get_by_type(
            db=db, page_id=page_id, media_type=media_type, skip=skip, limit=limit
        )
        # 簡易実装（本来はカウントクエリを別途実行）
        total = len(assets)
    else:
        assets = media_asset.get_by_page(
            db=db, page_id=page_id, skip=skip, limit=limit
        )
        total = media_asset.get_count_by_page(db=db, page_id=page_id)
    
    return {"items": assets, "total": total}


@router.post("/", response_model=MediaAsset)
async def create_media_asset(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    media_in: MediaAssetCreate
) -> Any:
    """
    新規メディアアセットを作成
    
    - **media_in**: メディアアセット作成データ（ページID、ファイル名、メディアタイプ、ストレージパス）
    """
    # ページの存在確認
    db_page = page.get(db=db, id=media_in.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このページにメディアアセットを追加する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # メディアアセットを作成
    new_media = media_asset.create_with_page(db=db, obj_in=media_in)
    
    # メディアタイプが処理対象の場合、Pub/Subメッセージを発行
    if new_media.media_type in [MediaType.AUDIO, MediaType.IMAGE, MediaType.PDF, MediaType.URL]:
        try:
            # Pub/Subメッセージを作成
            message = {
                "media_id": str(new_media.id),
                "media_type": new_media.media_type.value,
                "storage_path": new_media.storage_path,
                "user_id": current_user["uid"]
            }
            
            # Pub/Subメッセージを発行
            if settings.PUBSUB_ENABLED:
                pubsub_client.publish_message(
                    topic_id="media-new",
                    message=message,
                    attributes={
                        "media_type": new_media.media_type.value,
                        "user_id": current_user["uid"]
                    }
                )
                logger.info(f"Published media processing message for media_id: {new_media.id}")
            else:
                logger.info(f"Pub/Sub disabled, skipping message for media_id: {new_media.id}")
        except Exception as e:
            logger.error(f"Error publishing Pub/Sub message: {str(e)}")
            # メッセージ発行の失敗はユーザーに返さない
            # 後で再試行する仕組みを実装することも考えられる
    
    return new_media


@router.get("/{media_id}", response_model=MediaAsset)
async def get_media_asset(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    media_id: UUID = Path(..., title="メディアアセットID")
) -> Any:
    """
    特定のメディアアセットを取得
    
    - **media_id**: 取得するメディアアセットのID
    """
    db_media = media_asset.get(db=db, id=media_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このメディアアセットにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    return db_media


@router.patch("/{media_id}", response_model=MediaAsset)
async def update_media_asset(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    media_id: UUID = Path(..., title="メディアアセットID"),
    media_in: MediaAssetUpdate
) -> Any:
    """
    メディアアセットを更新
    
    - **media_id**: 更新するメディアアセットのID
    - **media_in**: 更新データ（ファイル名、処理状態、エラーメッセージなど）
    """
    db_media = media_asset.get(db=db, id=media_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このメディアアセットを更新する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    return media_asset.update(db=db, db_obj=db_media, obj_in=media_in)


@router.delete("/{media_id}", response_model=MediaAsset)
async def delete_media_asset(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    media_id: UUID = Path(..., title="メディアアセットID")
) -> Any:
    """
    メディアアセットを削除
    
    - **media_id**: 削除するメディアアセットのID
    """
    db_media = media_asset.get(db=db, id=media_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このメディアアセットを削除する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    return media_asset.remove(db=db, id=media_id)
