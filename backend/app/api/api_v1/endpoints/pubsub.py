"""
しゃべるノート - Pub/Sub ハンドラーエンドポイント
Google Cloud Pub/Subからのメッセージを受信して処理します
"""
import base64
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.settings import settings
from app.workers.media_worker import process_media_task

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class PubSubMessage:
    """Pub/Subメッセージの構造"""
    
    def __init__(self, request_json: Dict[str, Any]):
        """
        Pub/Subメッセージを初期化
        
        Args:
            request_json: Pub/Subからのリクエストボディ
        """
        message = request_json.get("message", {})
        self.message_id = message.get("messageId")
        self.publish_time = message.get("publishTime")
        self.attributes = message.get("attributes", {})
        
        # Base64エンコードされたデータをデコード
        data = message.get("data", "")
        if data:
            decoded_data = base64.b64decode(data).decode("utf-8")
            self.data = json.loads(decoded_data)
        else:
            self.data = {}


@router.post("/media-new")
async def handle_media_new(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    新しいメディアアセットのPub/Subメッセージを処理
    
    Args:
        request: HTTPリクエスト
        db: データベースセッション
        
    Returns:
        処理結果
    """
    # リクエストボディを取得
    try:
        request_json = await request.json()
    except Exception as e:
        logger.error(f"Invalid request body: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request body"
        )
    
    # Pub/Subメッセージを解析
    try:
        message = PubSubMessage(request_json)
        logger.info(f"Received Pub/Sub message: {message.message_id}")
        
        # メディアIDを取得
        media_id = message.data.get("media_id")
        if not media_id:
            logger.error("Media ID not found in message")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Media ID not found in message"
            )
        
        # メディアを処理
        success = await process_media_task(db, media_id)
        
        if success:
            logger.info(f"Successfully processed media: {media_id}")
            return {"status": "success", "media_id": media_id}
        else:
            logger.error(f"Failed to process media: {media_id}")
            return {"status": "error", "media_id": media_id}
            
    except Exception as e:
        logger.exception(f"Error processing Pub/Sub message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing Pub/Sub message: {str(e)}"
        )
