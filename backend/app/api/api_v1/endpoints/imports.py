"""
Import API Endpoints

インポート機能のAPIエンドポイントです。
URLインポートとファイルインポートの処理機能を提供します。
"""

import logging
import json
import asyncio
from typing import Any, Dict, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.import_schema import (
    URLImportRequest,
    FileImportRequest,
    ImportResponse,
    ImportStatusResponse,
    ImportResultDetail,
    ImportListResponse,
    ImportType,
    ImportStatus
)
from app.services.file_processor import file_processor, FileProcessorError
from app.services.url_importer import url_importer, URLImportError
from app.services.ai.service import AIService
from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)

router = APIRouter()

# 進行中のインポート処理を管理する辞書（本来はRedis等で管理）
import_jobs: Dict[str, Dict[str, Any]] = {}


@router.post("/url", response_model=ImportResponse)
async def import_from_url(
    *,
    request: URLImportRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    URLからノートをインポート
    
    - **url**: インポート対象のURL（Webページ、YouTube等）
    - **extract_options**: 抽出オプション（字幕言語等）
    - **auto_title**: AIによる自動タイトル生成
    - **auto_split**: 自動ページ分割
    """
    try:
        # インポートIDを生成
        import_id = str(uuid4())
        
        # URL形式のチェック
        if not url_importer.is_url_supported(str(request.url)):
            raise HTTPException(
                status_code=400,
                detail="サポートされていないURL形式です"
            )
        
        # インポートジョブを登録
        job_info = {
            "import_id": import_id,
            "import_type": ImportType.URL,
            "status": ImportStatus.PENDING,
            "progress": 0.0,
            "source_info": {
                "url": str(request.url),
                "auto_title": request.auto_title,
                "auto_split": request.auto_split,
                "extract_options": request.extract_options
            },
            "user_id": current_user["uid"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        import_jobs[import_id] = job_info
        
        # バックグラウンドでインポート処理を実行
        background_tasks.add_task(
            _process_url_import,
            import_id,
            str(request.url),
            request.extract_options,
            request.auto_title,
            request.auto_split,
            current_user["uid"]
        )
        
        logger.info(f"URL import started: {import_id}, URL: {request.url}")
        
        return ImportResponse(
            import_id=import_id,
            import_type=ImportType.URL,
            status=ImportStatus.PENDING,
            source_info=job_info["source_info"],
            created_at=job_info["created_at"],
            estimated_completion_time=30  # 30秒程度を想定
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting URL import: {e}")
        raise HTTPException(
            status_code=500,
            detail="URLインポートの開始中にエラーが発生しました"
        )


@router.post("/file", response_model=ImportResponse)
async def import_from_file(
    *,
    request: FileImportRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    ファイルからノートをインポート
    
    - **media_id**: アップロード済みファイルのメディアID
    - **extract_options**: 抽出オプション（エンコーディング等）
    - **auto_title**: AIによる自動タイトル生成
    - **auto_split**: 自動ページ分割
    """
    try:
        # インポートIDを生成
        import_id = str(uuid4())
        
        # メディアIDの存在確認（ストレージプロバイダー経由）
        storage_provider = get_storage_provider()
        
        try:
            # メディア情報の取得を試行
            media_status = await storage_provider.get_media_status(
                request.media_id,
                current_user["uid"]
            )
            
            if media_status.get("status") != "completed":
                raise HTTPException(
                    status_code=400,
                    detail="ファイルのアップロードが完了していません"
                )
                
        except Exception as e:
            logger.warning(f"Could not verify media status for {request.media_id}: {e}")
            # メディア状況が取得できない場合は処理を続行
            pass
        
        # インポートジョブを登録
        job_info = {
            "import_id": import_id,
            "import_type": ImportType.FILE,
            "status": ImportStatus.PENDING,
            "progress": 0.0,
            "source_info": {
                "media_id": request.media_id,
                "auto_title": request.auto_title,
                "auto_split": request.auto_split,
                "extract_options": request.extract_options
            },
            "user_id": current_user["uid"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        import_jobs[import_id] = job_info
        
        # バックグラウンドでインポート処理を実行
        background_tasks.add_task(
            _process_file_import,
            import_id,
            request.media_id,
            request.extract_options,
            request.auto_title,
            request.auto_split,
            current_user["uid"]
        )
        
        logger.info(f"File import started: {import_id}, Media ID: {request.media_id}")
        
        return ImportResponse(
            import_id=import_id,
            import_type=ImportType.FILE,
            status=ImportStatus.PENDING,
            source_info=job_info["source_info"],
            created_at=job_info["created_at"],
            estimated_completion_time=60  # 60秒程度を想定
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting file import: {e}")
        raise HTTPException(
            status_code=500,
            detail="ファイルインポートの開始中にエラーが発生しました"
        )


@router.get("/status/{import_id}", response_model=ImportStatusResponse)
async def get_import_status(
    *,
    import_id: str = Path(..., description="インポート処理ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    インポート処理の状況を取得
    
    - **import_id**: インポート処理ID
    """
    if import_id not in import_jobs:
        raise HTTPException(
            status_code=404,
            detail="指定されたインポート処理が見つかりません"
        )
    
    job_info = import_jobs[import_id]
    
    # ユーザー権限チェック
    if job_info["user_id"] != current_user["uid"]:
        raise HTTPException(
            status_code=403,
            detail="このインポート処理にアクセスする権限がありません"
        )
    
    return ImportStatusResponse(
        import_id=import_id,
        import_type=job_info["import_type"],
        status=job_info["status"],
        progress=job_info.get("progress", 0.0),
        note_id=job_info.get("note_id"),
        total_pages=job_info.get("total_pages"),
        extracted_text_length=job_info.get("extracted_text_length"),
        title=job_info.get("title"),
        error_message=job_info.get("error_message"),
        error_code=job_info.get("error_code"),
        created_at=job_info["created_at"],
        updated_at=job_info["updated_at"],
        completed_at=job_info.get("completed_at")
    )


@router.get("/result/{import_id}", response_model=ImportResultDetail)
async def get_import_result(
    *,
    import_id: str = Path(..., description="インポート処理ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    インポート処理の詳細結果を取得
    
    - **import_id**: インポート処理ID
    """
    if import_id not in import_jobs:
        raise HTTPException(
            status_code=404,
            detail="指定されたインポート処理が見つかりません"
        )
    
    job_info = import_jobs[import_id]
    
    # ユーザー権限チェック
    if job_info["user_id"] != current_user["uid"]:
        raise HTTPException(
            status_code=403,
            detail="このインポート処理にアクセスする権限がありません"
        )
    
    # 処理完了チェック
    if job_info["status"] != ImportStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="インポート処理が完了していません"
        )
    
    return ImportResultDetail(
        note_id=job_info["note_id"],
        title=job_info["title"],
        total_pages=job_info["total_pages"],
        pages=job_info.get("pages", []),
        source_metadata=job_info.get("source_metadata", {}),
        extraction_metadata=job_info.get("extraction_metadata", {}),
        processing_time=job_info.get("processing_time", 0.0),
        created_at=job_info["created_at"]
    )


@router.get("/history", response_model=ImportListResponse)
async def get_import_history(
    *,
    current_user: Dict[str, Any] = Depends(get_current_user),
    page: int = Query(1, ge=1, description="ページ番号"),
    page_size: int = Query(20, ge=1, le=100, description="ページサイズ"),
    import_type: Optional[ImportType] = Query(None, description="インポートタイプでフィルタ"),
    status: Optional[ImportStatus] = Query(None, description="ステータスでフィルタ")
) -> Any:
    """
    インポート履歴を取得
    
    - **page**: ページ番号（1から開始）
    - **page_size**: ページサイズ（最大100）
    - **import_type**: インポートタイプでフィルタ
    - **status**: ステータスでフィルタ
    """
    user_id = current_user["uid"]
    
    # ユーザーのインポート履歴をフィルタ
    user_imports = [
        job for job in import_jobs.values()
        if job["user_id"] == user_id
    ]
    
    # フィルタ適用
    if import_type:
        user_imports = [job for job in user_imports if job["import_type"] == import_type]
    
    if status:
        user_imports = [job for job in user_imports if job["status"] == status]
    
    # 作成日時でソート（新しい順）
    user_imports.sort(key=lambda x: x["created_at"], reverse=True)
    
    # ページネーション
    total = len(user_imports)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = user_imports[start_idx:end_idx]
    
    # レスポンス作成
    items = [
        ImportStatusResponse(
            import_id=job["import_id"],
            import_type=job["import_type"],
            status=job["status"],
            progress=job.get("progress", 0.0),
            note_id=job.get("note_id"),
            total_pages=job.get("total_pages"),
            extracted_text_length=job.get("extracted_text_length"),
            title=job.get("title"),
            error_message=job.get("error_message"),
            error_code=job.get("error_code"),
            created_at=job["created_at"],
            updated_at=job["updated_at"],
            completed_at=job.get("completed_at")
        ) for job in page_items
    ]
    
    return ImportListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=end_idx < total
    )


# バックグラウンド処理関数
async def _process_url_import(
    import_id: str,
    url: str,
    extract_options: Dict[str, Any],
    auto_title: bool,
    auto_split: bool,
    user_id: str
):
    """URLインポートのバックグラウンド処理"""
    job_info = import_jobs[import_id]
    
    try:
        # ステータス更新：処理中
        job_info.update({
            "status": ImportStatus.PROCESSING,
            "progress": 0.1,
            "updated_at": datetime.utcnow()
        })
        
        # URLからテキスト抽出
        logger.info(f"Starting URL extraction for import {import_id}")
        extraction_result = await url_importer.extract_text_from_url(url, extract_options)
        
        job_info.update({
            "progress": 0.5,
            "updated_at": datetime.utcnow()
        })
        
        # AIタイトル生成（オプション）
        title = extraction_result.get('title', 'Imported Note')
        if auto_title and extraction_result.get('text'):
            try:
                ai_service = AIService()
                title = await ai_service.generate_title(extraction_result['text'][:500])
                logger.info(f"AI title generated for import {import_id}: {title}")
            except Exception as e:
                logger.warning(f"AI title generation failed for import {import_id}: {e}")
                title = extraction_result.get('title', 'Imported Note')
        
        job_info.update({
            "progress": 0.7,
            "updated_at": datetime.utcnow()
        })
        
        # ノート作成（複数ページ対応）
        note_id = f"import_{import_id}"
        extracted_text = extraction_result['text']
        
        # 🆕 Phase 3: Feature Flag対応のページ分割処理
        pages = []
        from app.core.settings import settings
        
        if auto_split and len(extracted_text) > 2000 and settings.IMPORT_SPLIT_ENABLED:
            # 🆕 Phase 1のチャンク分割機能を使用
            from app.services.url_importer import _split_into_chunks
            text_chunks = _split_into_chunks(extracted_text, max_chars=2000)
            logger.info(f"Split text into {len(text_chunks)} chunks for import {import_id}")
            
            for i, chunk in enumerate(text_chunks):
                pages.append({
                    "page_number": i + 1,
                    "text": chunk,
                    "text_length": len(chunk),
                    "is_ai_enhanced": False  # AI整形は後で実装
                })
        else:
            # 従来の1ページ形式（Feature Flag OFF または 2000文字以下）
            pages.append({
                "page_number": 1,
                "text": extracted_text,
                "text_length": len(extracted_text),
                "is_ai_enhanced": False
            })
        
        # 処理完了
        job_info.update({
            "status": ImportStatus.COMPLETED,
            "progress": 1.0,
            "note_id": note_id,
            "title": title,
            "total_pages": len(pages),
            "pages": pages,
            "extracted_text_length": len(extracted_text),
            "source_metadata": extraction_result.get('metadata', {}),
            "extraction_metadata": {
                "source_type": extraction_result.get('source_type'),
                "extraction_time": datetime.utcnow().isoformat()
            },
            "processing_time": (datetime.utcnow() - job_info["created_at"]).total_seconds(),
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        })
        
        logger.info(f"URL import completed successfully: {import_id}")
        
    except URLImportError as e:
        logger.error(f"URL import error for {import_id}: {e}")
        job_info.update({
            "status": ImportStatus.FAILED,
            "error_message": str(e),
            "error_code": "URL_IMPORT_ERROR",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in URL import {import_id}: {e}")
        job_info.update({
            "status": ImportStatus.FAILED,
            "error_message": "予期しないエラーが発生しました",
            "error_code": "INTERNAL_ERROR",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        })


async def _process_file_import(
    import_id: str,
    media_id: str,
    extract_options: Dict[str, Any],
    auto_title: bool,
    auto_split: bool,
    user_id: str
):
    """ファイルインポートのバックグラウンド処理"""
    job_info = import_jobs[import_id]
    
    try:
        # ステータス更新：処理中
        job_info.update({
            "status": ImportStatus.PROCESSING,
            "progress": 0.1,
            "updated_at": datetime.utcnow()
        })
        
        # ストレージからファイルデータを取得
        storage_provider = get_storage_provider()
        
        # TODO: 実際のファイルダウンロード処理
        # 現在はダミー実装
        logger.info(f"Starting file processing for import {import_id}, media_id: {media_id}")
        
        # ダミーファイルデータ（実際の実装では storage_provider.download_file() を使用）
        file_data = b"Dummy file content for testing"
        filename = f"imported_file_{media_id}.txt"
        
        job_info.update({
            "progress": 0.3,
            "updated_at": datetime.utcnow()
        })
        
        # ファイルからテキスト抽出
        extraction_result = await file_processor.extract_text_from_file(
            file_data, filename
        )
        
        job_info.update({
            "progress": 0.6,
            "updated_at": datetime.utcnow()
        })
        
        # AIタイトル生成（オプション）
        title = f"Imported from {filename}"
        if auto_title and extraction_result.get('text'):
            try:
                ai_service = AIService()
                title = await ai_service.generate_title(extraction_result['text'][:500])
                logger.info(f"AI title generated for import {import_id}: {title}")
            except Exception as e:
                logger.warning(f"AI title generation failed for import {import_id}: {e}")
        
        job_info.update({
            "progress": 0.8,
            "updated_at": datetime.utcnow()
        })
        
        # ノート作成（複数ページ対応）
        note_id = f"import_{import_id}"
        extracted_text = extraction_result['text']
        
        # 自動ページ分割処理
        pages = []
        if auto_split and len(extracted_text) > 2000:
            # 2000文字ごとに分割
            text_chunks = [extracted_text[i:i+2000] for i in range(0, len(extracted_text), 2000)]
            for i, chunk in enumerate(text_chunks):
                pages.append({
                    "page_number": i + 1,
                    "text": chunk,
                    "text_length": len(chunk)
                })
        else:
            pages.append({
                "page_number": 1,
                "text": extracted_text,
                "text_length": len(extracted_text)
            })
        
        # 処理完了
        job_info.update({
            "status": ImportStatus.COMPLETED,
            "progress": 1.0,
            "note_id": note_id,
            "title": title,
            "total_pages": len(pages),
            "pages": pages,
            "extracted_text_length": len(extracted_text),
            "source_metadata": extraction_result.get('metadata', {}),
            "extraction_metadata": {
                "source_type": extraction_result.get('source_type'),
                "extraction_time": datetime.utcnow().isoformat()
            },
            "processing_time": (datetime.utcnow() - job_info["created_at"]).total_seconds(),
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        })
        
        logger.info(f"File import completed successfully: {import_id}")
        
    except FileProcessorError as e:
        logger.error(f"File import error for {import_id}: {e}")
        job_info.update({
            "status": ImportStatus.FAILED,
            "error_message": str(e),
            "error_code": "FILE_IMPORT_ERROR",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in file import {import_id}: {e}")
        job_info.update({
            "status": ImportStatus.FAILED,
            "error_message": "予期しないエラーが発生しました",
            "error_code": "INTERNAL_ERROR",
            "updated_at": datetime.utcnow(),
            "completed_at": datetime.utcnow()
        }) 