"""
モックSTTプロバイダー実装（テスト用）
"""
import asyncio
import io
import json
import logging
from typing import AsyncGenerator, BinaryIO, Dict, List, Optional, Union

from .base import BaseSTTProvider, TranscriptionResult, TranscriptionStatus

# ロギング設定
logger = logging.getLogger(__name__)


class MockSTTProvider(BaseSTTProvider):
    """テスト用のモックSTTプロバイダー"""
    
    def __init__(self, *args, **kwargs):
        """
        モックSTTプロバイダーを初期化
        """
        logger.info("Using Mock STT Provider for testing")
        
    async def transcribe_file(
        self,
        audio_file: BinaryIO,
        language_code: str = "ja-JP",
        audio_format: str = "wav",
        sample_rate_hertz: int = 16000,
        enable_automatic_punctuation: bool = True,
        enable_speaker_diarization: bool = False,
        diarization_speaker_count: int = 2,
        model: str = "default",
        hints: List[str] = None
    ) -> TranscriptionResult:
        """
        音声ファイルを文字起こし（モック実装）
        
        Args:
            audio_file: 音声ファイルオブジェクト
            language_code: 言語コード
            audio_format: 音声フォーマット
            sample_rate_hertz: サンプルレート
            enable_automatic_punctuation: 自動句読点付与
            enable_speaker_diarization: 話者分離
            diarization_speaker_count: 話者数
            model: 使用するモデル
            hints: 認識ヒント
            
        Returns:
            TranscriptionResult: 文字起こし結果
        """
        logger.info(f"Mock transcribe_file called with language: {language_code}")
        
        # モックの文字起こし結果を返す
        return TranscriptionResult(
            text="これはモックの文字起こし結果です。",
            confidence=0.95,
            status=TranscriptionStatus.COMPLETED,
            language_code=language_code,
            duration_seconds=5.0,
            alternatives=[
                {
                    "text": "これはモックの文字起こし結果です。",
                    "confidence": 0.95
                },
                {
                    "text": "これは模擬の文字起こし結果です。",
                    "confidence": 0.85
                }
            ],
            words=[
                {
                    "word": "これは",
                    "start_time": 0.0,
                    "end_time": 1.0,
                    "confidence": 0.95
                },
                {
                    "word": "モックの",
                    "start_time": 1.0,
                    "end_time": 2.0,
                    "confidence": 0.95
                },
                {
                    "word": "文字起こし",
                    "start_time": 2.0,
                    "end_time": 3.5,
                    "confidence": 0.95
                },
                {
                    "word": "結果です。",
                    "start_time": 3.5,
                    "end_time": 5.0,
                    "confidence": 0.95
                }
            ]
        )
    
    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language_code: str = "ja-JP",
        sample_rate_hertz: int = 16000,
        interim_results: bool = True,
        enable_automatic_punctuation: bool = True,
        enable_speaker_diarization: bool = False,
        diarization_speaker_count: int = 2,
        model: str = "default",
        hints: List[str] = None
    ) -> AsyncGenerator[TranscriptionResult, None]:
        """
        音声ストリームをリアルタイムで文字起こし（モック実装）
        
        Args:
            audio_stream: 音声データのストリーム
            language_code: 言語コード
            sample_rate_hertz: サンプルレート
            interim_results: 中間結果を返すか
            enable_automatic_punctuation: 自動句読点付与
            enable_speaker_diarization: 話者分離
            diarization_speaker_count: 話者数
            model: 使用するモデル
            hints: 認識ヒント
            
        Yields:
            TranscriptionResult: 文字起こし結果
        """
        logger.info(f"Mock transcribe_stream called with language: {language_code}")
        
        # モックの中間結果を生成
        mock_responses = [
            "こ",
            "これ",
            "これは",
            "これはモ",
            "これはモック",
            "これはモックの",
            "これはモックの文字",
            "これはモックの文字起こし",
            "これはモックの文字起こし結果",
            "これはモックの文字起こし結果です"
        ]
        
        try:
            # 音声ストリームからデータを受信（実際には使用しない）
            async for _ in audio_stream:
                pass
                
            # モックの結果を順番に返す
            for i, text in enumerate(mock_responses):
                is_final = i == len(mock_responses) - 1
                
                yield TranscriptionResult(
                    text=text,
                    confidence=0.8 if not is_final else 0.95,
                    status=TranscriptionStatus.IN_PROGRESS if not is_final else TranscriptionStatus.COMPLETED,
                    is_final=is_final,
                    language_code=language_code,
                    duration_seconds=(i + 1) * 0.5
                )
                
                # 少し待機して、リアルタイム処理をシミュレート
                await asyncio.sleep(0.5)
                
        except Exception as e:
            logger.error(f"Error in mock transcribe_stream: {e}")
            yield TranscriptionResult(
                text="",
                confidence=0.0,
                status=TranscriptionStatus.ERROR,
                error=str(e),
                language_code=language_code
            )
    
    def get_supported_languages(self) -> List[Dict[str, str]]:
        """
        サポートされている言語のリストを取得
        
        Returns:
            List[Dict[str, str]]: 言語コードと名前のリスト
        """
        return [
            {"code": "ja-JP", "name": "日本語"},
            {"code": "en-US", "name": "英語（アメリカ）"},
            {"code": "en-GB", "name": "英語（イギリス）"},
            {"code": "zh-CN", "name": "中国語（簡体字）"},
            {"code": "zh-TW", "name": "中国語（繁体字）"},
            {"code": "ko-KR", "name": "韓国語"},
            {"code": "fr-FR", "name": "フランス語"},
            {"code": "de-DE", "name": "ドイツ語"},
            {"code": "es-ES", "name": "スペイン語"},
            {"code": "it-IT", "name": "イタリア語"}
        ]
