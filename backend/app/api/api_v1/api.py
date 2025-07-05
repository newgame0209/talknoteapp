"""
しゃべるノート - API v1 ルーター
各エンドポイントのルーターをまとめる
"""
from fastapi import APIRouter

# 各エンドポイント用のルーター
from app.api.api_v1.endpoints import notebooks, pages, media, transcripts, stt, tts, pubsub, health, ocr, handwriting_tts, photo_scan
from app.api.api_v1.endpoints.ai.router import router as ai_router
from app.api.api_v1.endpoints import imports

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

# インポートエンドポイントの登録
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])

# 🆕 写真スキャンエンドポイントの登録
api_router.include_router(photo_scan.router, prefix="/photo-scan", tags=["photo-scan"])

# 手書きOCR→TTSエンドポイントの登録
api_router.include_router(handwriting_tts.router, prefix="", tags=["handwriting"])

# ヘルスチェック・メトリクスエンドポイントの登録（認証不要）
api_router.include_router(health.router, tags=["health"])
