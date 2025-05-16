"""
しゃべるノート - ページエンドポイント
ページの作成・取得・更新・削除APIを提供
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.page import page
from app.services.notebook import notebook
from app.schemas.page import (
    Page,
    PageCreate,
    PageUpdate,
    PageList
)

router = APIRouter()


@router.get("/", response_model=PageList)
async def get_pages(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    notebook_id: UUID = Query(..., title="ノートブックID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
) -> Any:
    """
    ノートブックに属するページ一覧を取得
    
    - **notebook_id**: ノートブックID
    - **skip**: スキップするページ数
    - **limit**: 取得するページ数（最大100）
    """
    # ノートブックの存在確認と所有者チェック
    db_notebook = notebook.get(db=db, id=notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このノートブックにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    # ページ一覧を取得
    pages = page.get_by_notebook(
        db=db, notebook_id=notebook_id, skip=skip, limit=limit
    )
    total = page.get_count_by_notebook(db=db, notebook_id=notebook_id)
    
    return {"items": pages, "total": total}


@router.post("/", response_model=Page)
async def create_page(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    page_in: PageCreate
) -> Any:
    """
    新規ページを作成
    
    - **page_in**: ページ作成データ（ノートブックID、タイトル、ページ番号、キャンバスデータ）
    """
    # ノートブックの存在確認と所有者チェック
    db_notebook = notebook.get(db=db, id=page_in.notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このノートブックにページを追加する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    # ページを作成
    return page.create_with_notebook(db=db, obj_in=page_in)


@router.get("/{page_id}", response_model=Page)
async def get_page(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    page_id: UUID = Path(..., title="ページID")
) -> Any:
    """
    特定のページを取得
    
    - **page_id**: 取得するページのID
    """
    db_page = page.get(db=db, id=page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このページにアクセスする権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    return db_page


@router.patch("/{page_id}", response_model=Page)
async def update_page(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    page_id: UUID = Path(..., title="ページID"),
    page_in: PageUpdate
) -> Any:
    """
    ページを更新
    
    - **page_id**: 更新するページのID
    - **page_in**: 更新データ（タイトル、ページ番号、キャンバスデータ）
    """
    db_page = page.get(db=db, id=page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このページを更新する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    return page.update_page(db=db, db_obj=db_page, obj_in=page_in)


@router.delete("/{page_id}", response_model=Page)
async def delete_page(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    page_id: UUID = Path(..., title="ページID")
) -> Any:
    """
    ページを削除
    
    - **page_id**: 削除するページのID
    """
    db_page = page.get(db=db, id=page_id)
    if not db_page:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    # ノートブックの所有者チェック
    db_notebook = notebook.get(db=db, id=db_page.notebook_id)
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このページを削除する権限がありません")
    
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ページが見つかりません")
    
    return page.remove(db=db, id=page_id)
