"""
写真スキャン専用API
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import JSONResponse
from typing import List, Optional
import base64
import uuid
from datetime import datetime
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.providers.storage import get_storage_provider
from app.core.settings import settings
from app.core.database import get_db
from app.services.page import page as page_service
from sqlalchemy.orm import Session

router = APIRouter()

class PhotoScanImagePayload(BaseModel):
    note_id: str
    page_id: str
    image_base64: str

@router.post("/save-page")
async def save_photo_scan_page(
    note_id: str = Form(...),
    page_id: str = Form(...),
    page_number: int = Form(...),
    notebook_id: str = Form(...),
    content: str = Form(...),
    image_base64: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    写真スキャンページを保存（画像 + データベース統合）
    
    Args:
        note_id: ノートID
        page_id: ページID
        page_number: ページ番号
        notebook_id: ノートブックID
        content: ページコンテンツ
        image_base64: Base64エンコードされた画像データ（オプション）
        metadata: ページメタデータ（JSON文字列、オプション）
        current_user: 認証済みユーザー
        db: データベースセッション
    
    Returns:
        保存結果の辞書
    """
    try:
        user_id = current_user.get("uid")
        
        # 画像データの処理
        image_data = None
        if image_base64:
            try:
                # data:image/jpeg;base64, のプレフィックスを除去
                if image_base64.startswith('data:'):
                    image_base64 = image_base64.split(',')[1]
                
                image_data = base64.b64decode(image_base64)
            except Exception as decode_error:
                raise HTTPException(
                    status_code=400,
                    detail=f"Base64デコードエラー: {str(decode_error)}"
                )
        
        # メタデータの処理
        page_metadata = {}
        if metadata:
            try:
                import json
                page_metadata = json.loads(metadata)
            except Exception as json_error:
                print(f"⚠️ メタデータJSONパースエラー: {json_error}")
        
        # ページ保存サービスを呼び出し
        result = await page_service.save_photo_page(
            db=db,
            note_id=note_id,
            page_id=page_id,
            page_number=page_number,
            notebook_id=uuid.UUID(notebook_id),
            content=content,
            image_data=image_data,
            user_id=user_id,
            metadata=page_metadata
        )
        
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "ページ保存に失敗しました")
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "写真スキャンページ保存が完了しました",
                **result
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ページ保存処理でエラーが発生しました: {str(e)}"
        )

