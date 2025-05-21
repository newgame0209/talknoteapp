"""
しゃべるノート - ヘルスチェックエンドポイント
アプリケーションの状態、バージョン、メトリクスを提供
"""
import os
import time
import platform
from typing import Dict, Any

from fastapi import APIRouter, Response
from prometheus_client import (
    generate_latest, 
    CONTENT_TYPE_LATEST,
    Counter, 
    Histogram, 
    Gauge
)

from app.core.settings import settings

router = APIRouter()

# メトリクスの定義
REQUEST_COUNT = Counter(
    'talknote_request_count', 
    'Total number of requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_LATENCY = Histogram(
    'talknote_request_latency_seconds', 
    'Request latency in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'talknote_active_requests', 
    'Number of active requests',
    ['method', 'endpoint']
)

DB_POOL_SIZE = Gauge(
    'talknote_db_pool_size', 
    'Database connection pool size',
    ['status']
)

# 起動時間を記録
START_TIME = time.time()


@router.get("/version")
async def get_version() -> Dict[str, Any]:
    """
    アプリケーションのバージョン情報を取得
    
    Returns:
        Dict[str, Any]: バージョン情報
    """
    return {
        "app_name": "しゃべるノート API",
        "version": settings.VERSION,
        "environment": "production" if not settings.DEBUG else "development",
        "python_version": platform.python_version(),
        "uptime_seconds": int(time.time() - START_TIME),
    }


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    ヘルスチェックエンドポイント
    
    Returns:
        Dict[str, str]: ヘルスステータス
    """
    return {"status": "ok"}


@router.get("/metrics", response_class=Response)
async def metrics() -> Response:
    """
    Prometheusメトリクスエンドポイント
    
    Returns:
        Response: Prometheusフォーマットのメトリクス
    """
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
