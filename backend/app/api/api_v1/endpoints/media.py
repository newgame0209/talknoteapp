"""
しゃべるノート - メディアアセットエンドポイント
メディアアセットの作成・取得・更新・削除APIを提供
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import asyncio

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
    MediaAssetList,
    UploadUrlRequest,
    UploadUrlResponse,
    ChunkUploadResponse,
    CompleteUploadRequest,
    MediaStatusResponse
)
from app.utils.pubsub import pubsub_client
from app.providers.storage import get_storage_provider

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
    # メディアアセットの取得
    media = media_asset.get(db, id=media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media asset not found")
    
    # ページの取得
    page_obj = page.get(db, id=media.page_id)
    if not page_obj:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # ノートブックの取得
    notebook_obj = notebook.get(db, id=page_obj.notebook_id)
    if not notebook_obj:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    # アクセス権限の確認
    if notebook_obj.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # メディアアセットの削除
    media = media_asset.remove(db, id=media_id)
    return media


# チャンク分割アップロード関連エンドポイント

@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    *,
    request: UploadUrlRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    アップロード用の署名付きURLを生成
    
    - **file_type**: ファイルのMIMEタイプ
    - **file_size**: ファイルサイズ（バイト）
    - **chunk_size**: チャンクサイズ（バイト）（オプション）
    - **total_chunks**: 全チャンク数（オプション）
    """
    # ストレージプロバイダーの取得
    storage_provider = get_storage_provider()
    
    # メディアIDの生成
    media_id = str(uuid4())
    
    # アップロードURLの生成
    result = await storage_provider.generate_upload_url(
        media_id=media_id,
        file_type=request.file_type,
        file_size=request.file_size,
        user_id=current_user["uid"],
        expires_in=3600
    )
    
    return result


@router.post("/upload-chunk", response_model=ChunkUploadResponse)
async def upload_chunk(
    *,
    media_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    チャンクデータをアップロード
    
    - **media_id**: メディアID
    - **chunk_index**: チャンクインデックス（0から始まる）
    - **total_chunks**: 全チャンク数
    - **chunk**: チャンクデータ
    """
    # ストレージプロバイダーの取得
    storage_provider = get_storage_provider()
    
    # チャンクデータのアップロード
    result = await storage_provider.upload_chunk(
        media_id=media_id,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
        chunk_data=chunk.file,
        user_id=current_user["uid"]
    )
    
    return result


@router.post("/complete-upload", response_model=MediaStatusResponse)
async def complete_upload(
    *,
    request: CompleteUploadRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    チャンクアップロードの完了処理
    
    - **media_id**: メディアID
    - **total_chunks**: 全チャンク数
    - **total_size**: 合計サイズ（バイト）
    - **md5_hash**: MD5ハッシュ（オプション）
    """
    # ストレージプロバイダーの取得
    storage_provider = get_storage_provider()
    
    # アップロード完了処理
    result = await storage_provider.complete_upload(
        media_id=request.media_id,
        total_chunks=request.total_chunks,
        total_size=request.total_size,
        md5_hash=request.md5_hash,
        user_id=current_user["uid"]
    )
    
    return result


@router.get("/status/{media_id}", response_model=MediaStatusResponse)
async def get_media_status(
    *,
    media_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    メディア処理状況を取得
    
    - **media_id**: メディアID
    """
    # ストレージプロバイダーの取得
    storage_provider = get_storage_provider()
    
    # メディア処理状況の取得
    result = await storage_provider.get_media_status(
        media_id=media_id,
        user_id=current_user["uid"]
    )
    
    return result


# テスト用エンドポイント（開発環境のみ）

@router.post("/test-upload/{media_id}")
async def test_upload(
    *,
    media_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks
) -> Any:
    """
    テスト用アップロードエンドポイント
    開発環境でのテスト用で、認証なしでアクセス可能
    """
    if not settings.DEBUG:
        raise HTTPException(status_code=403, detail="This endpoint is only available in debug mode")
    
    # テスト用ディレクトリの作成
    test_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "test_uploads")
    os.makedirs(test_uploads_dir, exist_ok=True)
    
    # ファイルの保存
    file_path = os.path.join(test_uploads_dir, f"{media_id}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    
    # 非同期処理のシミュレーション
    def process_file():
        # 処理時間のシミュレーション
        import time
        time.sleep(5)
    
    background_tasks.add_task(process_file)
    
    return {"status": "success", "message": "File uploaded successfully", "media_id": media_id}
