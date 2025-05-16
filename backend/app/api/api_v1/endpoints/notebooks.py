"""
しゃべるノート - ノートブックエンドポイント
ノートブックの作成・取得・更新・削除APIを提供
"""
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.notebook import notebook
from app.schemas.notebook import (
    Notebook,
    NotebookCreate,
    NotebookUpdate,
    NotebookList
)

router = APIRouter()


@router.get("/", response_model=NotebookList)
async def get_notebooks(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = Query(None)
) -> Any:
    """
    ユーザーのノートブック一覧を取得
    
    - **skip**: スキップするノートブック数
    - **limit**: 取得するノートブック数（最大100）
    - **search**: 検索クエリ（タイトルと説明で検索）
    """
    user_id = current_user["uid"]
    
    # 検索クエリがある場合は検索、ない場合は全件取得
    if search:
        notebooks = notebook.search_by_user(
            db=db, user_id=user_id, query=search, skip=skip, limit=limit
        )
        total = len(notebooks)  # 簡易実装（本来はカウントクエリを別途実行）
    else:
        notebooks = notebook.get_by_user(
            db=db, user_id=user_id, skip=skip, limit=limit
        )
        total = notebook.get_count_by_user(db=db, user_id=user_id)
    
    return {"items": notebooks, "total": total}


@router.post("/", response_model=Notebook)
async def create_notebook(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Any:
    """
    新規ノートブックを作成
    
    デフォルトタイトルは現在の日付で自動生成されます。
    """
    # 現在の日付でデフォルトタイトルを生成
    now = datetime.now()
    default_title = f"{now.year}年{now.month}月{now.day}日のノート"
    
    # 空のノートブックを作成
    notebook_in = NotebookCreate(
        title=default_title,
        description="",
        tags=[]
    )
    
    return notebook.create_with_owner(
        db=db, obj_in=notebook_in, user_id=current_user["uid"]
    )


@router.get("/{notebook_id}", response_model=Notebook)
async def get_notebook(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    notebook_id: str = Path(..., title="ノートブックID")
) -> Any:
    """
    特定のノートブックを取得
    
    - **notebook_id**: 取得するノートブックのID
    """
    db_notebook = notebook.get(db=db, id=notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    # 所有者チェック
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このノートブックにアクセスする権限がありません")
    
    # 論理削除チェック
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    return db_notebook


@router.patch("/{notebook_id}", response_model=Notebook)
async def update_notebook(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    notebook_id: str = Path(..., title="ノートブックID"),
    notebook_in: NotebookUpdate
) -> Any:
    """
    ノートブックを更新
    
    - **notebook_id**: 更新するノートブックのID
    - **notebook_in**: 更新データ（タイトル、説明、フォルダ、タグ）
    """
    db_notebook = notebook.get(db=db, id=notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    # 所有者チェック
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このノートブックを更新する権限がありません")
    
    # 論理削除チェック
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    return notebook.update_notebook(db=db, db_obj=db_notebook, obj_in=notebook_in)


@router.delete("/{notebook_id}", response_model=Notebook)
async def delete_notebook(
    *,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    notebook_id: str = Path(..., title="ノートブックID")
) -> Any:
    """
    ノートブックを論理削除
    
    - **notebook_id**: 削除するノートブックのID
    """
    db_notebook = notebook.get(db=db, id=notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    # 所有者チェック
    if db_notebook.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="このノートブックを削除する権限がありません")
    
    # 論理削除チェック
    if db_notebook.deleted:
        raise HTTPException(status_code=404, detail="ノートブックが見つかりません")
    
    return notebook.soft_delete(db=db, db_obj=db_notebook)
