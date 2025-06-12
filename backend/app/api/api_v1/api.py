"""
しゃべるノート - API v1 ルーター
各エンドポイントのルーターをまとめる
"""
from fastapi import APIRouter

# 各エンドポイント用のルーター
from app.api.api_v1.endpoints import notebooks, pages, media, transcripts, stt, tts, pubsub, health, ocr
from app.api.api_v1.endpoints.ai.router import router as ai_router

api_router = APIRouter()

# エンドポイントの登録
api_router.include_router(notebooks.router, prefix="/notebooks", tags=["notebooks"])
api_router.include_router(pages.router, prefix="/pages", tags=["pages"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(transcripts.router, prefix="/transcripts", tags=["transcripts"])

# STTエンドポイントの登録
api_router.include_router(stt.router, prefix="/stt", tags=["stt"])

# TTSエンドポイントの登録
api_router.include_router(tts.router, prefix="/tts", tags=["tts"])

# Pub/Subエンドポイントの登録
api_router.include_router(pubsub.router, prefix="/pubsub", tags=["pubsub"])

# AIエンドポイントの登録
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])

# OCRエンドポイントの登録
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])

# ヘルスチェック・メトリクスエンドポイントの登録（認証不要）
api_router.include_router(health.router, tags=["health"])
