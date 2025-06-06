"""
OCR API Endpoints

OCR（光学文字認識）機能のAPIエンドポイントです。
画像をアップロードしてテキストを抽出する機能を提供します。
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
import io
import base64

from app.core.auth import get_current_user
from app.models.user import User
from app.services.ocr import ocr_service
from app.providers.ocr.base import OCRError
from app.schemas.ocr import OCRResponse, OCRRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/extract-text", response_model=OCRResponse)
async def extract_text_from_image(
    file: UploadFile = File(..., description="画像ファイル（JPEG, PNG, WEBP, BMP対応）"),
    language_hints: Optional[str] = Form(None, description="言語ヒント（カンマ区切り、例: 'ja,en')"),
    provider: Optional[str] = Form(None, description="使用するOCRプロバイダー"),
    current_user: User = Depends(get_current_user)
):
    """
    アップロードされた画像からテキストを抽出
    
    マルチパート形式で画像ファイルをアップロードし、OCR処理を実行してテキストを抽出します。
    Google Cloud Vision APIなどの複数のOCRプロバイダーをサポートしています。
    
    Args:
        file: アップロードする画像ファイル（JPEG, PNG, WEBP, BMP形式をサポート）
        language_hints: OCR処理時の言語ヒント（カンマ区切り）
        provider: 使用するOCRプロバイダー（指定しない場合はデフォルトを使用）
        current_user: 認証済みユーザー情報
        
    Returns:
        OCRResponse: 抽出されたテキストと関連情報
        
    Raises:
        HTTPException: ファイル形式が不正、OCR処理エラー、認証エラーなど
    """
    logger.info(f"OCRテキスト抽出開始 - ユーザー: {_get_user_uid(current_user)}")
    
    # ファイル形式チェック
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="画像ファイルのみサポートしています"
        )
    
    # ファイルサイズチェック（10MB制限）
    max_file_size = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_file_size:
        raise HTTPException(
            status_code=413,
            detail="ファイルサイズが10MBを超えています"
        )
    
    try:
        # 言語ヒントの処理
        languages = []
        if language_hints:
            languages = [lang.strip() for lang in language_hints.split(',')]
        
        # OCR実行
        result = await ocr_service.extract_text_from_image(
            image_data=content,
            provider_name=provider,
            language_hints=languages
        )
        
        # 結果をログ出力
        confidence_percentage = result.confidence * 100 if result.confidence else 0
        logger.info(
            f"OCR処理完了 - 信頼度: {confidence_percentage:.1f}%, "
            f"言語: {result.language}, プロバイダー: {result.metadata.get('provider') if result.metadata else 'unknown'}"
        )
        
        # レスポンス作成
        return OCRResponse(
            text=result.text,
            confidence=result.confidence,
            language=result.language,
            provider=result.metadata.get('provider') if result.metadata else None,
            bounding_boxes=result.bounding_boxes,
            metadata=result.metadata
        )
        
    except OCRError as e:
        logger.error(f"OCR処理エラー: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=422,
            detail=f"OCR処理エラー: {str(e)}"
        )
    except Exception as e:
        logger.error(f"OCR処理エラー: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="テキスト抽出処理中にエラーが発生しました"
        )


@router.get("/providers")
async def get_available_providers(
    current_user: User = Depends(get_current_user)
):
    """
    利用可能なOCRプロバイダーの一覧を取得
    
    Returns:
        dict: 利用可能なプロバイダーのリスト
    """
    try:
        providers = ocr_service.get_available_providers()
        
        # 各プロバイダーの詳細情報を取得
        provider_details = []
        for provider_name in providers:
            is_available = ocr_service.is_provider_available(provider_name)
            provider_info = {
                "name": provider_name,
                "available": is_available,
                "description": _get_provider_description(provider_name)
            }
            provider_details.append(provider_info)
        
        return {
            "providers": provider_details,
            "default_provider": "google_vision" if "google_vision" in providers else providers[0] if providers else None
        }
        
    except Exception as e:
        user_id = getattr(current_user, 'uid', current_user.get('uid', 'unknown-user'))
        logger.error(f"Error getting OCR providers for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="プロバイダー情報の取得中にエラーが発生しました")


@router.post("/extract-text-base64", response_model=OCRResponse)
async def extract_text_from_base64(
    request: OCRRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Base64エンコードされた画像からテキストを抽出
    
    Base64形式の画像データを受け取り、OCR処理を実行してテキストを抽出します。
    フロントエンドからの直接的な画像データ送信に対応しています。
    
    Args:
        request: Base64画像データと処理オプションを含むリクエスト
        current_user: 認証済みユーザー情報
        
    Returns:
        OCRResponse: 抽出されたテキストと関連情報
        
    Raises:
        HTTPException: Base64データが不正、OCR処理エラー、認証エラーなど
    """
    logger.info(f"Base64 OCRテキスト抽出開始 - ユーザー: {_get_user_uid(current_user)}")
    
    try:
        # Base64データの検証と変換
        if not request.image_data.startswith('data:image/'):
            raise HTTPException(
                status_code=400,
                detail="有効なBase64画像データではありません"
            )
        
        # MIMEタイプとBase64データを分離
        header, encoded = request.image_data.split(',', 1)
        
        # Base64デコード
        try:
            image_bytes = base64.b64decode(encoded)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Base64データのデコードに失敗しました"
            )
        
        # ファイルサイズチェック（10MB制限）
        max_file_size = 10 * 1024 * 1024  # 10MB
        if len(image_bytes) > max_file_size:
            raise HTTPException(
                status_code=413,
                detail="ファイルサイズが10MBを超えています"
            )
        
        # OCR実行
        result = await ocr_service.extract_text_from_image(
            image_data=image_bytes,
            provider_name=request.provider,
            language_hints=request.language_hints
        )
        
        # 結果をログ出力
        confidence_percentage = result.confidence * 100 if result.confidence else 0
        logger.info(
            f"Base64 OCR処理完了 - 信頼度: {confidence_percentage:.1f}%, "
            f"言語: {result.language}, プロバイダー: {result.metadata.get('provider') if result.metadata else 'unknown'}"
        )
        
        # レスポンス作成
        return OCRResponse(
            text=result.text,
            confidence=result.confidence,
            language=result.language,
            provider=result.metadata.get('provider') if result.metadata else None,
            bounding_boxes=result.bounding_boxes,
            metadata=result.metadata
        )
        
    except HTTPException:
        # HTTPExceptionはそのまま再発生
        raise
    except OCRError as e:
        logger.error(f"Base64 OCR処理エラー: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=422,
            detail=f"OCR処理エラー: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in Base64 OCR endpoint for user {_get_user_uid(current_user)}: {e}")
        raise HTTPException(
            status_code=500,
            detail="テキスト抽出処理中にエラーが発生しました"
        )


def _get_user_uid(user) -> str:
    """
    ユーザーオブジェクトからUIDを安全に取得
    認証バイパス時の辞書形式と通常時のオブジェクト形式の両方に対応
    """
    if isinstance(user, dict):
        return user.get('uid', 'unknown')
    else:
        return getattr(user, 'uid', 'unknown')


def _get_provider_description(provider_name: str) -> str:
    """
    プロバイダーの説明を取得
    
    Args:
        provider_name: プロバイダー名
        
    Returns:
        str: プロバイダーの説明
    """
    descriptions = {
        "google_vision": "Google Cloud Vision API - 高精度な日本語・英語OCR",
        "aws_textract": "Amazon Textract - 文書レイアウト解析対応",
        "azure_computer_vision": "Azure Computer Vision - Microsoft OCRサービス"
    }
    return descriptions.get(provider_name, f"{provider_name} OCR provider") 