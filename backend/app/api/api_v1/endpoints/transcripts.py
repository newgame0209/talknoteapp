"""
しゃべるノート - 文字起こしエンドポイント
文字起こしの作成・取得・更新・削除APIを提供
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.transcript import transcript
from app.services.media import media_asset
from app.services.page import page
from app.services.notebook import notebook
from app.models.media import MediaType
from app.schemas.transcript import (
    Transcript,
    TranscriptCreate,
    TranscriptUpdate,
    TranscriptList
)

router = APIRouter()


@router.get("/", response_model=TranscriptList)
async def get_transcripts(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    media_asset_id: UUID = Query(..., title="メディアアセットID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
) -> Any:
    """
    メディアアセットに属する文字起こし一覧を取得
    
    - **media_asset_id**: メディアアセットID
    - **skip**: スキップする文字起こし数
    - **limit**: 取得する文字起こし数（最大100）
    """
    # メディアアセットの存在確認
    db_media = media_asset.get(db=db, id=media_asset_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # メディアタイプが音声であることを確認
    if db_media.media_type != MediaType.AUDIO:
        raise HTTPException(status_code=400, detail="音声メディアのみ文字起こしを持つことができます")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="この文字起こしにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    # 文字起こし一覧を取得
    transcripts = transcript.get_by_media_asset(
        db=db, media_asset_id=media_asset_id, skip=skip, limit=limit
    )
    total = transcript.get_count_by_media_asset(db=db, media_asset_id=media_asset_id)
    
    return {"items": transcripts, "total": total}


@router.post("/", response_model=Transcript)
async def create_transcript(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    transcript_in: TranscriptCreate
) -> Any:
    """
    新規文字起こしを作成
    
    - **transcript_in**: 文字起こし作成データ（メディアアセットID、プロバイダー、テキスト、時間情報など）
    """
    # メディアアセットの存在確認
    db_media = media_asset.get(db=db, id=transcript_in.media_asset_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # メディアタイプが音声であることを確認
    if db_media.media_type != MediaType.AUDIO:
        raise HTTPException(status_code=400, detail="音声メディアのみ文字起こしを持つことができます")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="この文字起こしを作成する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # 同じプロバイダーの文字起こしが既に存在するか確認
    existing_transcript = transcript.get_by_provider(
        db=db, media_asset_id=transcript_in.media_asset_id, provider=transcript_in.provider
    )
    
    if existing_transcript:
        # 既存の文字起こしを更新
        update_data = TranscriptUpdate(
            text=transcript_in.text,
            confidence=transcript_in.confidence,
            transcript_metadata=transcript_in.transcript_metadata
        )
        return transcript.update_transcript(db=db, db_obj=existing_transcript, obj_in=update_data)
    
    # 新規文字起こしを作成
    return transcript.create_with_media_asset(db=db, obj_in=transcript_in)


@router.get("/{transcript_id}", response_model=Transcript)
async def get_transcript(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    transcript_id: UUID = Path(..., title="文字起こしID")
) -> Any:
    """
    特定の文字起こしを取得
    
    - **transcript_id**: 取得する文字起こしのID
    """
    db_transcript = transcript.get(db=db, id=transcript_id)
    if not db_transcript:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    # メディアアセットの存在確認
    db_media = media_asset.get(db=db, id=db_transcript.media_asset_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="この文字起こしにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    return db_transcript


@router.patch("/{transcript_id}", response_model=Transcript)
async def update_transcript(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    transcript_id: UUID = Path(..., title="文字起こしID"),
    transcript_in: TranscriptUpdate
) -> Any:
    """
    文字起こしを更新
    
    - **transcript_id**: 更新する文字起こしのID
    - **transcript_in**: 更新データ（テキスト、信頼度、メタデータなど）
    """
    db_transcript = transcript.get(db=db, id=transcript_id)
    if not db_transcript:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    # メディアアセットの存在確認
    db_media = media_asset.get(db=db, id=db_transcript.media_asset_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="この文字起こしを更新する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    return transcript.update_transcript(db=db, db_obj=db_transcript, obj_in=transcript_in)


@router.delete("/{transcript_id}", response_model=Transcript)
async def delete_transcript(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    transcript_id: UUID = Path(..., title="文字起こしID")
) -> Any:
    """
    文字起こしを削除
    
    - **transcript_id**: 削除する文字起こしのID
    """
    db_transcript = transcript.get(db=db, id=transcript_id)
    if not db_transcript:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    # メディアアセットの存在確認
    db_media = media_asset.get(db=db, id=db_transcript.media_asset_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="メディアアセットが見つかりません")
    
    # ページの存在確認
    db_page = page.get(db=db, id=db_media.page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="この文字起こしを削除する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="文字起こしが見つかりません")
    
    return transcript.remove(db=db, id=transcript_id)
