"""
TTS (Text-to-Speech) API endpoints.

音声合成機能のREST APIを提供します。
"""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Response, Query, Body
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
import io
import mimetypes
import uuid
import tempfile
from pathlib import Path

from app.services.tts_service import tts_service
from app.providers.tts.base import VoiceInfo, SynthesisResult
from app.core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# === Request/Response Models ===

class TTSRequest(BaseModel):
    """TTS音声合成リクエスト"""
    text: str = Field(..., description="合成するテキスト", min_length=1, max_length=5000)
    voice_id: Optional[str] = Field(None, description="音声ID（プロバイダー固有）")
    language_code: str = Field("ja-JP", description="言語コード")
    speaking_rate: float = Field(1.0, description="話速（0.5-2.0）", ge=0.5, le=2.0)
    pitch: float = Field(0.0, description="ピッチ調整（-20.0~20.0）", ge=-20.0, le=20.0)
    volume_gain_db: float = Field(0.0, description="音量調整（-20.0~20.0）", ge=-20.0, le=20.0)
    audio_format: str = Field("mp3", description="出力形式（wav, mp3）")
    sample_rate_hertz: Optional[int] = Field(None, description="サンプルレート")
    provider_name: Optional[str] = Field(None, description="使用するプロバイダー名")


class TTSResponse(BaseModel):
    """TTS音声合成レスポンス"""
    success: bool = Field(..., description="処理成功フラグ")
    audio_url: Optional[str] = Field(None, description="音声ファイルのURL")
    duration_seconds: float = Field(..., description="音声の長さ（秒）")
    text: str = Field(..., description="合成されたテキスト")
    voice_info: Dict[str, Any] = Field(..., description="使用された音声情報")
    sentences: List[Dict[str, Any]] = Field(default_factory=list, description="文章別タイムスタンプ")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="メタデータ")


class VoiceInfoResponse(BaseModel):
    """音声情報レスポンス"""
    voice_id: str
    name: str
    language_code: str
    gender: str
    description: Optional[str] = None
    sample_rate_hertz: Optional[int] = None


class TTSStatusResponse(BaseModel):
    """TTSサービス状態レスポンス"""
    enabled: bool
    primary_provider: str
    fallback_providers: List[str]
    providers: Dict[str, Dict[str, Any]]


# === API Endpoints ===

