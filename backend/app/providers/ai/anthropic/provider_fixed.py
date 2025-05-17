"""
しゃべるノート - Anthropic プロバイダー実装
Anthropic APIを使用したAI機能の実装
"""
import logging
import json
from typing import Dict, List, Optional, Any, Union

import anthropic
from anthropic import AsyncAnthropic

from app.core.settings import settings
from app.providers.ai.base import BaseAIProvider

# ロギング設定
logger = logging.getLogger(__name__)


class AnthropicProvider(BaseAIProvider):
    """
    Anthropic APIを使用したAIプロバイダー
    主にリサーチ機能に特化
    """
    
    def __init__(self):
        """
        Anthropicプロバイダーの初期化
        設定からAPIキーとモデルを取得
        """
        self.api_key = settings.ANTHROPIC_API_KEY
        
        # Completions APIでサポートされているモデルを使用
        # Claude-2.1は安定しているモデル
        self.model = "claude-2.1"
        
        if not self.api_key:
            logger.warning("Anthropic API key is not set. Anthropic provider will not work.")
        
        # Anthropic APIクライアントの初期化
        # AsyncAnthropicを使用して非同期処理を行う
        self.client = AsyncAnthropic(api_key=self.api_key)
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> str:
        """
        テキストを要約する
        
        Args:
            text: 要約するテキスト
            max_length: 要約の最大長（文字数）
            
        Returns:
            要約されたテキスト
        """
        if not self.api_key:
            return "APIキーが設定されていないため、要約できません。"
        
        try:
            # システムプロンプトを設定
            system_prompt = """
            あなたは優れた要約者です。与えられたテキストを簡潔かつ正確に要約してください。
            元のテキストの主要なポイントを保持しつつ、冗長な部分を削除してください。
            """
            
            # プロンプトを作成
            prompt = f"{anthropic.HUMAN_PROMPT} 次のテキストを要約してください: {text}"
            if max_length:
                prompt += f"\n要約は{max_length}文字以内にしてください。"
            prompt += f" {anthropic.AI_PROMPT}"
            
            # Anthropicの後方互換性のためのメソッドを使用
            completion = await self.client.completions.create(
                model=self.model,
                prompt=prompt,
                temperature=0.3,  # 要約は創造性より正確さを重視
                max_tokens_to_sample=1024,
            )
            
            return completion.completion
            
        except Exception as e:
            logger.error(f"Error in Anthropic summarize: {e}")
            return f"要約中にエラーが発生しました: {str(e)}"
    
    async def proofread(self, text: str) -> Dict[str, Any]:
        """
        テキストを校正する
        
        Args:
            text: 校正するテキスト
            
        Returns:
            校正結果（修正済みテキストと修正箇所のリスト）
        """
        if not self.api_key:
            return {
                "corrected_text": text,
                "corrections": [],
                "error": "APIキーが設定されていないため、校正できません。"
            }
        
        try:
            system_prompt = """
            あなたは優れた校正者です。与えられたテキストの文法、スペル、表現などの誤りを修正してください。
            修正結果は以下のJSON形式で返してください：
            
            ```json
            {
                "corrected_text": "修正後のテキスト全文",
                "corrections": [
                    {
                        "original": "誤りのある部分",
                        "corrected": "修正後の部分",
                        "explanation": "修正理由の簡単な説明"
                    },
                    ...
                ]
            }
            ```
            
            必ずJSON形式で返してください。
            """
            
            # プロンプトを作成
            prompt = f"{anthropic.HUMAN_PROMPT} 次のテキストを校正してください: {text} {anthropic.AI_PROMPT}"
            
            # Anthropicの後方互換性のためのメソッドを使用
            completion = await self.client.completions.create(
                model=self.model,
                prompt=prompt,
                temperature=0.1,  # 校正は創造性より正確さを重視
                max_tokens_to_sample=2048,
            )
            
            result = completion.completion
            
            # JSONレスポンスをパース
            try:
                # JSONブロックを抽出（マークダウンコードブロックも考慮）
                json_text = result
                if "```json" in result:
                    json_text = result.split("```json")[1].split("```")[0].strip()
                elif "```" in result:
                    json_text = result.split("```")[1].split("```")[0].strip()
                
                parsed_result = json.loads(json_text)
                return parsed_result
            except json.JSONDecodeError:
                # JSONパースに失敗した場合は、テキストをそのまま返す
                return {
                    "corrected_text": text,
                    "corrections": [],
                    "error": "校正結果のパースに失敗しました。"
                }
            
        except Exception as e:
            logger.error(f"Error in Anthropic proofread: {e}")
            return {
                "corrected_text": text,
                "corrections": [],
                "error": f"校正中にエラーが発生しました: {str(e)}"
            }
    
    async def research(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """
        クエリに基づいてリサーチを行う
        Anthropicの強みを活かした詳細なリサーチ
        
        Args:
            query: 検索クエリ
            max_results: 最大結果数
            
        Returns:
            検索結果のリスト
        """
        if not self.api_key:
            return [{"title": "エラー", "content": "APIキーが設定されていないため、リサーチできません。"}]
        
        try:
            system_prompt = f"""
            あなたは学術研究と情報収集の専門家です。与えられたトピックについて、正確で詳細な情報を提供してください。
            
            レスポンスは以下の形式で返してください：
            
            ```json
            [
                {{
                    "title": "タイトル1",
                    "content": "内容1",
                    "relevance": 0.95
                }},
                {{
                    "title": "タイトル2",
                    "content": "内容2",
                    "relevance": 0.85
                }},
                ...
            ]
            ```
            
            各結果は以下の要素を含む必要があります：
            - title: 結果のタイトル・見出し
            - content: 詳細な内容や説明
            - relevance: クエリとの関連性スコア（0～1）
            
            最大{max_results}個の結果を返してください。関連性が高い順にソートしてください。
            必ずJSON形式で返してください。
            """
            
            # Anthropicの後方互換性のためのメソッドを使用
            completion = await self.client.completions.create(
                model=self.model,
                prompt=f"{anthropic.HUMAN_PROMPT} {system_prompt}\n\n以下のトピックについて調査してください: {query} {anthropic.AI_PROMPT}",
                max_tokens_to_sample=4096,
                temperature=0.5,
            )
            
            result = completion.completion
            logger.debug(f"Anthropic research response: {result}")
            
            # JSONレスポンスをパース
            try:
                # JSONブロックを抽出（マークダウンコードブロックも考慮）
                json_text = result
                if "```json" in result:
                    json_text = result.split("```json")[1].split("```")[0].strip()
                elif "```" in result:
                    json_text = result.split("```")[1].split("```")[0].strip()
                
                # 角括弧で囲まれた部分を抽出
                json_text = json_text.strip()
                if not (json_text.startswith("[") and json_text.endswith("]")):
                    # 角括弧で囲まれた部分を探す
                    start_idx = json_text.find("[")
                    end_idx = json_text.rfind("]")
                    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
                        json_text = json_text[start_idx:end_idx+1]
                
                # デバッグ用にログ出力
                logger.debug(f"Attempting to parse JSON: {json_text}")
                
                parsed_result = json.loads(json_text)
                
                # リサーチ結果をフォーマットする
                if isinstance(parsed_result, list):
                    # max_resultsに制限
                    return parsed_result[:max_results]
                else:
                    # リストでない場合はエラー
                    return [{"title": "フォーマットエラー", "content": "リサーチ結果が正しい形式ではありません。", "relevance": 0}]
            except json.JSONDecodeError as e:
                # JSONパースに失敗した場合は、エラーメッセージを返す
                logger.error(f"JSON decode error: {e}, text: {json_text}")
                return [{"title": "エラー", "content": "リサーチ結果のパースに失敗しました。", "relevance": 0}]
            
        except Exception as e:
            logger.error(f"Error in Anthropic research: {e}")
            return [{"title": "エラー", "content": f"リサーチ中にエラーが発生しました: {str(e)}", "relevance": 0}]
    
    async def chat(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """
        チャット形式でAIと対話する
        
        Args:
            messages: メッセージのリスト（{"role": "user", "content": "こんにちは"}形式）
            system_prompt: システムプロンプト（AIの振る舞いを指定）
            
        Returns:
            AIの応答
        """
        if not self.api_key:
            return "APIキーが設定されていないため、チャットできません。"
        
        try:
            # システムプロンプトがない場合はデフォルトを使用
            if not system_prompt:
                system_prompt = "あなたは親切で役立つAIアシスタントです。ユーザーの質問に簡潔に答えてください。"
            
            # メッセージをテキスト形式に変換
            conversation = ""
            for msg in messages:
                if msg["role"] == "user":
                    conversation += f"{anthropic.HUMAN_PROMPT} {msg['content']}\n"
                elif msg["role"] == "assistant":
                    conversation += f"{anthropic.AI_PROMPT} {msg['content']}\n"
            
            # 最後のメッセージがユーザーの場合、AIプロンプトを追加
            if not conversation.endswith(anthropic.AI_PROMPT):
                conversation += anthropic.AI_PROMPT
            
            # メッセージをClaudeの会話形式に変換
            conversation = anthropic.HUMAN_PROMPT
            
            # システムプロンプトがあれば先頭に追加
            if system_prompt:
                conversation += f"\n\n{system_prompt}\n\n"
            
            # 会話履歴を構築
            for i, msg in enumerate(messages):
                if msg["role"] == "user":
                    if i > 0:  # 最初のメッセージでない場合はプロンプトを追加
                        conversation += anthropic.HUMAN_PROMPT
                    conversation += msg["content"]
                else:  # assistant
                    conversation += anthropic.AI_PROMPT + msg["content"]
            
            # 最後にAIプロンプトを追加
            if not conversation.endswith(anthropic.AI_PROMPT):
                conversation += anthropic.AI_PROMPT
            
            # Anthropicの後方互換性のためのメソッドを使用
            completion = await self.client.completions.create(
                model=self.model,
                prompt=conversation,
                temperature=0.7,
                max_tokens_to_sample=2048,
            )
            
            return completion.completion
            
        except Exception as e:
            logger.error(f"Error in Anthropic chat: {e}")
            return f"チャット中にエラーが発生しました: {str(e)}"
