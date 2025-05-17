"""
テスト用の簡易FastAPIサーバー
- 認証をバイパス
- Google Cloud依存を最小化
- メディアアップロードAPIのみ実装
"""
from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID, uuid4
import os
from typing import Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum
import logging

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# アプリケーション初期化
app = FastAPI(title="しゃべるノート テスト用API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# モデル定義
class MediaType(str, Enum):
    AUDIO = "audio"
    IMAGE = "image"
    PDF = "pdf"
    URL = "url"

class MediaUploadRequest(BaseModel):
    notebook_id: UUID
    page_id: UUID
    media_type: MediaType
    filename: str
    content_type: str

class MediaUploadResponse(BaseModel):
    media_id: str
    upload_url: str

class MediaStatus(BaseModel):
    media_id: str
    status: str
    progress: Optional[float] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

# メディアIDとステータスを保持する辞書
media_status_store = {}

@app.get("/")
async def root():
    return {"message": "しゃべるノート テスト用API"}

@app.post("/api/v1/media/upload-url", response_model=MediaUploadResponse)
async def create_upload_url(request: MediaUploadRequest):
    """
    メディアアップロード用の署名付きURLを生成する
    テスト用に簡易的なURLを返す
    """
    media_id = str(uuid4())
    
    # ローカルのテスト用ディレクトリを作成
    os.makedirs("./test_uploads", exist_ok=True)
    
    # テスト用の署名付きURL（ローカルサーバーのエンドポイント）
    upload_url = f"http://localhost:8000/api/v1/media/test-upload/{media_id}"
    
    # 初期ステータスを設定
    media_status_store[media_id] = {
        "media_id": media_id,
        "status": "pending",
        "progress": 0.0,
        "result": None,
        "error": None
    }
    
    logger.info(f"メディアアップロードURL生成: media_id={media_id}")
    return {"media_id": media_id, "upload_url": upload_url}

@app.put("/api/v1/media/test-upload/{media_id}")
async def test_upload(media_id: str, file_data: bytes = Body(...)):
    """
    テスト用のファイルアップロードエンドポイント
    """
    if media_id not in media_status_store:
        raise HTTPException(status_code=404, detail="メディアIDが見つかりません")
    
    try:
        # ファイルを保存
        file_path = f"./test_uploads/{media_id}"
        with open(file_path, "wb") as f:
            f.write(file_data)
        
        file_size = os.path.getsize(file_path)
        logger.info(f"ファイルアップロード成功: media_id={media_id}, size={file_size}バイト")
        
        # ステータスを更新
        media_status_store[media_id]["status"] = "processing"
        media_status_store[media_id]["progress"] = 0.5
        
        # 実際のシステムではここでPub/Subメッセージを発行してワーカーを起動
        # テスト用に少し待ってからステータスを完了に更新
        import threading
        def complete_processing():
            import time
            time.sleep(3)  # 3秒後に処理完了とする
            media_status_store[media_id]["status"] = "completed"
            media_status_store[media_id]["progress"] = 1.0
            media_status_store[media_id]["result"] = {
                "transcript": "これはテスト用の文字起こし結果です。",
                "duration": 5.0,
                "language": "ja-JP"
            }
            logger.info(f"処理完了: media_id={media_id}")
        
        threading.Thread(target=complete_processing).start()
        
        return {"status": "uploaded"}
    except Exception as e:
        logger.error(f"アップロードエラー: {str(e)}")
        media_status_store[media_id]["status"] = "failed"
        media_status_store[media_id]["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/media/{media_id}/status", response_model=MediaStatus)
async def get_media_status(media_id: str):
    """
    メディア処理のステータスを取得
    """
    if media_id not in media_status_store:
        raise HTTPException(status_code=404, detail="メディアIDが見つかりません")
    
    return media_status_store[media_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