@router.post("/save-multiple-pages")
async def save_multiple_photo_scan_pages(
    note_id: str = Form(...),
    notebook_id: str = Form(...),
    pages_data: str = Form(...),  # JSON文字列
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    複数の写真スキャンページを一括保存
    
    Args:
        note_id: ノートID
        notebook_id: ノートブックID
        pages_data: ページデータのJSON文字列
        current_user: 認証済みユーザー
        db: データベースセッション
    
    Returns:
        一括保存結果の辞書
    """
    try:
        user_id = current_user.get("uid")
        
        # ページデータのパース
        try:
            import json
            pages_list = json.loads(pages_data)
        except Exception as json_error:
            raise HTTPException(
                status_code=400,
                detail=f"ページデータJSONパースエラー: {str(json_error)}"
            )
        
        if not isinstance(pages_list, list) or len(pages_list) == 0:
            raise HTTPException(
                status_code=400,
                detail="無効なページデータです"
            )
        
        if len(pages_list) > 10:  # 最大10ページ制限
            raise HTTPException(
                status_code=400,
                detail="ページは最大10ページまで保存できます"
            )
        
        # 各ページのBase64画像データをバイナリに変換
        processed_pages = []
        for i, page_data in enumerate(pages_list):
            processed_page = page_data.copy()
            
            # 画像データの処理
            if page_data.get("image_base64"):
                try:
                    image_base64 = page_data["image_base64"]
                    if image_base64.startswith('data:'):
                        image_base64 = image_base64.split(',')[1]
                    
                    processed_page["image_data"] = base64.b64decode(image_base64)
                    del processed_page["image_base64"]  # Base64文字列は削除
                except Exception as decode_error:
                    print(f"⚠️ ページ{i+1}の画像デコードエラー: {decode_error}")
                    processed_page["image_data"] = None
            
            processed_pages.append(processed_page)
        
        # 一括保存サービスを呼び出し
        result = await page_service.save_multiple_photo_pages(
            db=db,
            note_id=note_id,
            notebook_id=uuid.UUID(notebook_id),
            pages_data=processed_pages,
            user_id=user_id
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"{result.get('successful_pages', 0)}ページの保存が完了しました",
                **result
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"一括ページ保存処理でエラーが発生しました: {str(e)}"
        )

@router.post("/upload-images")
async def upload_photo_scan_images(
    note_id: str = Form(...),
    page_ids: List[str] = Form(...),
    images: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    storage_provider = Depends(get_storage_provider)
):
    """
    写真スキャン画像を複数ページ対応で保存
    
    Args:
        note_id: ノートID
        page_ids: ページIDのリスト
        images: アップロードする画像ファイルのリスト
        current_user: 認証済みユーザー
        storage_provider: ストレージプロバイダー
    
    Returns:
        保存結果の辞書
    """
    try:
        user_id = current_user.get("uid")
        
        # バリデーション
        if len(page_ids) != len(images):
            raise HTTPException(
                status_code=400,
                detail=f"ページID数({len(page_ids)})と画像数({len(images)})が一致しません"
            )
        
        if len(images) > 10:  # 最大10ページ制限
            raise HTTPException(
                status_code=400,
                detail="画像は最大10枚まで保存できます"
            )
        
        upload_results = []
        
        # 各画像を保存
        for i, (page_id, image_file) in enumerate(zip(page_ids, images)):
            # 画像データを読み取り
            image_data = await image_file.read()
            
            # JPEG形式でない場合は変換が必要かもしれませんが、
            # 現在は受け取った画像をそのまま保存
            if not image_file.content_type.startswith('image/'):
                raise HTTPException(
                    status_code=400,
                    detail=f"ページ{i+1}: 無効なファイル形式 {image_file.content_type}"
                )
            
            # ストレージプロバイダーに保存
            result = await storage_provider.upload_photo_scan_image(
                note_id=note_id,
                page_id=page_id,
                image_data=image_data,
                user_id=user_id
            )
            
            if result.get("status") == "error":
                raise HTTPException(
                    status_code=500,
                    detail=f"ページ{i+1}の画像保存に失敗: {result.get('error')}"
                )
            
            upload_results.append({
                "page_id": page_id,
                "page_number": i + 1,
                "status": "success",
                "file_path": result.get("file_path"),
                "local_url": result.get("local_url"),
                "gcs_url": result.get("gcs_url")
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "note_id": note_id,
                "total_pages": len(upload_results),
                "uploaded_images": upload_results,
                "message": f"{len(upload_results)}ページの画像保存が完了しました"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"画像保存処理でエラーが発生しました: {str(e)}"
        )

@router.post("/upload-image-base64")
async def upload_photo_scan_image_base64(
    payload: Optional[PhotoScanImagePayload] = Body(None),
    note_id: Optional[str] = None,
    page_id: Optional[str] = None,
    image_base64: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    storage_provider = Depends(get_storage_provider)
):
    """
    Base64エンコードされた写真スキャン画像を保存
    
    Args:
        payload: 画像データのペイロード
        note_id: ノートID
        page_id: ページID
        image_base64: Base64エンコードされた画像データ
        current_user: 認証済みユーザー
        storage_provider: ストレージプロバイダー
    
    Returns:
        保存結果の辞書
    """
    try:
        user_id = current_user.get("uid")
        
        # 🆕 パラメータ解決
        if payload is not None:
            note_id = payload.note_id
            page_id = payload.page_id
            image_base64 = payload.image_base64
        if not (note_id and page_id and image_base64):
            raise HTTPException(status_code=422, detail="note_id, page_id, image_base64 は必須です")
        
        # Base64デコード
        try:
            # data:image/jpeg;base64, のプレフィックスを除去
            if image_base64.startswith('data:'):
                image_base64 = image_base64.split(',')[1]
            
            image_data = base64.b64decode(image_base64)
        except Exception as decode_error:
            raise HTTPException(
                status_code=400,
                detail=f"Base64デコードエラー: {str(decode_error)}"
            )
        
        # ストレージプロバイダーに保存
        result = await storage_provider.upload_photo_scan_image(
            note_id=note_id,
            page_id=page_id,
            image_data=image_data,
            user_id=user_id
        )
        
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=f"画像保存に失敗: {result.get('error')}"
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "note_id": note_id,
                "page_id": page_id,
                "file_path": result.get("file_path"),
                "local_url": result.get("local_url"),
                "gcs_url": result.get("gcs_url"),
                "message": "画像保存が完了しました"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"画像保存処理でエラーが発生しました: {str(e)}"
        )

@router.get("/image/{note_id}/{page_id}")
async def get_photo_scan_image_url(
    note_id: str,
    page_id: str,
    expires_in: int = 3600,
    current_user: dict = Depends(get_current_user),
    storage_provider = Depends(get_storage_provider)
):
    """
    写真スキャン画像のダウンロードURLを取得
    
    Args:
        note_id: ノートID
        page_id: ページID
        expires_in: URL有効期限（秒）
        current_user: 認証済みユーザー
        storage_provider: ストレージプロバイダー
    
    Returns:
        画像URLの辞書
    """
    try:
        # 画像URLを取得
        image_url = await storage_provider.get_photo_scan_image_url(
            note_id=note_id,
            page_id=page_id,
            expires_in=expires_in
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "note_id": note_id,
                "page_id": page_id,
                "image_url": image_url,
                "expires_in": expires_in
            }
        )
        
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"画像が見つかりません: {note_id}/{page_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"画像URL取得でエラーが発生しました: {str(e)}"
        )

@router.delete("/images/{note_id}")
async def delete_photo_scan_images(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    storage_provider = Depends(get_storage_provider)
):
    """
    写真スキャンノートの全画像を削除
    
    Args:
        note_id: ノートID
        current_user: 認証済みユーザー
        storage_provider: ストレージプロバイダー
    
    Returns:
        削除結果の辞書
    """
    try:
        # 画像を削除
        success = await storage_provider.delete_photo_scan_images(note_id)
        
        if success:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "note_id": note_id,
                    "message": "画像削除が完了しました"
                }
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="画像削除に失敗しました"
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"画像削除でエラーが発生しました: {str(e)}"
        ) 