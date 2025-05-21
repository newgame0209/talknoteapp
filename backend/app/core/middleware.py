"""
しゃべるノート - ミドルウェア
アプリケーション全体で使用するミドルウェア
"""
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.api_v1.endpoints.health import REQUEST_COUNT, REQUEST_LATENCY, ACTIVE_REQUESTS


class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Prometheusメトリクス収集ミドルウェア
    リクエスト数、レイテンシ、アクティブリクエスト数を記録
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method
        path = request.url.path
        
        # パスが静的ファイルやメトリクスエンドポイント自体の場合はスキップ
        if path.startswith(("/static", "/docs", "/redoc", "/openapi.json")) or path == "/api/v1/metrics":
            return await call_next(request)
        
        # アクティブリクエストをインクリメント
        ACTIVE_REQUESTS.labels(method=method, endpoint=path).inc()
        
        # リクエスト開始時間を記録
        start_time = time.time()
        
        try:
            # リクエスト処理
            response = await call_next(request)
            
            # レスポンスステータスコードを取得
            status_code = response.status_code
            
            # リクエスト数をインクリメント
            REQUEST_COUNT.labels(
                method=method, endpoint=path, status_code=status_code
            ).inc()
            
            # リクエスト処理時間を記録
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(
                time.time() - start_time
            )
            
            return response
            
        except Exception as e:
            # エラー時もメトリクスを記録
            REQUEST_COUNT.labels(
                method=method, endpoint=path, status_code=500
            ).inc()
            
            # リクエスト処理時間を記録
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(
                time.time() - start_time
            )
            
            raise e
            
        finally:
            # アクティブリクエストをデクリメント
            ACTIVE_REQUESTS.labels(method=method, endpoint=path).dec()
