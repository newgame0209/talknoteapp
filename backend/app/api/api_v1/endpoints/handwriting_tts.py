from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import base64, io, logging, os, uuid
from typing import Optional, Dict, Any

from app.providers.ocr.google_vision import GoogleVisionOCRProvider, OCRError
from app.providers.tts.google import GoogleTTSProvider
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/handwriting", tags=["handwriting"])

logger = logging.getLogger(__name__)


class HandwritingTTSBase64Request(BaseModel):
    """Base64形式の手書きTTS リクエスト"""
    image_data: str
    voice: Optional[str] = None
    speaking_rate: Optional[float] = 1.0


@router.post("/tts-base64", summary="Base64手書き画像をOCRしてTTS音声を生成・返却")
async def handwriting_to_speech_base64(
    request: HandwritingTTSBase64Request,
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """Base64形式の手書き画像を OCR でテキスト抽出し、TTS 音声を返却"""
    
    logger.info(f"🖊️ Handwriting TTS Base64 request started - image_data length: {len(request.image_data)}")
    
    try:
        # Base64デコード
        logger.info("📁 Decoding Base64 image data...")
        try:
            # data:image/png;base64, プレフィックスを除去
            base64_data = request.image_data
            if base64_data.startswith('data:'):
                base64_data = base64_data.split(',', 1)[1]
            
            image_bytes = base64.b64decode(base64_data)
            logger.info(f"📁 Base64 decoded successfully - {len(image_bytes)} bytes")
        except Exception as decode_error:
            logger.error(f"📁 Base64 decode failed: {decode_error}")
            raise HTTPException(status_code=400, detail=f"Base64 decode error: {decode_error}")
        
        if len(image_bytes) == 0:
            logger.error("📁 Empty image data after decode")
            raise HTTPException(status_code=400, detail="Empty image data")
        
        # --- Debug: save uploaded image -------------------------------------
        debug_dir = os.getenv("HANDWRITING_DEBUG_DIR", "/tmp/handwriting_debug")
        try:
            os.makedirs(debug_dir, exist_ok=True)
            debug_path = os.path.join(debug_dir, f"{uuid.uuid4()}_base64.png")
            with open(debug_path, "wb") as f:
                f.write(image_bytes)
            logger.info(f"🐛 Debug: saved Base64 handwriting image to {debug_path}")
        except Exception as save_exc:
            logger.warning(f"🐛 Could not save debug handwriting image: {save_exc}")
        # -------------------------------------------------------------------
        
        # OCR処理
        logger.info("🔍 Starting OCR processing...")
        try:
            ocr_provider = GoogleVisionOCRProvider()
            logger.info("🔍 OCR provider initialized successfully")
        except Exception as ocr_init_error:
            logger.error(f"🔍 OCR provider initialization failed: {ocr_init_error}")
            raise HTTPException(status_code=500, detail=f"OCR initialization error: {ocr_init_error}")
        
        try:
            ocr_result = await ocr_provider.extract_text(image_bytes, language_hints=["ja"])
            logger.info(f"🔍 OCR completed - text: '{ocr_result.text}', confidence: {ocr_result.confidence}")
        except Exception as ocr_error:
            logger.error(f"🔍 OCR processing failed: {ocr_error}")
            raise HTTPException(status_code=500, detail=f"OCR processing error: {ocr_error}")
        
        if not ocr_result.text or not ocr_result.text.strip():
            logger.warning("🔍 No text detected in image")
            raise HTTPException(status_code=400, detail="No text detected in the image")
        
        # TTS処理
        logger.info("🎵 Starting TTS processing...")
        try:
            tts_provider = GoogleTTSProvider()
            logger.info("🎵 TTS provider initialized successfully")
        except Exception as tts_init_error:
            logger.error(f"🎵 TTS provider initialization failed: {tts_init_error}")
            raise HTTPException(status_code=500, detail=f"TTS initialization error: {tts_init_error}")
        
        try:
            synthesis_result = await tts_provider.synthesize(
                text=ocr_result.text,
                voice_id=request.voice or "ja-JP-Neural2-B",
                speaking_rate=request.speaking_rate or 1.0,
                audio_format="mp3"
            )
            logger.info(f"🎵 TTS completed - audio size: {len(synthesis_result.audio_data)} bytes")
        except Exception as tts_error:
            logger.error(f"🎵 TTS processing failed: {tts_error}")
            raise HTTPException(status_code=500, detail=f"TTS processing error: {tts_error}")
        
        # 音声データをストリーミング返却
        logger.info("📤 Returning audio stream...")
        return StreamingResponse(
            io.BytesIO(synthesis_result.audio_data),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=handwriting_speech.mp3"}
        )
        
    except HTTPException:
        # HTTPExceptionはそのまま再発生
        raise
    except Exception as e:
        logger.exception(f"🚨 Unexpected error in handwriting TTS Base64: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal Server Error: {str(e)}"
        )


@router.post("/tts", summary="手書き画像をOCRしてTTS音声を生成・返却")
async def handwriting_to_speech(
    file: UploadFile = File(..., description="手書きキャンバスの画像ファイル (png/jpeg)"),
    voice: Optional[str] = None,
    speaking_rate: Optional[float] = 1.0,
    current_user: Optional[Dict] = Depends(get_current_user)
):
    """Upload された手書き画像を OCR でテキスト抽出し、TTS 音声を返却"""
    
    logger.info(f"🖊️ Handwriting TTS request started - file: {file.filename}, size: {file.size}")
    
    try:
        # ファイル読み込み
        logger.info("📁 Reading uploaded file...")
        image_bytes = await file.read()
        logger.info(f"📁 File read successfully - {len(image_bytes)} bytes")
        
        if len(image_bytes) == 0:
            logger.error("📁 Empty file received")
            raise HTTPException(status_code=400, detail="Empty file received")
        
        # --- Debug: save uploaded image -------------------------------------
        debug_dir = os.getenv("HANDWRITING_DEBUG_DIR", "/tmp/handwriting_debug")
        try:
            os.makedirs(debug_dir, exist_ok=True)
            debug_path = os.path.join(debug_dir, f"{uuid.uuid4()}.png")
            with open(debug_path, "wb") as f:
                f.write(image_bytes)
            logger.info(f"🐛 Debug: saved uploaded handwriting image to {debug_path}")
        except Exception as save_exc:
            logger.warning(f"🐛 Could not save debug handwriting image: {save_exc}")
        # -------------------------------------------------------------------
        
        # OCR処理
        logger.info("🔍 Starting OCR processing...")
        try:
            ocr_provider = GoogleVisionOCRProvider()
            logger.info("🔍 OCR provider initialized successfully")
        except Exception as ocr_init_error:
            logger.error(f"🔍 OCR provider initialization failed: {ocr_init_error}")
            raise HTTPException(status_code=500, detail=f"OCR initialization error: {ocr_init_error}")
        
        try:
            ocr_result = await ocr_provider.extract_text(image_bytes, language_hints=["ja"])
            logger.info(f"🔍 OCR completed - text: '{ocr_result.text}', confidence: {ocr_result.confidence}")
        except Exception as ocr_error:
            logger.error(f"🔍 OCR processing failed: {ocr_error}")
            raise HTTPException(status_code=500, detail=f"OCR processing error: {ocr_error}")
        
        if not ocr_result.text or not ocr_result.text.strip():
            logger.warning("🔍 No text detected in image")
            raise HTTPException(status_code=400, detail="No text detected in the image")
        
        # TTS処理
        logger.info("🎵 Starting TTS processing...")
        try:
            tts_provider = GoogleTTSProvider()
            logger.info("🎵 TTS provider initialized successfully")
        except Exception as tts_init_error:
            logger.error(f"🎵 TTS provider initialization failed: {tts_init_error}")
            raise HTTPException(status_code=500, detail=f"TTS initialization error: {tts_init_error}")
        
        try:
            synthesis_result = await tts_provider.synthesize(
                text=ocr_result.text,
                voice_id=voice or "ja-JP-Neural2-B",
                speaking_rate=speaking_rate or 1.0,
                audio_format="mp3"
            )
            logger.info(f"🎵 TTS completed - audio size: {len(synthesis_result.audio_data)} bytes")
        except Exception as tts_error:
            logger.error(f"🎵 TTS processing failed: {tts_error}")
            raise HTTPException(status_code=500, detail=f"TTS processing error: {tts_error}")
        
        # 音声データをストリーミング返却
        logger.info("📤 Returning audio stream...")
        return StreamingResponse(
            io.BytesIO(synthesis_result.audio_data),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=handwriting_speech.mp3"}
        )
        
    except HTTPException:
        # HTTPExceptionはそのまま再発生
        raise
    except Exception as e:
        logger.exception(f"🚨 Unexpected error in handwriting TTS: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal Server Error: {str(e)}"
        ) 