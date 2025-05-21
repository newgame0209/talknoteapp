"""
しゃべるノート - API v1 ルーター
各エンドポイントのルーターをまとめる
"""
from fastapi import APIRouter

# 各エンドポイント用のルーター
from app.api.api_v1.endpoints import notebooks, pages, media, transcripts, stt, pubsub, health
from app.api.api_v1.endpoints.ai import router as ai_router

api_router = APIRouter()

# エンドポイントの登録
api_router.include_router(notebooks.router, prefix="/notebooks", tags=["notebooks"])
api_router.include_router(pages.router, prefix="/pages", tags=["pages"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(transcripts.router, prefix="/transcripts", tags=["transcripts"])

# STTエンドポイントの登録
api_router.include_router(stt.router, prefix="/stt", tags=["stt"])

# Pub/Subエンドポイントの登録
api_router.include_router(pubsub.router, prefix="/pubsub", tags=["pubsub"])

# AIエンドポイントの登録
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])

# ヘルスチェック・メトリクスエンドポイントの登録（認証不要）
api_router.include_router(health.router, tags=["health"])