@router.post("/synthesize", response_model=TTSResponse)
async def synthesize_text(
    request: TTSRequest,
    return_audio: bool = Query(False, description="音声データを直接返すかどうか"),
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """
    テキストを音声合成します。
    
    Args:
        request: TTS合成リクエスト
        return_audio: Trueの場合、音声データを直接返す（StreamingResponse）
        current_user: 現在のユーザー情報
        
    Returns:
        TTSResponse: 合成結果（return_audio=Falseの場合）
        StreamingResponse: 音声データ（return_audio=Trueの場合）
    """
    try:
        logger.info(f"TTS synthesis request: {len(request.text)} characters, provider: {request.provider_name}")
        
        # 音声合成実行
        result = await tts_service.synthesize_text(
            text=request.text,
            voice_id=request.voice_id,
            language_code=request.language_code,
            speaking_rate=request.speaking_rate,
            pitch=request.pitch,
            volume_gain_db=request.volume_gain_db,
            audio_format=request.audio_format,
            sample_rate_hertz=request.sample_rate_hertz,
            provider_name=request.provider_name
        )
        
        # 音声データを直接返す場合
        if return_audio:
            return _create_audio_response(result)
        
        # 音声ファイルを一時ディレクトリに保存
        temp_dir = Path(tempfile.gettempdir()) / "tts"
        temp_dir.mkdir(exist_ok=True)
        
        # 拡張子を合成結果に合わせて設定
        ext = result.audio_format.lower()
        if ext not in {"mp3", "wav", "ogg"}:
            ext = "mp3"  # デフォルト

        file_name = f"{uuid.uuid4()}.{ext}"
        file_path = temp_dir / file_name

        # SynthesisResult.audio_data にバイナリ音声データが入っている
        with open(file_path, "wb") as f:
            f.write(result.audio_data)
            
        # TODO: 古いファイルを削除するバックグラウンドタスクを追加
        
        # クライアントがアクセスできるURLを構築
        # 注意: ここではAPIサーバーのベースURLを静的に記述していますが、
        # 本番環境では設定から動的に取得するのが望ましいです。
        base_url = "http://192.168.0.46:8000" # Expoデバッグ用のローカルIP
        audio_url = f"{base_url}/api/v1/tts/audio/{file_name}"

        # レスポンス構築
        response = TTSResponse(
            success=True,
            audio_url=audio_url,
            duration_seconds=result.duration_seconds,
            text=result.text,
            voice_info={
                "voice_id": result.voice_info.voice_id,
                "name": result.voice_info.name,
                "language_code": result.voice_info.language_code,
                "gender": result.voice_info.gender,
                "description": result.voice_info.description,
                "sample_rate_hertz": result.voice_info.sample_rate_hertz
            },
            sentences=[
                {
                    "text": sentence.text,
                    "start_time": sentence.start_time,
                    "end_time": sentence.end_time,
                    "confidence": sentence.confidence
                }
                for sentence in result.sentences
            ],
            metadata=result.metadata
        )
        
        logger.info(f"TTS synthesis completed successfully: {result.duration_seconds:.2f}s, URL: {audio_url}")
        return response
        
    except ValueError as e:
        logger.error(f"TTS validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=f"音声合成に失敗しました: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected TTS error: {e}")
        raise HTTPException(status_code=500, detail="音声合成中に予期しないエラーが発生しました")


@router.post("/synthesize/stream")
async def synthesize_text_stream(
    request: TTSRequest,
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """
    テキストを音声合成し、音声データをストリーミングで返します。
    
    Args:
        request: TTS合成リクエスト
        current_user: 現在のユーザー情報
        
    Returns:
        StreamingResponse: 音声データストリーム
    """
    try:
        logger.info(f"TTS streaming synthesis request: {len(request.text)} characters")
        
        # 音声合成実行
        result = await tts_service.synthesize_text(
            text=request.text,
            voice_id=request.voice_id,
            language_code=request.language_code,
            speaking_rate=request.speaking_rate,
            pitch=request.pitch,
            volume_gain_db=request.volume_gain_db,
            audio_format=request.audio_format,
            sample_rate_hertz=request.sample_rate_hertz,
            provider_name=request.provider_name
        )
        
        return _create_audio_response(result)
        
    except ValueError as e:
        logger.error(f"TTS validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=f"音声合成に失敗しました: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected TTS error: {e}")
        raise HTTPException(status_code=500, detail="音声合成中に予期しないエラーが発生しました")


@router.get("/voices", response_model=Dict[str, List[VoiceInfoResponse]])
async def get_available_voices(
    provider_name: Optional[str] = Query(None, description="プロバイダー名でフィルタ"),
    language_code: Optional[str] = Query(None, description="言語コードでフィルタ"),
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """
    利用可能な音声一覧を取得します。
    
    Args:
        provider_name: プロバイダー名でフィルタ（オプション）
        language_code: 言語コードでフィルタ（オプション）
        current_user: 現在のユーザー情報
        
    Returns:
        Dict[str, List[VoiceInfoResponse]]: プロバイダー別音声一覧
    """
    try:
        voices_by_provider = await tts_service.get_available_voices(
            provider_name=provider_name,
            language_code=language_code
        )
        
        # レスポンス形式に変換
        response = {}
        for provider, voices in voices_by_provider.items():
            response[provider] = [
                VoiceInfoResponse(
                    voice_id=voice.voice_id,
                    name=voice.name,
                    language_code=voice.language_code,
                    gender=voice.gender,
                    description=voice.description,
                    sample_rate_hertz=voice.sample_rate_hertz
                )
                for voice in voices
            ]
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to get available voices: {e}")
        raise HTTPException(status_code=500, detail="音声一覧の取得に失敗しました")


@router.get("/languages")
async def get_supported_languages(
    provider_name: Optional[str] = Query(None, description="プロバイダー名でフィルタ"),
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """
    サポートする言語一覧を取得します。
    
    Args:
        provider_name: プロバイダー名でフィルタ（オプション）
        current_user: 現在のユーザー情報
        
    Returns:
        Dict[str, List[Dict[str, str]]]: プロバイダー別言語一覧
    """
    try:
        languages_by_provider = await tts_service.get_supported_languages(
            provider_name=provider_name
        )
        
        return languages_by_provider
        
    except Exception as e:
        logger.error(f"Failed to get supported languages: {e}")
        raise HTTPException(status_code=500, detail="対応言語一覧の取得に失敗しました")


@router.get("/status", response_model=TTSStatusResponse)
async def get_tts_status(
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """
    TTSサービスの状態を取得します。
    
    Args:
        current_user: 現在のユーザー情報
        
    Returns:
        TTSStatusResponse: TTSサービス状態
    """
    try:
        status = tts_service.get_provider_status()
        
        return TTSStatusResponse(
            enabled=status["enabled"],
            primary_provider=status["primary_provider"],
            fallback_providers=status["fallback_providers"],
            providers=status["providers"]
        )
        
    except Exception as e:
        logger.error(f"Failed to get TTS status: {e}")
        raise HTTPException(status_code=500, detail="TTSサービス状態の取得に失敗しました")


@router.get("/audio/{file_name}")
async def get_tts_audio(file_name: str):
    """
    一時保存されたTTS音声ファイルを取得します。
    """
    temp_dir = Path(tempfile.gettempdir()) / "tts"
    file_path = temp_dir / file_name

    if not file_path.is_file():
        logger.warning(f"Audio file not found: {file_path}")
        raise HTTPException(status_code=404, detail="Audio file not found.")

    # 拡張子に応じて適切なMIMEタイプを設定
    ext = file_path.suffix.lower()
    if ext == ".wav":
        media_type = "audio/wav"
    elif ext == ".mp3":
        media_type = "audio/mpeg"
    elif ext == ".ogg":
        media_type = "audio/ogg"
    else:
        media_type = "application/octet-stream"

    return FileResponse(file_path, media_type=media_type, filename=file_name)


# === Helper Functions ===

def _create_audio_response(result: SynthesisResult) -> StreamingResponse:
    """音声データのStreamingResponseを作成します"""
    
    # MIMEタイプの決定
    if result.audio_format.lower() == "mp3":
        media_type = "audio/mpeg"
        filename = "synthesis.mp3"
    elif result.audio_format.lower() == "wav":
        media_type = "audio/wav"
        filename = "synthesis.wav"
    else:
        media_type = "application/octet-stream"
        filename = f"synthesis.{result.audio_format}"
    
    # 音声データのストリーム作成
    audio_stream = io.BytesIO(result.audio_data)
    
    def iterfile():
        yield from audio_stream
    
    # レスポンスヘッダー
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "Content-Length": str(len(result.audio_data)),
        "X-TTS-Duration": str(result.duration_seconds),
        "X-TTS-Provider": result.metadata.get("provider", "unknown"),
        "X-TTS-Voice-ID": result.voice_info.voice_id,
        "X-TTS-Language": result.voice_info.language_code
    }
    
    return StreamingResponse(
        iterfile(),
        media_type=media_type,
        headers=headers
    ) 