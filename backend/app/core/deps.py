"""
しゃべるノート - 依存関係
FastAPIのDependency Injectionで使用する依存関係の定義
"""
import logging
from typing import Dict, Any, Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.settings import settings

# ロギング設定
logger = logging.getLogger(__name__)

# セキュリティスキーム
security = HTTPBearer()


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    現在のユーザー情報を取得する
    
    Args:
        request: リクエスト情報
        credentials: 認証情報
        
    Returns:
        Dict[str, Any]: ユーザー情報
        
    Raises:
        HTTPException: 認証エラー
    """
    # テスト環境では認証をバイパス
    if settings.BYPASS_AUTH:
        return {
            "uid": "test-user-id",
            "email": settings.TEST_USER_EMAIL,
            "name": "テストユーザー"
        }
    
    # 本番環境では認証トークンを検証
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証情報がありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # ここでFirebase Authなどで認証トークンを検証する
        # 実際の実装では、Firebase Admin SDKを使用してトークンを検証し、
        # ユーザー情報を取得する
        
        # 仮実装（実際にはトークンを検証する）
        return {
            "uid": "user-id",
            "email": "user@example.com",
            "name": "ユーザー名"
        }
    except Exception as e:
        logger.error(f"認証エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証トークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )
