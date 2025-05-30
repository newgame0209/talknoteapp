"""
しゃべるノート - OpenAI プロバイダー実装
OpenAI APIを使用したAI機能の実装
"""
import logging
from typing import Dict, List, Optional, Any, Union

import openai
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.core.settings import settings
from app.providers.ai.base import BaseAIProvider

# ロギング設定
logger = logging.getLogger(__name__)


class OpenAIProvider(BaseAIProvider):
    """
    OpenAI APIを使用したAIプロバイダー
    """
    
    def __init__(self):
        """
        OpenAIプロバイダーの初期化
        設定からAPIキーとモデルを取得
        """
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        
        if not self.api_key:
            logger.warning("OpenAI API key is not set. OpenAI provider will not work.")
        
        self.client = AsyncOpenAI(api_key=self.api_key)
    
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
            # 要約用のプロンプト作成
            system_prompt = "あなたは優れた要約者です。与えられたテキストを簡潔にかつ重要な部分を重点的に抑えて要約してください。"
            if max_length:
                system_prompt += f" 要約は{max_length}文字以内にしてください。"
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.3,  # 要約は創造性より正確さを重視
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error in OpenAI summarize: {e}")
            return f"要約中にエラーが発生しました: {str(e)}"

    async def generate_title(self, text: str, max_length: Optional[int] = None) -> str:
        """
        テキストからタイトルを生成する
        
        Args:
            text: タイトル生成元のテキスト
            max_length: タイトルの最大長（文字数）
            
        Returns:
            生成されたタイトル
        """
        if not self.api_key:
            return "APIキーが設定されていないため、タイトルを生成できません。"
        
        try:
            # タイトル生成用のプロンプト作成
            system_prompt = """
            あなたは優れたタイトル生成AIです。
            与えられたテキストの内容を理解し、その内容を端的に表現するタイトルを生成してください。
            タイトルは簡潔で、内容を正確に表現するものにしてください。
            必ず日本語で生成してください。
            """
            
            # プロンプトを作成
            user_content = f"以下のテキストの内容を端的に表現するタイトルを生成してください：\n{text}"
            if max_length:
                user_content += f"\nタイトルは{max_length}文字以内にしてください。"
            
            # OpenAI APIを呼び出し
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.3,  # タイトル生成は創造性より正確さを重視
                max_tokens=100,  # タイトルなので短めに
            )
            
            # レスポンスからタイトルを取得
            title = response.choices[0].message.content.strip()
            
            # 余分な説明やマークダウンを削除
            title = title.replace("タイトル：", "").replace("タイトル:", "").strip()
            title = title.replace('"', '').replace('"', '').strip()
            
            return title
            
        except Exception as e:
            logger.error(f"Error in OpenAI generate_title: {e}")
            return f"タイトル生成中にエラーが発生しました: {str(e)}"
    
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
            # 校正用のプロンプト作成
            system_prompt = """
            あなたは優れた校正者です。与えられたテキストの誤字脱字、文法ミス、表現の改善点を見つけて修正してください。
            修正結果は以下のJSON形式で返してください：
            {
                "corrected_text": "修正後のテキスト全文",
                "corrections": [
                    {
                        "original": "元のテキスト",
                        "corrected": "修正後のテキスト",
                        "reason": "修正理由"
                    },
                    ...
                ]
            }
            修正がない場合は、corrections配列を空にしてください。
            """
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.1,  # 校正は創造性より正確さを重視
                response_format={"type": "json_object"}
            )
            
            result = response.choices[0].message.content.strip()
            
            # JSONレスポンスをパース
            import json
            try:
                parsed_result = json.loads(result)
                return parsed_result
            except json.JSONDecodeError:
                # JSONパースに失敗した場合は、テキストをそのまま返す
                return {
                    "corrected_text": text,
                    "corrections": [],
                    "error": "校正結果のパースに失敗しました。"
                }
            
        except Exception as e:
            logger.error(f"Error in OpenAI proofread: {e}")
            return {
                "corrected_text": text,
                "corrections": [],
                "error": f"校正中にエラーが発生しました: {str(e)}"
            }
    
    async def research(self, query: str, max_results: int = 3) -> List[Dict[str, Any]]:
        """
        クエリに基づいてリサーチを行う
        
        Args:
            query: 検索クエリ
            max_results: 最大結果数
            
        Returns:
            検索結果のリスト
        """
        if not self.api_key:
            return [{"title": "エラー", "content": "APIキーが設定されていないため、リサーチできません。"}]
        
        try:
            # リサーチ用のプロンプト作成
            system_prompt = f"""
            あなたは優れたリサーチャーです。与えられたクエリに基づいて、最大{max_results}件の関連情報を提供してください。
            各結果には、タイトル、内容、関連度を含めてください。
            結果は以下のJSON形式で返してください：
            [
                {{
                    "title": "タイトル",
                    "content": "内容の要約",
                    "relevance": 0.9  // 0.0〜1.0の関連度
                }},
                ...
            ]
            """
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"以下のトピックについて調査してください: {query}"}
                ],
                temperature=0.5,
                response_format={"type": "json_object"}
            )
            
            result = response.choices[0].message.content.strip()
            
            # JSONレスポンスをパース
            import json
            try:
                parsed_result = json.loads(result)
                return parsed_result
            except json.JSONDecodeError:
                # JSONパースに失敗した場合は、エラーメッセージを返す
                return [{"title": "エラー", "content": "リサーチ結果のパースに失敗しました。"}]
            
        except Exception as e:
            logger.error(f"Error in OpenAI research: {e}")
            return [{"title": "エラー", "content": f"リサーチ中にエラーが発生しました: {str(e)}"}]
    
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
                system_prompt = "あなたは親切で役立つ学習AIアシスタントです。ユーザーの質問に簡潔にかつ的確に答えてください。"
            
            # メッセージリストの先頭にシステムプロンプトを追加
            chat_messages = [{"role": "system", "content": system_prompt}]
            chat_messages.extend(messages)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=chat_messages,
                temperature=0.7,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error in OpenAI chat: {e}")
            return f"チャット中にエラーが発生しました: {str(e)}"
