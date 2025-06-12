"""
依存関係の定義
認証、データベース、その他の共通依存関係を提供します
"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from app.core.settings import settings

logger = logging.getLogger(__name__)

# HTTPベアラー認証スキーム
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    現在のユーザー情報を取得します。
    認証が有効な場合はFirebase IDトークンを検証し、
    開発環境では認証バイパスも可能です。
    
    Args:
        credentials: Authorization ヘッダーから取得した認証情報
        
    Returns:
        Optional[Dict[str, Any]]: ユーザー情報（認証済みの場合）
        
    Raises:
        HTTPException: 認証が必要だが無効な場合
    """
    # 認証バイパスが有効な場合（開発環境）
    if settings.BYPASS_AUTH:
        logger.debug("認証バイパスが有効です")
        return {
            "uid": "test-user-id",
            "email": settings.TEST_USER_EMAIL,
            "name": "Test User",
            "verified": True
        }
    
    # 認証情報が提供されていない場合
    if not credentials:
        logger.warning("認証情報が提供されていません")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証が必要です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # TODO: Firebase IDトークンの検証を実装
        # import firebase_admin
        # from firebase_admin import auth
        # 
        # decoded_token = auth.verify_id_token(credentials.credentials)
        # return {
        #     "uid": decoded_token["uid"],
        #     "email": decoded_token.get("email"),
        #     "name": decoded_token.get("name"),
        #     "verified": decoded_token.get("email_verified", False)
        # }
        
        # 暫定的な実装（デモ用）
        logger.info(f"認証トークン受信: {credentials.credentials[:10]}...")
        return {
            "uid": "authenticated-user",
            "email": "user@example.com",
            "name": "Authenticated User",
            "verified": True
        }
        
    except Exception as e:
        logger.error(f"認証トークンの検証に失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証トークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    現在のユーザー情報を取得します（オプション）。
    認証エラーが発生してもNoneを返し、例外は発生させません。
    
    Args:
        credentials: Authorization ヘッダーから取得した認証情報
        
    Returns:
        Optional[Dict[str, Any]]: ユーザー情報（認証済みの場合のみ）
    """
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_auth(user: Optional[Dict[str, Any]] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    認証を必須とする依存関数。
    ユーザーが認証されていない場合は例外を発生させます。
    
    Args:
        user: get_current_userから取得したユーザー情報
        
    Returns:
        Dict[str, Any]: 認証済みユーザー情報
        
    Raises:
        HTTPException: ユーザーが認証されていない場合
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証が必要です"
        )
    return user


def get_user_id(user: Dict[str, Any] = Depends(require_auth)) -> str:
    """
    認証済みユーザーのIDを取得します。
    
    Args:
        user: 認証済みユーザー情報
        
    Returns:
        str: ユーザーID
    """
    return user["uid"]


async def get_request_info(request: Request) -> Dict[str, Any]:
    """
    リクエスト情報を取得します。
    
    Args:
        request: FastAPIリクエストオブジェクト
        
    Returns:
        Dict[str, Any]: リクエスト情報
    """
    return {
        "method": request.method,
        "url": str(request.url),
        "headers": dict(request.headers),
        "client_host": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent")
    } 