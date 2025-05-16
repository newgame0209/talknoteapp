"""
しゃべるノート - API v1 ルーター
各エンドポイントのルーターをまとめる
"""
from fastapi import APIRouter

# 各エンドポイント用のルーター
from app.api.api_v1.endpoints import notebooks, pages, media, transcripts, stt
# 今後実装する各エンドポイント用のルーター
# from app.api.api_v1.endpoints import ai

api_router = APIRouter()

# エンドポイントの登録
api_router.include_router(notebooks.router, prefix="/notebooks", tags=["notebooks"])
api_router.include_router(pages.router, prefix="/pages", tags=["pages"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(transcripts.router, prefix="/transcripts", tags=["transcripts"])

# STTエンドポイントの登録
api_router.include_router(stt.router, prefix="/stt", tags=["stt"])

# 今後、以下のようにエンドポイントを追加していく
# api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
