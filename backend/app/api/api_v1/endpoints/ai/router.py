"""
しゃべるノート - AIエンドポイント
AIサービス（要約、校正、リサーチなど）のAPIエンドポイント
"""
import logging
from typing import Dict, List, Optional, Any, Union

from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.services.ai.service import AIService

# ロギング設定
logger = logging.getLogger(__name__)

# ルーター設定
router = APIRouter()


# リクエスト・レスポンスモデル
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
    relevance: Optional[float] = Field(None, description="関連度（0.0〜1.0）")


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


class FuriganaRequest(BaseModel):
    """読み仮名リクエスト"""
    text: str = Field(..., description="読み仮名を追加するテキスト")


class FuriganaResponse(BaseModel):
    """読み仮名レスポンス"""
    html: str = Field(..., description="HTML形式のテキスト（ルビタグ使用）")
    plain: str = Field(..., description="プレーンテキスト形式（括弧内にひらがな）")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


class TextConvertRequest(BaseModel):
    """テキスト変換リクエスト"""
    text: str = Field(..., description="変換するテキスト")
    target_type: str = Field(..., description="変換先の形式（kanji, hiragana, katakana）")


class TextConvertResponse(BaseModel):
    """テキスト変換レスポンス"""
    converted_text: str = Field(..., description="変換済みテキスト")


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


class GenerateTitleRequest(BaseModel):
    """タイトル生成リクエスト"""
    text: str = Field(..., description="タイトル生成元のテキスト")
    max_length: Optional[int] = Field(None, description="タイトルの最大長（文字数）")


class GenerateTitleResponse(BaseModel):
    """タイトル生成レスポンス"""
    title: str = Field(..., description="生成されたタイトル")


class EnhanceScannedTextRequest(BaseModel):
    """AI文章整形リクエスト"""
    text: str = Field(..., description="OCRで抽出されたテキスト")
    analyze_structure: bool = Field(True, description="文章構造を解析するか")
    correct_grammar: bool = Field(True, description="文法修正を行うか")
    improve_readability: bool = Field(True, description="読みやすさを向上させるか")
    format_style: str = Field("structured", description="整形スタイル（structured, visual_preserve, speech_to_text）")
    language: str = Field("ja", description="処理言語（ja, en）")
    
    # 🆕 写真スキャン専用の高度な整形オプション
    preserve_visual_structure: bool = Field(False, description="元画像の視覚的構造を保持するか")
    preserve_formatting: bool = Field(False, description="太字、見出し等の書式を保持するか")
    enhance_layout: bool = Field(False, description="レイアウトの改善を行うか")
    detect_headings: bool = Field(False, description="見出しの自動検出を行うか")
    preserve_lists: bool = Field(False, description="リスト構造の保持を行うか")
    improve_spacing: bool = Field(False, description="適切な行間・段落間隔を追加するか")
    
    # 🆕 音声文字起こし専用の高度な整形オプション
    add_natural_breaks: bool = Field(False, description="自然な改行・段落分けを追加するか")
    improve_flow: bool = Field(False, description="文章の流れを改善するか")
    remove_filler_words: bool = Field(False, description="「えー」「あのー」等の除去を行うか")
    add_punctuation: bool = Field(False, description="適切な句読点の追加を行うか")
    organize_content: bool = Field(False, description="内容の論理的整理を行うか")
    enhance_clarity: bool = Field(False, description="明瞭性の向上を行うか")
    preserve_speaker_intent: bool = Field(False, description="話者の意図を保持するか")


class EnhanceScannedTextResponse(BaseModel):
    """AI文章整形レスポンス"""
    enhanced_text: str = Field(..., description="整形済み高品質テキスト")
    confidence: float = Field(..., description="整形信頼度（0.0-1.0）")
    improvements: List[str] = Field(default_factory=list, description="修正・改善内容のリスト")
    structure_analysis: str = Field(..., description="文章構造の分析結果")
    original_text: str = Field(..., description="元のテキスト")
    original_preserved: bool = Field(..., description="元の内容が保持されているか")
    error: Optional[str] = Field(None, description="エラーメッセージ（存在する場合）")


