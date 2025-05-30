"""
しゃべるノート - Anthropic プロバイダー実装
Anthropic APIを使用したAI機能の実装
"""
import logging
import json
import re
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
        
        # Messages APIでサポートされている最新モデルを使用
        # Claude 3.7 Sonnetはウェブ検索機能をサポート
        self.model = "claude-3-7-sonnet-20250219"  # 最新モデルを使用
        self.fallback_model = "claude-2.1"  # フォールバック用モデル
        
        # ウェブ検索機能の設定
        self.use_web_search = True  # ウェブ検索機能を有効化
        
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
            system_prompt = """
            あなたは優れた要約者です。与えられたテキストを簡潔かつ正確に要約してください。
            元のテキストの主要なポイントを保持しつつ、冗長な部分を削除してください。
            """
            
            # 最大長の指定があれば追加
            user_content = f"次のテキストを要約してください: {text}"
            if max_length:
                user_content += f"\n要約は{max_length}文字以内にしてください。"
            
            try:
                # Messages APIを使用して要約を実行
                message = await self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_content}
                    ],
                    temperature=0.3,  # 要約は創造性より正確さを重視
                    max_tokens=1024,
                )
                
                return message.content[0].text
                
            except Exception as e:
                # Messages APIが失敗した場合、Completions APIにフォールバック
                logger.warning(f"Messages API failed, falling back to Completions API: {e}")
                
                # プロンプトを作成
                prompt = f"{anthropic.HUMAN_PROMPT} 次のテキストを要約してください: {text}"
                if max_length:
                    prompt += f"\n要約は{max_length}文字以内にしてください。"
                prompt += f" {anthropic.AI_PROMPT}"
                
                # Completions APIを使用
                completion = await self.client.completions.create(
                    model=self.fallback_model,
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
            
            try:
                # Messages APIを使用して校正を実行
                message = await self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": f"次のテキストを校正してください: {text}"}
                    ],
                    temperature=0.1,  # 校正は創造性より正確さを重視
                    max_tokens=2048,
                )
                
                result = message.content[0].text
                
            except Exception as e:
                # Messages APIが失敗した場合、Completions APIにフォールバック
                logger.warning(f"Messages API failed, falling back to Completions API: {e}")
                
                # プロンプトを作成
                prompt = f"{anthropic.HUMAN_PROMPT} 次のテキストを校正してください: {text} {anthropic.AI_PROMPT}"
                
                # Completions APIを使用
                completion = await self.client.completions.create(
                    model=self.fallback_model,
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
        ウェブ検索機能を使用して最新の情報を取得
        
        Args:
            query: 検索クエリ
            max_results: 最大結果数
            
        Returns:
            検索結果のリスト
        """
        if not self.api_key:
            return [{"title": "エラー", "content": "APIキーが設定されていないため、リサーチできません。"}]
        
        try:
            # システムプロンプトの作成
            system_prompt = "You are an expert researcher. Use web search tool to fetch up-to-date info."
            
            # システムプロンプトを拡張
            system_prompt = """
            You are an expert researcher. Use web search to fetch up-to-date information.
            
            IMPORTANT: Your response MUST be in this format ONLY:
            ```json
            [
              {
                "title": "First Result Title",
                "content": "First result detailed content",
                "relevance": 0.95,
                "source": "https://example.com/source1"
              },
              {
                "title": "Second Result Title",
                "content": "Second result detailed content",
                "relevance": 0.85,
                "source": "https://example2.com/source2"
              },
              {
                "title": "Third Result Title",
                "content": "Third result detailed content",
                "relevance": 0.75,
                "source": "https://example3.com/source3"
              }
            ]
            ```
            
            DO NOT include any text before or after the JSON code block.
            Each item MUST have title, content, relevance (0-1), and source (URL).
            """
            
            try:
                # Completions APIを使用してリサーチを実行
                logger.info(f"Using model {self.fallback_model} for research")
                
                # ユーザープロンプトの作成
                user_prompt = f"以下のトピックについて調査してください: {query}\n\n" \
                    f"重要: 必ず以下の形式でJSON配列を返してください。他の形式は受け付けません。\n" \
                    "[\n" \
                    "  {\"title\": \"タイトル1\", \"content\": \"内容1\", \"relevance\": 0.95, \"source\": \"https://example.com/1\"},\n" \
                    "  {\"title\": \"タイトル2\", \"content\": \"内容2\", \"relevance\": 0.9, \"source\": \"https://example.com/2\"},\n" \
                    "  {\"title\": \"タイトル3\", \"content\": \"内容3\", \"relevance\": 0.85, \"source\": \"https://example.com/3\"}\n" \
                    "]\n\n" \
                    "必ず上記の形式で返してください。情報が見つからない場合でも、必ず同じ形式で返してください。結果は必ず{max_results}個返してください。他のテキストは含めないでください。"
                
                # Completions APIを使用してリサーチを実行
                completion = await self.client.completions.create(
                    model=self.fallback_model,
                    prompt=f"{anthropic.HUMAN_PROMPT} {system_prompt}\n\n{user_prompt} {anthropic.AI_PROMPT}",
                    max_tokens_to_sample=4096,
                    temperature=0.3,
                    stop_sequences=["\nHuman:", "\n```\n"]
                )
                
                # レスポンスの取得
                raw = completion.completion
                
                # デバッグ用にログ出力
                logger.debug(f"Anthropic research response: {raw}")
                
                # JSON抽出関数
                def extract_json(text):
                    # 先頭の空白を除去
                    text = text.strip()
                    
                    # ケース1: ```json‥``` 形式を探す
                    json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
                    json_match = re.search(json_pattern, text, re.DOTALL)
                    
                    if json_match:
                        json_str = json_match.group(1).strip()
                    else:
                        # ケース2: テキスト全体が角括弧で囲まれているか確認
                        if text.startswith('[') and text.endswith(']'):
                            json_str = text
                        else:
                            # ケース3: 角括弧で囲まれた部分を探す
                            start_idx = text.find('[')
                            end_idx = text.rfind(']')
                            if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
                                json_str = text[start_idx:end_idx+1]
                            else:
                                # 見つからない場合はエラー
                                logger.error(f"No JSON array found in: {text[:100]}...")
                                raise ValueError("No JSON array found")
                    
                    # JSONをパース
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error: {e}, text: {json_str[:100]}...")
                        raise ValueError(f"Invalid JSON: {e}")
                    
                
                try:
                    # JSONを抽出してパース
                    results = extract_json(raw)
                    
                    # 結果を整形
                    formatted_results = []
                    for item in results:
                        if isinstance(item, dict) and "title" in item and "content" in item:
                            # relevanceがない場合はデフォルト値を設定
                            if "relevance" not in item:
                                item["relevance"] = 0.8
                            
                            # sourceがない場合はデフォルト値を設定
                            if "source" not in item:
                                item["source"] = "情報源なし"
                            
                            formatted_results.append(item)
                    
                    # 結果があれば返す
                    if formatted_results:
                        return formatted_results[:max_results]
                    
                    # 結果が空の場合はエラーを返す
                    raise ValueError("No valid results found in JSON")
                    
                except Exception as e:
                    # JSONパースエラーの場合は、生のレスポンスをログに出力してエラーを返す
                    logger.error(f"Error extracting JSON from research results: {e}")
                    logger.error(f"Raw response: {raw}")
                    
                    # URLを抽出してみる
                    url_pattern = r'https?://[^\s]+'
                    urls = re.findall(url_pattern, raw)
                    source = urls[0] if urls else "情報源なし"
                    
                    return [{
                        "title": query,
                        "content": raw,
                        "relevance": 1.0,
                        "source": source
                    }]
                
            except Exception as e:
                # Messages APIが失敗した場合、Completions APIにフォールバック
                logger.warning(f"Messages API failed, falling back to Completions API: {e}")
                
                # Completions APIを使用してリサーチを実行
                completion = await self.client.completions.create(
                    model=self.fallback_model,
                    prompt=f"{anthropic.HUMAN_PROMPT} {system_prompt}\n\n以下のトピックについて調査してください: {query} {anthropic.AI_PROMPT}",
                    max_tokens_to_sample=4096,
                    temperature=0.5,
                )
                
                result = completion.completion
                logger.debug(f"Anthropic research response (fallback): {result}")
                
                # 結果を整形して返す
                return [{
                    "title": query,
                    "content": result,
                    "relevance": 1.0,
                    "source": "情報源なし"
                }]
        
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
            
            try:
                # Messages APIを使用してチャットを実行
                # メッセージ形式をAnthropicの形式に変換
                anthropic_messages = []
                for msg in messages:
                    role = "user" if msg["role"] == "user" else "assistant"
                    anthropic_messages.append({"role": role, "content": msg["content"]})
                
                # Messages APIを使用してチャットを実行
                message = await self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=anthropic_messages,
                    temperature=0.7,
                    max_tokens=2048,
                )
                
                return message.content[0].text
                
            except Exception as e:
                # Messages APIが失敗した場合、Completions APIにフォールバック
                logger.warning(f"Messages API failed, falling back to Completions API: {e}")
                
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
                
                # Completions APIを使用
                completion = await self.client.completions.create(
                    model=self.fallback_model,
                    prompt=conversation,
                    temperature=0.7,
                    max_tokens_to_sample=2048,
                )
                
                return completion.completion
            
        except Exception as e:
            logger.error(f"Error in Anthropic chat: {e}")
            return f"チャット中にエラーが発生しました: {str(e)}"

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
            system_prompt = """
            あなたは優れたタイトル生成AIです。
            与えられたテキストの内容を理解し、その内容を端的に表現するタイトルを生成してください。
            タイトルは簡潔で、内容を正確に表現するものにしてください。
            必ず日本語で生成してください。
            """
            
            # 最大長の指定があれば追加
            user_content = f"以下のテキストの内容を端的に表現するタイトルを生成してください：\n{text}"
            if max_length:
                user_content += f"\nタイトルは{max_length}文字以内にしてください。"
            
            try:
                # Messages APIを使用してタイトル生成を実行
                message = await self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_content}
                    ],
                    temperature=0.3,  # タイトル生成は創造性より正確さを重視
                    max_tokens=100,  # タイトルなので短めに
                )
                
                # レスポンスからタイトルを取得
                title = message.content[0].text.strip()
                
                # 余分な説明やマークダウンを削除
                title = title.replace("タイトル：", "").replace("タイトル:", "").strip()
                title = title.replace('"', '').replace('"', '').strip()
                
                return title
                
            except Exception as e:
                # Messages APIが失敗した場合、Completions APIにフォールバック
                logger.warning(f"Messages API failed, falling back to Completions API: {e}")
                
                # プロンプトを作成
                prompt = f"{anthropic.HUMAN_PROMPT} 以下のテキストの内容を端的に表現するタイトルを生成してください：\n{text}"
                if max_length:
                    prompt += f"\nタイトルは{max_length}文字以内にしてください。"
                prompt += f" {anthropic.AI_PROMPT}"
                
                # Completions APIを使用
                completion = await self.client.completions.create(
                    model=self.fallback_model,
                    prompt=prompt,
                    temperature=0.3,  # タイトル生成は創造性より正確さを重視
                    max_tokens_to_sample=100,  # タイトルなので短めに
                )
                
                # レスポンスからタイトルを取得
                title = completion.completion.strip()
                
                # 余分な説明やマークダウンを削除
                title = title.replace("タイトル：", "").replace("タイトル:", "").strip()
                title = title.replace('"', '').replace('"', '').strip()
                
                return title
            
        except Exception as e:
            logger.error(f"Error in Anthropic generate_title: {e}")
            return f"タイトル生成中にエラーが発生しました: {str(e)}"
