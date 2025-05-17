"""
しゃべるノート - テスト用AI専用サーバー
認証なしで直接AIエンドポイントをテストするための最小構成
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.core.settings import settings
from app.services.ai.service import AIService

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# アプリケーション作成
app = FastAPI(
    title="しゃべるノート AI テスト API",
    description="AIエンドポイントのテスト用サーバー（認証なし）",
    version=settings.VERSION,
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# リクエスト・レスポンスモデル
class FuriganaRequest(BaseModel):
    """読み仮名リクエスト"""
    text: str = Field(..., description="読み仮名を追加するテキスト")


class FuriganaResponse(BaseModel):
    """読み仮名レスポンス"""
    html: str = Field(..., description="HTML形式のテキスト（ルビタグ使用）")
    plain: str = Field(..., description="プレーンテキスト形式（括弧内にひらがな）")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


class SummarizeRequest(BaseModel):
    """要約リクエスト"""
    text: str = Field(..., description="要約するテキスト")
    max_length: Optional[int] = Field(None, description="要約の最大長（文字数）")


class SummarizeResponse(BaseModel):
    """要約レスポンス"""
    summary: str = Field(..., description="要約されたテキスト")


class ProofreadRequest(BaseModel):
    """校正リクエスト"""
    text: str = Field(..., description="校正するテキスト")


class ProofreadCorrection(BaseModel):
    """校正の修正箇所"""
    original: str = Field(..., description="元のテキスト")
    corrected: str = Field(..., description="修正後のテキスト")
    reason: Optional[str] = Field(None, description="修正理由")


class ProofreadResponse(BaseModel):
    """校正レスポンス"""
    corrected_text: str = Field(..., description="修正済みテキスト")
    corrections: List[ProofreadCorrection] = Field(default_factory=list, description="修正箇所のリスト")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


class ResearchRequest(BaseModel):
    """リサーチリクエスト"""
    query: str = Field(..., description="検索クエリ")
    max_results: int = Field(3, description="最大結果数")


class ResearchResult(BaseModel):
    """リサーチ結果の項目"""
    title: str = Field(..., description="タイトル")
    content: str = Field(..., description="内容")
    relevance: Optional[float] = Field(None, description="関連度（0.0～1.0）")


class ResearchResponse(BaseModel):
    """リサーチレスポンス"""
    results: List[ResearchResult] = Field(default_factory=list, description="検索結果のリスト")


class ChatMessage(BaseModel):
    """チャットメッセージ"""
    role: str = Field(..., description="メッセージの役割（user, assistant）")
    content: str = Field(..., description="メッセージの内容")


class ChatRequest(BaseModel):
    """チャットリクエスト"""
    messages: List[ChatMessage] = Field(..., description="メッセージのリスト")
    system_prompt: Optional[str] = Field(None, description="システムプロンプト（AIの振る舞いを指定）")


class ChatResponse(BaseModel):
    """チャットレスポンス"""
    response: str = Field(..., description="AIの応答")


class TextConvertRequest(BaseModel):
    """テキスト変換リクエスト"""
    text: str = Field(..., description="変換するテキスト")
    target_type: str = Field(..., description="変換先の形式（kanji, hiragana, katakana）")


class TextConvertResponse(BaseModel):
    """テキスト変換レスポンス"""
    converted_text: str = Field(..., description="変換されたテキスト")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


class DictionaryRequest(BaseModel):
    """辞書検索リクエスト"""
    word: str = Field(..., description="検索する単語")


class DictionaryMeaning(BaseModel):
    """辞書検索結果の意味"""
    definition: str = Field(..., description="意味の定義")
    examples: List[str] = Field(default_factory=list, description="例文")
    part_of_speech: Optional[str] = Field(None, description="品詞")


class DictionaryResponse(BaseModel):
    """辞書検索レスポンス"""
    word: str = Field(..., description="検索された単語")
    readings: List[str] = Field(default_factory=list, description="読み方")
    meanings: List[DictionaryMeaning] = Field(default_factory=list, description="意味のリスト")
    etymology: Optional[str] = Field(None, description="語源")
    related_words: List[str] = Field(default_factory=list, description="関連語")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


# ヘルスチェックエンドポイント
@app.get("/healthz")
def health_check():
    """ヘルスチェック"""
    return {"status": "ok"}


# 読み仮名エンドポイント
@app.post("/furigana", response_model=FuriganaResponse)
async def add_furigana(request: FuriganaRequest) -> Dict[str, Any]:
    """
    テキストに読み仮名（ふりがな）を追加する
    
    Args:
        request: 読み仮名リクエスト
        
    Returns:
        読み仮名レスポンス
    """
    try:
        ai_service = AIService()
        result = await ai_service.add_furigana(request.text)
        return result
    except Exception as e:
        logger.error(f"Error in add_furigana endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"読み仮名の追加中にエラーが発生しました: {str(e)}")


# 要約エンドポイント
@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> Dict[str, Any]:
    """
    テキストを要約する
    
    Args:
        request: 要約リクエスト
        
    Returns:
        要約レスポンス
    """
    try:
        ai_service = AIService()
        summary = await ai_service.summarize(request.text, request.max_length)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error in summarize endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"要約中にエラーが発生しました: {str(e)}")


# 校正エンドポイント
@app.post("/proofread", response_model=ProofreadResponse)
async def proofread(request: ProofreadRequest) -> Dict[str, Any]:
    """
    テキストを校正する
    
    Args:
        request: 校正リクエスト
        
    Returns:
        校正レスポンス
    """
    try:
        ai_service = AIService()
        result = await ai_service.proofread(request.text)
        return result
    except Exception as e:
        logger.error(f"Error in proofread endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"校正中にエラーが発生しました: {str(e)}")


# リサーチエンドポイント
@app.post("/research", response_model=ResearchResponse)
async def research(request: ResearchRequest) -> Dict[str, Any]:
    """
    クエリに基づいてリサーチを行う
    
    Args:
        request: リサーチリクエスト
        
    Returns:
        リサーチレスポンス
    """
    try:
        ai_service = AIService("research")  # リサーチ用のプロバイダーを使用
        results = await ai_service.research(request.query, request.max_results)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error in research endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"リサーチ中にエラーが発生しました: {str(e)}")


# チャットエンドポイント
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> Dict[str, Any]:
    """
    チャット形式でAIと対話する
    
    Args:
        request: チャットリクエスト
        
    Returns:
        チャットレスポンス
    """
    try:
        ai_service = AIService()
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        response = await ai_service.chat(messages, request.system_prompt)
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"チャット中にエラーが発生しました: {str(e)}")


# テキスト変換エンドポイント
@app.post("/convert", response_model=TextConvertResponse)
async def convert_text(request: TextConvertRequest) -> Dict[str, Any]:
    """
    テキストを指定された形式（漢字、ひらがな、カタカナ）に変換する
    
    Args:
        request: テキスト変換リクエスト
        
    Returns:
        テキスト変換レスポンス
    """
    try:
        ai_service = AIService()
        converted_text = await ai_service.convert_text(request.text, request.target_type)
        return {"converted_text": converted_text}
    except Exception as e:
        logger.error(f"Error in convert_text endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"テキスト変換中にエラーが発生しました: {str(e)}")


# 辞書エンドポイント
@app.post("/dictionary", response_model=DictionaryResponse)
async def dictionary_lookup(request: DictionaryRequest) -> Dict[str, Any]:
    """
    辞書で単語を検索する
    
    Args:
        request: 辞書検索リクエスト
        
    Returns:
        辞書検索レスポンス
    """
    try:
        ai_service = AIService()
        result = await ai_service.dictionary_lookup(request.word)
        return result
    except Exception as e:
        logger.error(f"Error in dictionary_lookup endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"辞書検索中にエラーが発生しました: {str(e)}")
