"""
しゃべるノート - Yahoo! プロバイダー実装
Yahoo! APIを使用した日本語処理機能の実装
"""
import logging
import json
from typing import Dict, List, Optional, Any, Union

import aiohttp

from app.core.settings import settings

# ロギング設定
logger = logging.getLogger(__name__)


class YahooProvider:
    """
    Yahoo! APIを使用した日本語処理プロバイダー
    読み仮名付与と辞書検索機能を提供
    """
    
    def __init__(self):
        """
        Yahoo!プロバイダーの初期化
        設定からAPIキーとエンドポイントを取得
        """
        self.client_id = settings.YAHOO_API_CLIENT_ID
        self.furigana_api_url = settings.YAHOO_FURIGANA_API_URL
        self.dictionary_api_url = settings.YAHOO_DICTIONARY_API_URL
        
        if not self.client_id:
            logger.warning("Yahoo! API client ID is not set. Yahoo! provider will not work.")
    
    async def add_furigana(self, text: str) -> Dict[str, Any]:
        """
        テキストに読み仮名（ふりがな）を追加する
        
        Args:
            text: 読み仮名を追加するテキスト
            
        Returns:
            読み仮名付きテキスト（HTML形式とプレーンテキスト）
        """
        if not self.client_id:
            return {
                "html": text,
                "plain": text,
                "error": "Yahoo! API client IDが設定されていないため、読み仮名を追加できません。"
            }
        
        try:
            # リクエストデータの作成
            request_data = {
                "id": "1234-1",
                "jsonrpc": "2.0",
                "method": "jlp.furiganaservice.furigana",
                "params": {
                    "q": text,
                    "grade": 1  # 学年指定（1: 小学校1年生レベル）
                }
            }
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "Yahoo AppID: {}".format(self.client_id)
            }
            
            # APIリクエスト
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.furigana_api_url,
                    headers=headers,
                    json=request_data
                ) as response:
                    if response.status != 200:
                        return {
                            "html": text,
                            "plain": text,
                            "error": f"Yahoo! API error: {response.status}"
                        }
                    
                    result = await response.json()
            
            # レスポンスの解析
            if "result" not in result:
                return {
                    "html": text,
                    "plain": text,
                    "error": "Yahoo! APIからの応答が不正です。"
                }
            
            # HTML形式（ルビタグ）とプレーンテキスト形式（括弧）の生成
            html_text = ""
            plain_text = ""
            
            for word in result["result"]["word"]:
                if "furigana" in word and word["furigana"]:
                    # ルビ付きテキスト
                    html_text += f'<ruby>{word["surface"]}<rt>{word["furigana"]}</rt></ruby>'
                    # 括弧付きテキスト
                    plain_text += f'{word["surface"]}({word["furigana"]})'
                else:
                    # ふりがなのない単語はそのまま
                    html_text += word["surface"]
                    plain_text += word["surface"]
            
            return {
                "html": html_text,
                "plain": plain_text
            }
            
        except Exception as e:
            logger.error(f"Error in Yahoo! add_furigana: {e}")
            return {
                "html": text,
                "plain": text,
                "error": f"読み仮名の追加中にエラーが発生しました: {str(e)}"
            }
    
    async def dictionary_lookup(self, word: str) -> Dict[str, Any]:
        """
        辞書で単語を検索する
        
        Args:
            word: 検索する単語
            
        Returns:
            辞書検索結果
        """
        if not self.client_id:
            return {
                "word": word,
                "error": "Yahoo! API client IDが設定されていないため、辞書検索できません。"
            }
        
        try:
            # リクエストデータの作成
            request_data = {
                "id": "1234-1",
                "jsonrpc": "2.0",
                "method": "jlp.daservice.parse",
                "params": {
                    "q": word
                }
            }
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "Yahoo AppID: {}".format(self.client_id)
            }
            
            # APIリクエスト
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.dictionary_api_url,
                    headers=headers,
                    json=request_data
                ) as response:
                    if response.status != 200:
                        return {
                            "word": word,
                            "error": f"Yahoo! API error: {response.status}"
                        }
                    
                    result = await response.json()
            
            # レスポンスの解析
            logger.debug(f"Yahoo! API dictionary response: {json.dumps(result, ensure_ascii=False)}")
            
            # 辞書結果の整形
            formatted_result = {
                "word": word,
                "readings": [],
                "meanings": [],
                "etymology": None,
                "related_words": [],
                "error": None
            }
            
            try:
                # Yahoo! 辞書APIのレスポンス構造に合わせて解析
                if "result" in result:
                    # 形態素解析結果から情報を抽出
                    if "tokens" in result["result"]:
                        for token in result["result"]["tokens"]:
                            # 読みを取得
                            if "reading" in token and token["reading"] and token["reading"] not in formatted_result["readings"]:
                                formatted_result["readings"].append(token["reading"])
                            
                            # 品詞情報を取得
                            pos = token.get("pos", "")
                            
                            # 基本形と意味を取得
                            if "lemma" in token and token["lemma"] != word:
                                # 基本形が入力単語と異なる場合は意味として扱う
                                definition = token.get("lemma", "")
                                if definition and len(definition) > 1:  # 意味として有効な長さがある場合
                                    meaning = {
                                        "definition": definition,
                                        "examples": [],
                                        "part_of_speech": pos
                                    }
                                    # 重複しないようにチェック
                                    if not any(m["definition"] == definition for m in formatted_result["meanings"]):
                                        formatted_result["meanings"].append(meaning)
                    
                    # 読みがない場合は入力単語をそのまま読みとして追加
                    if not formatted_result["readings"] and "reading" in result["result"]:
                        formatted_result["readings"].append(result["result"]["reading"])
                
                # 結果が空の場合、バックアップとして入力単語を意味として追加
                if not formatted_result["meanings"]:
                    formatted_result["meanings"].append({
                        "definition": word,
                        "examples": [],
                        "part_of_speech": ""
                    })
            except Exception as e:
                logger.error(f"Error parsing dictionary response: {e}")
                formatted_result["error"] = f"辞書レスポンスの解析中にエラーが発生しました: {str(e)}"
                
                # 関連語の取得
                if "related" in result["result"]:
                    for related in result["result"]["related"]:
                        if related not in formatted_result["related_words"]:
                            formatted_result["related_words"].append(related)
            
            return formatted_result
            
        except Exception as e:
            logger.error(f"Error in Yahoo! dictionary_lookup: {e}")
            return {
                "word": word,
                "error": f"辞書検索中にエラーが発生しました: {str(e)}"
            }
