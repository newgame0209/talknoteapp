"""
しゃべるノート - 認証ミドルウェア
Cloud Endpoints (ESPv2) から転送された検証済みクレームを取得する
バックアップとしてfirebase-adminによる二次検証も可能
"""
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status, Request, Header
import firebase_admin
from firebase_admin import credentials
import json

from app.core.settings import settings

# Firebase Admin SDK初期化 (二次検証用)
# 開発環境では認証をバイパスする場合は初期化しない
if not (settings.DEBUG and settings.BYPASS_AUTH):
    try:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
        firebase_app = firebase_admin.initialize_app(cred)
    except Exception as e:
        import logging
        logging.warning(f"Firebase初期化エラー: {e}")
        # 開発環境ではNoneで初期化
        firebase_app = None
else:
    firebase_app = None


async def get_current_user(
    request: Request,
    x_endpoint_api_userinfo: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Cloud Endpoints (ESPv2) から転送された検証済みクレームを取得する
    
    Args:
        request: FastAPIリクエストオブジェクト
        x_endpoint_api_userinfo: ESPv2から転送される検証済みクレーム（Base64エンコード）
        
    Returns:
        Dict[str, Any]: ユーザー情報
        
    Raises:
        HTTPException: 認証エラー
    """
    # ローカル開発環境用のバイパス（DEBUGモードのみ）
    if settings.DEBUG and settings.BYPASS_AUTH:
        return {
            "uid": "test-user-id",
            "email": "test@example.com",
            "email_verified": True,
            "name": "Test User",
            "picture": None,
        }
    
    if not x_endpoint_api_userinfo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証情報が見つかりません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Base64デコードしてJSONをパース
        import base64
        decoded_info = base64.b64decode(x_endpoint_api_userinfo).decode('utf-8')
        user_info = json.loads(decoded_info)
        
        # 必要なクレームが含まれているか確認
        if "sub" not in user_info:
            raise ValueError("ユーザーID (sub) が見つかりません")
        
        # ユーザー情報を返す
        return {
            "uid": user_info["sub"],
            "email": user_info.get("email"),
            "email_verified": user_info.get("email_verified", False),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
            "firebase": user_info,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"認証エラー: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
