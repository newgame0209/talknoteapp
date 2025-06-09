"""
しゃべるノート - AIサービス
AIプロバイダーを使用して、アプリケーションに必要なAI機能を提供する
"""
import logging
import re
from typing import Dict, List, Optional, Any, Union

from app.providers.ai.factory import AIProviderFactory
from app.providers.ai.base import BaseAIProvider
from app.providers.ai.yahoo import YahooProvider

# ロギング設定
logger = logging.getLogger(__name__)


class AIService:
    """
    AIサービス
    AIプロバイダーを使用して、アプリケーションに必要なAI機能を提供する
    """
    
    def __init__(self, provider_type: Optional[str] = None):
        """
        AIサービスの初期化
        
        Args:
            provider_type: プロバイダータイプ（"research", "chat", "openai", "anthropic"）
        """
        self.provider = AIProviderFactory.get_provider(provider_type)
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> str:
        """
        テキストを要約する
        
        Args:
            text: 要約するテキスト
            max_length: 要約の最大長（文字数）
            
        Returns:
            要約されたテキスト
        """
        try:
            return await self.provider.summarize(text, max_length)
        except Exception as e:
            logger.error(f"Error in summarize: {e}")
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
        try:
            return await self.provider.generate_title(text, max_length)
        except Exception as e:
            logger.error(f"Error in generate_title: {e}")
            return f"タイトル生成中にエラーが発生しました: {str(e)}"
    
    async def proofread(self, text: str) -> Dict[str, Any]:
        """
        テキストを校正する
        
        Args:
            text: 校正するテキスト
            
        Returns:
            校正結果（修正済みテキストと修正箇所のリスト）
        """
        try:
            return await self.provider.proofread(text)
        except Exception as e:
            logger.error(f"Error in proofread: {e}")
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
        try:
            # リサーチ用のプロバイダーを使用
            research_provider = AIProviderFactory.get_research_provider()
            return await research_provider.research(query, max_results)
        except Exception as e:
            logger.error(f"Error in research: {e}")
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
        try:
            return await self.provider.chat(messages, system_prompt)
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            return f"チャット中にエラーが発生しました: {str(e)}"
    
    async def add_furigana(self, text: str) -> Dict[str, Any]:
        """
        テキストに読み仮名（ふりがな）を追加する
        Yahoo! かな漢字変換APIを使用
        
        Args:
            text: 読み仮名を追加するテキスト
            
        Returns:
            読み仮名付きテキスト（HTML形式とプレーンテキスト）
        """
        try:
            # Yahoo! APIを使用
            yahoo_provider = YahooProvider()
            result = await yahoo_provider.add_furigana(text)
            
            # Yahoo! APIが失敗した場合（APIキーが設定されていない場合など）は、
            # OpenAIのチャットAPIを使用してフォールバック
            if "error" in result:
                logger.warning(f"Yahoo! API failed: {result.get('error')}. Falling back to OpenAI.")
                
                # 読み仮名追加用のプロンプト作成
                system_prompt = """
                あなたは日本語の専門家です。与えられた日本語テキストに読み仮名（ふりがな）を追加してください。
                以下の2つの形式で結果を返してください：
                1. HTML形式（ルビタグ使用）
                2. プレーンテキスト形式（括弧内にひらがなを記載）
                
                結果は以下のJSON形式で返してください：
                {
                    "html": "HTML形式のテキスト（ルビタグ使用）",
                    "plain": "プレーンテキスト形式（括弧内にひらがな）"
                }
                
                例：
                入力: 東京都
                出力: {
                    "html": "<ruby>東京<rt>とうきょう</rt></ruby><ruby>都<rt>と</rt></ruby>",
                    "plain": "東京(とうきょう)都(と)"
                }
                """
                
                # チャット形式で読み仮名を取得
                chat_result = await self.provider.chat(
                    [{"role": "user", "content": f"以下のテキストに読み仮名を追加してください：\n{text}"}],
                    system_prompt
                )
                
                # JSONレスポンスをパース
                import json
                try:
                    # JSONブロックを抽出（マークダウンコードブロックも考慮）
                    json_text = chat_result
                    if "```json" in chat_result:
                        json_text = chat_result.split("```json")[1].split("```")[0].strip()
                    elif "```" in chat_result:
                        json_text = chat_result.split("```")[1].split("```")[0].strip()
                    
                    parsed_result = json.loads(json_text)
                    return parsed_result
                except json.JSONDecodeError:
                    # JSONパースに失敗した場合は、テキストをそのまま返す
                    return {
                        "html": text,
                        "plain": text,
                        "error": "読み仮名の追加に失敗しました。"
                    }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in add_furigana: {e}")
            return {
                "html": text,
                "plain": text,
                "error": f"読み仮名の追加中にエラーが発生しました: {str(e)}"
            }
    
    async def convert_text(self, text: str, target_type: str) -> str:
        """
        テキストを指定された形式（漢字、ひらがな、カタカナ）に変換する
        
        Args:
            text: 変換するテキスト
            target_type: 変換先の形式（"kanji", "hiragana", "katakana"）
            
        Returns:
            変換されたテキスト
        """
        try:
            # 変換タイプの検証
            valid_types = ["kanji", "hiragana", "katakana"]
            if target_type not in valid_types:
                return f"無効な変換タイプです。有効な値: {', '.join(valid_types)}"
            
            # 日本語の表記変換用のプロンプト作成
            type_names = {
                "kanji": "漢字",
                "hiragana": "ひらがな",
                "katakana": "カタカナ"
            }
            
            system_prompt = f"""
            あなたは日本語の専門家です。与えられた日本語テキストを{type_names[target_type]}に変換してください。
            変換後のテキストのみを返してください。説明は不要です。
            """
            
            # チャット形式で変換を取得
            result = await self.provider.chat(
                [{"role": "user", "content": f"以下のテキストを{type_names[target_type]}に変換してください：\n{text}"}],
                system_prompt
            )
            
            # 余分な説明やマークダウンを削除
            result = re.sub(r'^```.*?$', '', result, flags=re.MULTILINE)
            result = re.sub(r'^.*?：', '', result, flags=re.MULTILINE)
            result = result.strip()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in convert_text: {e}")
            return f"テキスト変換中にエラーが発生しました: {str(e)}"
    
    async def dictionary_lookup(self, word: str) -> Dict[str, Any]:
        """
        辞書で単語を検索する
        Yahoo! 辞書APIを使用
        
        Args:
            word: 検索する単語
            
        Returns:
            辞書検索結果
        """
        try:
            # Yahoo! APIを使用
            yahoo_provider = YahooProvider()
            result = await yahoo_provider.dictionary_lookup(word)
            
            # Yahoo! APIが失敗した場合（APIキーが設定されていない場合など）は、
            # OpenAIのチャットAPIを使用してフォールバック
            if "error" in result:
                logger.warning(f"Yahoo! API failed: {result.get('error')}. Falling back to OpenAI.")
                
                # 辞書検索用のプロンプト作成
                system_prompt = """
                あなたは優れた辞書です。与えられた単語の意味、読み方、例文、語源などの情報を提供してください。
                結果は以下のJSON形式で返してください：
                {
                    "word": "検索された単語",
                    "readings": ["読み方1", "読み方2", ...],
                    "meanings": [
                        {
                            "definition": "意味の定義",
                            "examples": ["例文1", "例文2", ...],
                            "part_of_speech": "品詞"
                        },
                        ...
                    ],
                    "etymology": "語源（分かる場合）",
                    "related_words": ["関連語1", "関連語2", ...]
                }
                """
                
                # チャット形式で辞書検索を取得
                chat_result = await self.provider.chat(
                    [{"role": "user", "content": f"以下の単語を辞書で調べてください：\n{word}"}],
                    system_prompt
                )
                
                # JSONレスポンスをパース
                import json
                try:
                    # JSONブロックを抽出（マークダウンコードブロックも考慮）
                    json_text = chat_result
                    if "```json" in chat_result:
                        json_text = chat_result.split("```json")[1].split("```")[0].strip()
                    elif "```" in chat_result:
                        json_text = chat_result.split("```")[1].split("```")[0].strip()
                    
                    parsed_result = json.loads(json_text)
                    return parsed_result
                except json.JSONDecodeError:
                    # JSONパースに失敗した場合は、テキストをそのまま返す
                    return {
                        "word": word,
                        "error": "辞書検索結果のパースに失敗しました。",
                        "raw_response": chat_result
                    }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in dictionary_lookup: {e}")
            return {
                "word": word,
                "error": f"辞書検索中にエラーが発生しました: {str(e)}"
            }

    async def enhance_scanned_text(
        self, 
        text: str, 
        analyze_structure: bool = True,
        correct_grammar: bool = True,
        improve_readability: bool = True,
        format_style: str = 'structured',
        language: str = 'ja',
        # 🆕 写真スキャン専用の高度な整形オプション
        preserve_visual_structure: bool = False,
        preserve_formatting: bool = False,
        enhance_layout: bool = False,
        detect_headings: bool = False,
        preserve_lists: bool = False,
        improve_spacing: bool = False,
        # 🆕 音声文字起こし専用の高度な整形オプション
        add_natural_breaks: bool = False,
        improve_flow: bool = False,
        remove_filler_words: bool = False,
        add_punctuation: bool = False,
        organize_content: bool = False,
        enhance_clarity: bool = False,
        preserve_speaker_intent: bool = False,
        **kwargs  # 将来の拡張用
    ) -> Dict[str, Any]:
        """
        OCRで抽出されたテキストを文章構造・文法・スタイル解析で高品質なテキストに整形する
        
        Args:
            text: OCRで抽出された元のテキスト
            analyze_structure: 文章構造を解析するか
            correct_grammar: 文法修正を行うか
            improve_readability: 読みやすさを向上させるか
            format_style: 整形スタイル（'structured', 'narrative', 'bullet_points'）
            language: 処理言語（'ja'、'en'）
            
        Returns:
            整形結果（enhanced_text、confidence、original_text）
        """
        try:
            # 🆕 より詳細で高機能なシステムプロンプト作成
            system_prompt = f"""
            あなたは優秀な文章解析・整形専門家です。OCR（光学文字認識）または音声文字起こしで抽出されたテキストを、
            高品質で読みやすい文章に整形してください。

            ## 基本処理要件
            - 言語: {language}
            - 文章構造解析: {'有効' if analyze_structure else '無効'}
            - 文法修正: {'有効' if correct_grammar else '無効'}
            - 読みやすさ向上: {'有効' if improve_readability else '無効'}
            - 整形スタイル: {format_style}

            ## 写真スキャン専用処理（format_style='visual_preserve'時）
            - 視覚的構造保持: {'有効' if preserve_visual_structure else '無効'}
            - 書式保持（太字・見出し等）: {'有効' if preserve_formatting else '無効'}
            - レイアウト改善: {'有効' if enhance_layout else '無効'}
            - 見出し自動検出: {'有効' if detect_headings else '無効'}
            - リスト構造保持: {'有効' if preserve_lists else '無効'}
            - 行間・段落間隔改善: {'有効' if improve_spacing else '無効'}

            ## 音声文字起こし専用処理（format_style='speech_to_text'時）
            - 自然な改行・段落分け: {'有効' if add_natural_breaks else '無効'}
            - 文章の流れ改善: {'有効' if improve_flow else '無効'}
            - フィラーワード除去: {'有効' if remove_filler_words else '無効'}
            - 句読点追加: {'有効' if add_punctuation else '無効'}
            - 内容の論理的整理: {'有効' if organize_content else '無効'}
            - 明瞭性向上: {'有効' if enhance_clarity else '無効'}
            - 話者意図保持: {'有効' if preserve_speaker_intent else '無効'}

            ## 処理対象の問題点
            ### OCRテキストによくある問題：
            1. 文字認識ミス（類似文字の誤認識）
            2. 改行や段落の構造が崩れている
            3. 句読点や記号の配置がおかしい
            4. 文脈に合わない文字変換
            5. 表や箇条書きの構造が失われている

            ### 音声文字起こしによくある問題：
            1. 「えー」「あのー」「まあ」等のフィラーワード
            2. 句読点の不足・不適切な配置
            3. 改行や段落分けがない
            4. 話し言葉と書き言葉の混在
            5. 論理的な流れが分かりにくい

            ## 高品質整形ガイドライン
            ### 写真スキャン時（visual_preserve）：
            1. **太字・見出し構造の再現**: 元画像で太字や大きな文字だった箇所は**太字**で表現
            2. **視覚的階層の保持**: 見出し1 > 見出し2 > 本文の階層構造を明確化
            3. **リスト・表構造の再現**: 箇条書きや番号付きリストを適切に整形
            4. **レイアウト改善**: 読みやすい行間・段落間隔を追加
            5. **元の意味・内容は絶対に変更しない**

            ### 音声文字起こし時（speech_to_text）：
            1. **自然な改行**: 意味のまとまりで適切に段落分け
            2. **フィラーワード処理**: 「えー」「あのー」等は文脈を損なわない範囲で除去
            3. **句読点の追加**: 話の区切りに適切な句読点を追加
            4. **文章の流れ改善**: 論理的で読みやすい構造に再構成
            5. **話者の意図保持**: 元の発言の趣旨や感情を完全に保持**

            結果は以下のJSON形式で返してください：
            {{
                "enhanced_text": "整形済み高品質テキスト",
                "confidence": 0.95,
                "improvements": [
                    "修正・改善内容1",
                    "修正・改善内容2"
                ],
                "structure_analysis": "文章構造の分析結果",
                "original_preserved": true
            }}
            """
            
            # 🆕 format_styleに応じた詳細なユーザープロンプト作成
            if format_style == 'speech_to_text':
                # 音声文字起こし専用プロンプト
                user_prompt = f"""
                以下の音声文字起こしテキストを、読みやすい文章に整形してください：

                【音声文字起こしテキスト】
                {text}

                【音声文字起こし専用整形要求】
                1. **自然な改行・段落分け**: 意味のまとまりごとに適切に改行し、読みやすい段落を作成
                2. **句読点の追加**: 話の区切りに「。」「、」を適切に配置
                3. **フィラーワード除去**: 「えー」「あのー」「まあ」等は文脈を損なわない範囲で除去
                4. **文章の流れ改善**: 論理的で自然な文章構造に整理
                5. **話し言葉の調整**: 必要に応じて書き言葉に調整（話者の意図は保持）
                6. **視覚的読みやすさ**: 1文が長すぎる場合は適切に分割

                【重要】
                - 改行を多用して、1つの文や段落が長くなりすぎないようにする
                - 各段落は2-3文程度に収める
                - 話者の意図や感情は完全に保持する
                - 内容の追加や削除は行わない

                音声文字起こしの特徴を考慮し、**段落分けと改行を重視**して整形してください。
                """
            elif format_style == 'visual_preserve':
                # 写真スキャン専用プロンプト
                user_prompt = f"""
                以下の写真スキャンテキストを、元画像の視覚的構造を保持しながら整形してください：

                【写真スキャンテキスト】
                {text}

                【写真スキャン専用整形要求】
                1. **視覚的構造保持**: 元画像の太字、見出し、リスト構造を再現
                2. **階層構造明確化**: 見出し1 > 見出し2 > 本文の階層を**太字**で表現
                3. **リスト・表構造**: 箇条書きや番号付きリストを適切に整形
                4. **レイアウト改善**: 読みやすい行間・段落間隔を追加
                5. **書式の再現**: 重要な部分は**太字**で強調

                元画像の構造を最大限に再現してください。
                """
            else:
                # 汎用プロンプト
                user_prompt = f"""
                以下のテキストを整形してください：

                【テキスト】
                {text}

                【整形要求】
                - スタイル: {format_style}
                - 元の内容・意味を保持しながら、読みやすく整形してください
                - 明らかな誤字・脱字は適切に修正してください
                - 段落構成を見直し、情報を整理してください
                """
            
            # AIプロバイダーで整形処理を実行
            result = await self.provider.chat(
                [{"role": "user", "content": user_prompt}],
                system_prompt
            )
            
            # JSONレスポンスをパース
            import json
            try:
                # JSONブロックを抽出（マークダウンコードブロックも考慮）
                json_text = result
                if "```json" in result:
                    json_text = result.split("```json")[1].split("```")[0].strip()
                elif "```" in result:
                    json_text = result.split("```")[1].split("```")[0].strip()
                
                parsed_result = json.loads(json_text)
                
                # 結果の検証
                if "enhanced_text" not in parsed_result:
                    raise ValueError("enhanced_text field missing in response")
                
                # デフォルト値の設定
                parsed_result.setdefault("confidence", 0.8)
                parsed_result.setdefault("improvements", [])
                parsed_result.setdefault("structure_analysis", "構造解析が実行されました")
                parsed_result.setdefault("original_preserved", True)
                
                logger.info(f"Text enhancement completed successfully. Original: {len(text)} chars, Enhanced: {len(parsed_result['enhanced_text'])} chars")
                
                return {
                    "enhanced_text": parsed_result["enhanced_text"],
                    "confidence": parsed_result["confidence"],
                    "improvements": parsed_result["improvements"],
                    "structure_analysis": parsed_result["structure_analysis"],
                    "original_text": text,
                    "original_preserved": parsed_result["original_preserved"],
                    "error": None
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed in enhance_scanned_text: {e}")
                # JSONパースに失敗した場合は、AIの回答をそのまま整形テキストとして使用
                return {
                    "enhanced_text": result.strip(),
                    "confidence": 0.7,
                    "improvements": ["AI整形処理が完了しました"],
                    "structure_analysis": "整形処理が実行されました",
                    "original_text": text,
                    "original_preserved": True,
                    "error": f"JSON解析エラー（整形は実行済み）: {str(e)}"
                }
            except ValueError as e:
                logger.error(f"Response validation failed in enhance_scanned_text: {e}")
                # 基本的なフォールバック処理
                return {
                    "enhanced_text": text,  # 元のテキストをそのまま返す
                    "confidence": 0.5,
                    "improvements": [],
                    "structure_analysis": "解析に失敗しました",
                    "original_text": text,
                    "original_preserved": True,
                    "error": f"レスポンス検証エラー: {str(e)}"
                }
                
        except Exception as e:
            logger.error(f"Error in enhance_scanned_text: {e}")
            return {
                "enhanced_text": text,  # エラー時は元のテキストを返す
                "confidence": 0.0,
                "improvements": [],
                "structure_analysis": "エラーにより解析できませんでした",
                "original_text": text,
                "original_preserved": True,
                "error": f"テキスト整形中にエラーが発生しました: {str(e)}"
            }
