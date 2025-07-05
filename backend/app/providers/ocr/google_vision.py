"""
Google Vision API OCR Provider

Google Cloud Vision APIを使用してOCR（光学文字認識）を実行するプロバイダーです。
高精度な日本語・英語の文字認識に対応しています。
"""

import logging
from typing import Dict, List, Optional, Any
import io
import numpy as np
import os
import uuid

try:
    from google.cloud import vision
    from google.api_core import exceptions as gcp_exceptions
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    GOOGLE_VISION_AVAILABLE = False
    vision = None
    gcp_exceptions = None

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    cv2 = None

from .base import OCRProvider, OCRResult, OCRError

logger = logging.getLogger(__name__)


class GoogleVisionOCRProvider(OCRProvider):
    """Google Vision APIを使用したOCRプロバイダー"""
    
    def __init__(self, **kwargs):
        """
        Google Vision OCRプロバイダーを初期化
        
        Args:
            **kwargs: 設定パラメータ
                - project_id: Google Cloud プロジェクトID
                - credentials_path: サービスアカウントキーのパス
        """
        super().__init__(**kwargs)
        
        if not GOOGLE_VISION_AVAILABLE:
            raise OCRError(
                "Google Cloud Vision library is not available. "
                "Install with: pip install google-cloud-vision",
                provider="google_vision"
            )
        
        if not OPENCV_AVAILABLE:
            logger.warning("OpenCV is not available. Image preprocessing will be limited.")
        
        try:
            # Vision APIクライアントを初期化
            self.client = vision.ImageAnnotatorClient()
            logger.info("Google Vision OCR Provider initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Vision client: {e}")
            raise OCRError(
                f"Failed to initialize Google Vision client: {e}",
                provider="google_vision"
            )
    
    def _preprocess_image(self, image_bytes: bytes) -> bytes:
        """
        MVPの成功例に基づく画像前処理
        手書き文字認識の精度を向上させるための処理を実行
        
        Args:
            image_bytes: 元の画像データ
            
        Returns:
            bytes: 前処理済み画像データ
        """
        logger.info(f"🔧 _preprocess_image called with {len(image_bytes)} bytes")
        
        if not OPENCV_AVAILABLE:
            logger.warning("OpenCV not available, skipping image preprocessing")
            return image_bytes
        
        logger.info("🔧 OpenCV is available, starting preprocessing")
        try:
            # デバッグ用ディレクトリ設定
            debug_dir = os.getenv("HANDWRITING_DEBUG_DIR", "/tmp/handwriting_debug")
            debug_id = str(uuid.uuid4())
            logger.info(f"🔧 Debug directory: {debug_dir}, Debug ID: {debug_id}")
            
            # デバッグディレクトリを作成
            os.makedirs(debug_dir, exist_ok=True)
            
            # 1. バイト配列をnumpy配列に変換
            nparr = np.frombuffer(image_bytes, np.uint8)
            
            # 🔧 RGBA対応: アルファチャンネル付きで読み込み
            image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
            
            if image is None:
                logger.error("Failed to decode image with OpenCV")
                return image_bytes
            
            logger.info(f"📸 Original image shape: {image.shape}")
            
            # 🔧 RGBA→RGB変換（透明背景を白背景に変換）
            if len(image.shape) == 3 and image.shape[2] == 4:
                # RGBA画像の場合
                logger.info("📸 Converting RGBA to RGB with white background")
                
                # アルファチャンネルを分離
                bgr = image[:, :, :3]
                alpha = image[:, :, 3:4] / 255.0
                
                # 白背景を作成
                white_background = np.ones_like(bgr, dtype=np.uint8) * 255
                
                # アルファブレンディング（透明部分を白背景で埋める）
                image = (bgr * alpha + white_background * (1 - alpha)).astype(np.uint8)
                
                logger.info(f"📸 RGBA→RGB conversion completed: {image.shape}")
            elif len(image.shape) == 3 and image.shape[2] == 3:
                # 既にBGR画像の場合はそのまま使用
                logger.info("📸 Image is already BGR format")
            else:
                # グレースケールの場合はBGRに変換
                if len(image.shape) == 2:
                    image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
                    logger.info("📸 Converted grayscale to BGR")
            
            # デバッグ: RGB変換後の画像を保存
            try:
                rgb_path = os.path.join(debug_dir, f"{debug_id}_00_rgb_converted.png")
                cv2.imwrite(rgb_path, image)
                logger.info(f"📸 Saved RGB converted image: {rgb_path}")
            except Exception as e:
                logger.warning(f"Could not save RGB debug image: {e}")
            
            # 2. グレースケール変換
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # デバッグ: グレースケール画像を保存
            try:
                gray_path = os.path.join(debug_dir, f"{debug_id}_01_gray.png")
                cv2.imwrite(gray_path, gray)
                logger.info(f"📸 Saved grayscale image: {gray_path}")
            except Exception as e:
                logger.warning(f"Could not save grayscale debug image: {e}")
            
            # 3. ガウシアンブラーでノイズ除去
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # 4. 適応的二値化（MVPの成功例）
            binary = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # デバッグ: 二値化画像を保存
            try:
                binary_path = os.path.join(debug_dir, f"{debug_id}_02_binary.png")
                cv2.imwrite(binary_path, binary)
                logger.info(f"📸 Saved binary image: {binary_path}")
            except Exception as e:
                logger.warning(f"Could not save binary debug image: {e}")
            
            # 5. 形態学的処理（ノイズ除去と文字の補強）
            kernel = np.ones((2, 2), np.uint8)
            
            # ノイズ除去（opening）
            opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
            
            # 文字の補強（closing）
            processed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
            
            # デバッグ: 最終処理画像を保存
            try:
                final_path = os.path.join(debug_dir, f"{debug_id}_03_final.png")
                cv2.imwrite(final_path, processed)
                logger.info(f"📸 Saved final processed image: {final_path}")
            except Exception as e:
                logger.warning(f"Could not save final debug image: {e}")
            
            # 6. 処理済み画像をバイト配列に変換
            success, encoded_image = cv2.imencode('.png', processed)
            if not success:
                logger.error("Failed to encode processed image")
                return image_bytes
            
            processed_bytes = encoded_image.tobytes()
            logger.info(f"📸 Image preprocessing completed: {len(image_bytes)} -> {len(processed_bytes)} bytes")
            
            return processed_bytes
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            return image_bytes

    async def extract_text(
        self, 
        image_data: bytes, 
        language_hints: Optional[List[str]] = None,
        desired_rotation: Optional[int] = None
    ) -> OCRResult:
        """
        Google Vision APIを使用して画像からテキストを抽出
        
        Args:
            image_data: 画像のバイナリデータ
            language_hints: 言語ヒント（例: ['ja', 'en']）
            desired_rotation: 画像の回転角度（90, 180, 270度）- 横向き画像のOCR精度向上用
            
        Returns:
            OCRResult: 抽出結果
        """
        try:
            # 🔧 画像前処理を有効化（RGBA→RGB変換を含む）
            logger.info(f"🔧 Starting image preprocessing for {len(image_data)} bytes")
            processed_image_data = self._preprocess_image(image_data)
            logger.info(f"🔧 Image preprocessing completed: {len(processed_image_data)} bytes")
            
            # Vision API用の画像オブジェクトを作成
            image = vision.Image(content=processed_image_data)
            
            # 画像コンテキストを設定
            image_context = None
            context_params = {}
            
            # 言語ヒントを設定
            if language_hints:
                context_params['language_hints'] = language_hints
                logger.info(f"🔍 Using language hints: {language_hints}")
            
            # 🆕 desired_rotationを設定（横向き画像対応）
            if desired_rotation is not None:
                context_params['desired_rotation'] = desired_rotation
                logger.info(f"🔄 Using desired rotation: {desired_rotation} degrees")
            
            # ImageContextを作成（パラメータがある場合のみ）
            if context_params:
                image_context = vision.ImageContext(**context_params)
            
            # MVPと同じdocument_text_detectionを使用（高精度）
            if image_context:
                response = self.client.document_text_detection(
                    image=image, 
                    image_context=image_context
                )
            else:
                response = self.client.document_text_detection(image=image)
            
            # エラーチェック
            if response.error.message:
                raise OCRError(
                    f"Google Vision API error: {response.error.message}",
                    provider="google_vision",
                    error_code=str(response.error.code)
                )
            
            # ドキュメントテキスト注釈を取得
            if response.full_text_annotation:
                full_text = response.full_text_annotation.text
                logger.info(f"🔍 Document text detected: '{full_text}'")
                
                # 信頼度を計算
                confidence = 0.9  # document_text_detectionは高精度
                
                # 言語検出
                detected_language = self._detect_language(full_text)
                
                return OCRResult(
                    text=full_text,
                    confidence=confidence,
                    language=detected_language,
                    metadata={
                        "provider": "google_vision",
                        "method": "document_text_detection",
                        "preprocessed": OPENCV_AVAILABLE
                    }
                )
            
            # フォールバック: 通常のtext_detection
            texts = response.text_annotations
            
            if not texts:
                # テキストが検出されなかった場合
                logger.warning("🔍 No text detected in image")
                return OCRResult(
                    text="",
                    confidence=0.0,
                    language=None,
                    metadata={"provider": "google_vision", "texts_count": 0}
                )
            
            # 最初の要素が全体のテキスト
            full_text = texts[0].description
            logger.info(f"🔍 Text detected: '{full_text}'")
            
            # 信頼度を計算（個別の文字の信頼度の平均）
            total_confidence = 0.0
            confidence_count = 0
            
            # 境界ボックス情報を収集
            bounding_boxes = []
            
            for text in texts[1:]:  # 最初の要素はスキップ（全体テキスト）
                # 境界ボックス情報を追加
                vertices = text.bounding_poly.vertices
                bounding_box = {
                    "text": text.description,
                    "vertices": [
                        {"x": vertex.x, "y": vertex.y} 
                        for vertex in vertices
                    ]
                }
                bounding_boxes.append(bounding_box)
            
            # 言語検出
            detected_language = self._detect_language(full_text)
            
            # 信頼度の計算（簡易版）
            confidence = min(0.95, len(full_text.strip()) / max(1, len(full_text)) * 0.9 + 0.1)
            
            return OCRResult(
                text=full_text,
                confidence=confidence,
                language=detected_language,
                bounding_boxes=bounding_boxes,
                metadata={
                    "provider": "google_vision",
                    "method": "text_detection",
                    "texts_count": len(texts),
                    "has_bounding_boxes": len(bounding_boxes) > 0,
                    "preprocessed": OPENCV_AVAILABLE
                }
            )
            
        except gcp_exceptions.GoogleAPIError as e:
            logger.error(f"Google Vision API error: {e}")
            raise OCRError(
                f"Google Vision API error: {e}",
                provider="google_vision",
                error_code=str(e.code) if hasattr(e, 'code') else None
            )
        except Exception as e:
            logger.error(f"Unexpected error in Google Vision OCR: {e}")
            raise OCRError(
                f"Unexpected error in Google Vision OCR: {e}",
                provider="google_vision"
            )
    
    def is_available(self) -> bool:
        """
        Google Vision APIが利用可能かチェック
        
        Returns:
            bool: 利用可能な場合True
        """
        if not GOOGLE_VISION_AVAILABLE:
            return False
        
        try:
            # 簡単なテストリクエストを送信
            # 実際にはクライアントの初期化が成功していればOK
            return hasattr(self, 'client') and self.client is not None
        except Exception:
            return False
    
    def _detect_language(self, text: str) -> Optional[str]:
        """
        テキストから言語を推定（簡易版）
        
        Args:
            text: 分析するテキスト
            
        Returns:
            str: 推定された言語コード（'ja', 'en', etc.）
        """
        if not text:
            return None
        
        # 日本語文字（ひらがな、カタカナ、漢字）の検出
        japanese_chars = 0
        total_chars = 0
        
        for char in text:
            if char.isalpha() or ord(char) > 127:  # 非ASCII文字
                total_chars += 1
                # 日本語文字の範囲をチェック
                char_code = ord(char)
                if (0x3040 <= char_code <= 0x309F or  # ひらがな
                    0x30A0 <= char_code <= 0x30FF or  # カタカナ
                    0x4E00 <= char_code <= 0x9FAF):   # 漢字
                    japanese_chars += 1
        
        if total_chars == 0:
            return None
        
        # 日本語文字の割合が30%以上なら日本語と判定
        japanese_ratio = japanese_chars / total_chars
        if japanese_ratio >= 0.3:
            return "ja"
        else:
            return "en" 