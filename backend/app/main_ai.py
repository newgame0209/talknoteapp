"""
しゃべるノート – AI専用サーバー
依存の少ないルートだけを公開
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
import time

from app.core.settings import settings
# AIエンドポイントのルーターをインポート
from app.api.api_v1.endpoints.ai.router import router as ai_router

def create_application() -> FastAPI:
    """AI専用アプリケーションファクトリ"""
    application = FastAPI(
        title=f"{settings.PROJECT_NAME} (AI-only)",
        version=settings.VERSION,
        openapi_url="/openapi.json",
        docs_url=None,  # カスタムSwaggerUI
        redoc_url="/redoc",
    )

    # CORS設定
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # カスタムSwaggerUI（アクセストークン対応）
    @application.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url=application.openapi_url,
            title=f"{settings.PROJECT_NAME} (AI-only) - Swagger UI",
            oauth2_redirect_url=application.swagger_ui_oauth2_redirect_url,
            swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js",
            swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css",
        )

    # リクエスト処理時間ミドルウェア
    @application.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

    # ヘルスチェックエンドポイント
    @application.get("/healthz", tags=["Health"])
    def health_check():
        """
        ヘルスチェックエンドポイント
        """
        return {"status": "ok"}

    # バージョン情報エンドポイント
    @application.get("/version", tags=["Health"])
    def version():
        """
        バージョン情報を返す
        """
        return {
            "version": settings.VERSION,
            "environment": "development" if settings.DEBUG else "production"
        }

    # AIルーターをマウント
    application.include_router(ai_router, prefix=settings.API_V1_STR)

    return application


app = create_application()
