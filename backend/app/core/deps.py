"""
しゃべるノート - 依存関係
FastAPIのDependency Injectionで使用する依存関係の定義
"""
import logging
from typing import Dict, Any, Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.core.database import get_db
from app.services.user import user as user_service

# ロギング設定
logger = logging.getLogger(__name__)

# セキュリティスキーム
security = HTTPBearer()

# Firebase Admin SDK初期化
# 開発環境では認証をバイパスする場合は初期化しない
if not (settings.DEBUG and settings.BYPASS_AUTH):
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
            firebase_app = firebase_admin.initialize_app(cred)
    except Exception as e:
        logger.warning(f"Firebase初期化エラー: {e}")
        # 開発環境ではNoneで初期化
        firebase_app = None
else:
    firebase_app = None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    現在のユーザー情報を取得する
    Firebase IDトークンを検証し、ユーザー情報を返す
    
    Args:
        request: リクエスト情報
        credentials: 認証情報 (Bearer token)
        
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
        # Firebase IDトークンを検証
        id_token = credentials.credentials
        decoded_token = auth.verify_id_token(id_token, check_revoked=True)
        
        # ユーザー情報を取得
        user_data = {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "email_verified": decoded_token.get("email_verified", False),
            "name": decoded_token.get("name"),
            "picture": decoded_token.get("picture"),
        }
        
        # ユーザーが存在しない場合は作成
        try:
            db_user = user_service.get_or_create(db, user_data)
            logger.info(f"User authenticated: {db_user.email}")
        except Exception as e:
            logger.error(f"Error creating/updating user: {e}")
            # エラーがあっても認証は続行（ユーザー作成は非クリティカル）
        
        # ユーザー情報を返す（Firebase認証情報も含む）
        return {
            **user_data,
            "firebase": decoded_token,  # 追加のクレームが必要な場合に備えて全体も保持
        }
    except auth.ExpiredIdTokenError:
        logger.warning("期限切れトークン")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンの期限が切れています",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.RevokedIdTokenError:
        logger.warning("失効済みトークン")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンが失効しています",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError:
        logger.warning("無効なトークン")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証トークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"認証エラー: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"認証エラー: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