# エンドポイント
@router.post("/summarize", response_model=SummarizeResponse, tags=["ai"])
async def summarize(
    request: SummarizeRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    テキストを要約する
    
    Args:
        request: 要約リクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/generate-title", response_model=GenerateTitleResponse, tags=["ai"])
async def generate_title(
    request: GenerateTitleRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    テキストからタイトルを生成する
    
    Args:
        request: タイトル生成リクエスト
        current_user: 現在のユーザー情報
        
    Returns:
        タイトル生成レスポンス
    """
    try:
        ai_service = AIService()
        title = await ai_service.generate_title(request.text, request.max_length)
        return {"title": title}
    except Exception as e:
        logger.error(f"Error in generate_title endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"タイトル生成中にエラーが発生しました: {str(e)}")


@router.post("/proofread", response_model=ProofreadResponse, tags=["ai"])
async def proofread(
    request: ProofreadRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    テキストを校正する
    
    Args:
        request: 校正リクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/research", response_model=ResearchResponse, tags=["ai"])
async def research(
    request: ResearchRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    クエリに基づいてリサーチを行う
    
    Args:
        request: リサーチリクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/chat", response_model=ChatResponse, tags=["ai"])
async def chat(
    request: ChatRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    チャット形式でAIと対話する
    
    Args:
        request: チャットリクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/furigana", response_model=FuriganaResponse, tags=["ai"])
async def add_furigana(
    request: FuriganaRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    テキストに読み仮名（ふりがな）を追加する
    
    Args:
        request: 読み仮名リクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/convert", response_model=TextConvertResponse, tags=["ai"])
async def convert_text(
    request: TextConvertRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    テキストを指定された形式（漢字、ひらがな、カタカナ）に変換する
    
    Args:
        request: テキスト変換リクエスト
        current_user: 現在のユーザー情報
        
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


@router.post("/enhance-scanned-text", response_model=EnhanceScannedTextResponse, tags=["ai"])
async def enhance_scanned_text(
    request: EnhanceScannedTextRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    OCRで抽出されたテキストを文章構造・文法・スタイル解析で高品質なテキストに整形する
    
    Args:
        request: AI文章整形リクエスト
        current_user: 現在のユーザー情報
        
    Returns:
        AI文章整形レスポンス
    """
    try:
        ai_service = AIService()
        # 🆕 拡張されたパラメータを含むリクエスト処理
        result = await ai_service.enhance_scanned_text(
            text=request.text,
            analyze_structure=request.analyze_structure,
            correct_grammar=request.correct_grammar,
            improve_readability=request.improve_readability,
            format_style=request.format_style,
            language=request.language,
            # 写真スキャン専用オプション
            preserve_visual_structure=getattr(request, 'preserve_visual_structure', False),
            preserve_formatting=getattr(request, 'preserve_formatting', False),
            enhance_layout=getattr(request, 'enhance_layout', False),
            detect_headings=getattr(request, 'detect_headings', False),
            preserve_lists=getattr(request, 'preserve_lists', False),
            improve_spacing=getattr(request, 'improve_spacing', False),
            # 音声文字起こし専用オプション
            add_natural_breaks=getattr(request, 'add_natural_breaks', False),
            improve_flow=getattr(request, 'improve_flow', False),
            remove_filler_words=getattr(request, 'remove_filler_words', False),
            add_punctuation=getattr(request, 'add_punctuation', False),
            organize_content=getattr(request, 'organize_content', False),
            enhance_clarity=getattr(request, 'enhance_clarity', False),
            preserve_speaker_intent=getattr(request, 'preserve_speaker_intent', False)
        )
        return result
    except Exception as e:
        logger.error(f"Error in enhance_scanned_text endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"AI文章整形中にエラーが発生しました: {str(e)}")


@router.post("/dictionary", response_model=DictionaryResponse, tags=["ai"])
async def dictionary_lookup(
    request: DictionaryRequest,
    current_user: Dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    辞書で単語を検索する
    
    Args:
        request: 辞書検索リクエスト
        current_user: 現在のユーザー情報
        
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
