"""
URL Import Service

URL（Webページ・YouTube等）からテキストを抽出する処理を管理するサービス層です。
複数のURL形式に対応し、統一的なインターフェースでテキスト抽出機能を提供します。
"""

import logging
from typing import Dict, Optional, Any, List
import re
from urllib.parse import urlparse, parse_qs
import asyncio

# 🆕 Feature Flag対応のためのimport
from app.core.settings import settings

try:
    import requests
    from requests.adapters import HTTPAdapter
    from requests.packages.urllib3.util.retry import Retry
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    requests = None

try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    BeautifulSoup = None

try:
    import yt_dlp
    YTDLP_AVAILABLE = True
except ImportError:
    YTDLP_AVAILABLE = False
    yt_dlp = None

logger = logging.getLogger(__name__)


class URLImportError(Exception):
    """URL インポートエラー"""
    pass


class URLImporter:
    """URL インポートサービスクラス"""
    
    def __init__(self):
        """URL インポートサービスを初期化"""
        self.supported_domains = self._get_supported_domains()
        self.session = self._create_session()
        logger.info(f"URLImporter initialized. Supported domains: {list(self.supported_domains.keys())}")
    
    def _get_supported_domains(self) -> Dict[str, str]:
        """サポートされているドメインを取得"""
        domains = {}
        
        # 一般的なWebページ
        if REQUESTS_AVAILABLE and BEAUTIFULSOUP_AVAILABLE:
            domains.update({
                'general': 'webpage',
                'news': 'webpage',
                'blog': 'webpage',
                'wiki': 'webpage'
            })
        
        # YouTube
        if YTDLP_AVAILABLE:
            domains.update({
                'youtube.com': 'youtube',
                'youtu.be': 'youtube',
                'm.youtube.com': 'youtube'
            })
        
        return domains
    
    def _create_session(self) -> Optional[requests.Session]:
        """HTTPセッションを作成"""
        if not REQUESTS_AVAILABLE:
            return None
        
        session = requests.Session()
        
        # リトライ設定
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # User-Agent設定
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        return session
    
    async def extract_text_from_url(
        self,
        url: str,
        extract_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        URLからテキストを抽出
        
        Args:
            url: 抽出対象のURL
            extract_options: 抽出オプション
            
        Returns:
            Dict[str, Any]: 抽出結果
            - text: 抽出されたテキスト
            - title: ページタイトル
            - metadata: メタデータ
            - source_type: ソースの種類
            
        Raises:
            URLImportError: URL処理でエラーが発生した場合
        """
        if not url:
            raise URLImportError("URL is required")
        
        # URL の検証
        if not self._is_valid_url(url):
            raise URLImportError(f"Invalid URL format: {url}")
        
        # URL のタイプを判定
        url_type = self._get_url_type(url)
        
        try:
            # URL タイプに応じて処理を実行
            if url_type == 'youtube':
                return await self._extract_from_youtube(url, extract_options)
            elif url_type == 'webpage':
                return await self._extract_from_webpage(url, extract_options)
            else:
                raise URLImportError(f"Unsupported URL type: {url_type}")
                
        except URLImportError:
            # URLImportErrorはそのまま再発生
            raise
        except Exception as e:
            logger.error(f"Unexpected error in URL processing: {e}")
            raise URLImportError(f"Unexpected error in URL processing: {e}")
    
    def _is_valid_url(self, url: str) -> bool:
        """URL の形式を検証"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def _get_url_type(self, url: str) -> str:
        """URL のタイプを判定"""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # YouTube の判定
        if any(youtube_domain in domain for youtube_domain in ['youtube.com', 'youtu.be', 'm.youtube.com']):
            return 'youtube'
        
        # 一般的な Web ページ
        return 'webpage'
    
    async def _extract_from_youtube(self, url: str, extract_options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """YouTube URLからテキストを抽出"""
        if not YTDLP_AVAILABLE:
            raise URLImportError("yt-dlp is not available")
        
        try:
            # yt-dlp の設定
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['ja', 'en'],
                'skip_download': True,
                'extract_flat': False,
            }
            
            # 動画情報の取得
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            
            # タイトルと説明文の取得
            title = info.get('title', '')
            description = info.get('description', '')
            uploader = info.get('uploader', '')
            upload_date = info.get('upload_date', '')
            view_count = info.get('view_count', 0)
            duration = info.get('duration', 0)
            
            # 🔧 強化: YouTube字幕取得処理の改善
            subtitles_text = ''
            logger.info(f"字幕取得開始: {url}")
            
            # 字幕データの詳細ログ
            subtitles_available = info.get('subtitles', {})
            auto_captions_available = info.get('automatic_captions', {})
            
            logger.info(f"利用可能な字幕: {list(subtitles_available.keys())}")
            logger.info(f"利用可能な自動字幕: {list(auto_captions_available.keys())}")
            
            if subtitles_available or auto_captions_available:
                # 🚨 CRITICAL: 字幕取得の優先順位を改善
                subtitle_langs = ['ja', 'ja-JP', 'en', 'en-US', 'en-GB']
                subtitle_entries = None
                selected_lang = None
                
                # 手動字幕を優先
                for lang in subtitle_langs:
                    if lang in subtitles_available:
                        subtitle_entries = subtitles_available[lang]
                        selected_lang = lang
                        logger.info(f"手動字幕を選択: {lang}")
                        break
                
                # 手動字幕がない場合は自動字幕を使用
                if not subtitle_entries:
                    for lang in subtitle_langs:
                        if lang in auto_captions_available:
                            subtitle_entries = auto_captions_available[lang]
                            selected_lang = lang
                            logger.info(f"自動字幕を選択: {lang}")
                            break
                
                # 字幕データの詳細ログ
                if subtitle_entries:
                    logger.info(f"字幕エントリ数: {len(subtitle_entries)}")
                    for i, entry in enumerate(subtitle_entries[:3]):  # 最初の3つのエントリをログ
                        logger.info(f"字幕エントリ {i}: {entry}")
                    
                    subtitles_text = self._extract_subtitle_text(subtitle_entries)
                    if subtitles_text:
                        logger.info(f"✅ 字幕取得成功: {len(subtitles_text)} 文字 (言語: {selected_lang})")
                    else:
                        logger.warning(f"⚠️ 字幕エントリはあるが、テキスト抽出に失敗")
                else:
                    logger.warning(f"❌ 対応言語の字幕が見つかりません: {subtitle_langs}")
            else:
                logger.info(f"ℹ️ 字幕データなし: {url}")
            
            # テキストの結合
            text_parts = []
            if title:
                text_parts.append(f"タイトル: {title}")
            if description:
                text_parts.append(f"説明: {description}")
            if subtitles_text:
                text_parts.append(f"字幕: {subtitles_text}")
            
            full_text = '\n\n'.join(text_parts)
            
            # メタデータの作成
            metadata = {
                'title': title,
                'description': description,
                'uploader': uploader,
                'upload_date': upload_date,
                'view_count': view_count,
                'duration': duration,
                'url': url,
                'video_id': info.get('id', ''),
                'has_subtitles': bool(subtitles_text),
                'text_length': len(full_text)
            }
            
            logger.info(f"YouTube video processed. Title: {title}, Duration: {duration}s, Text length: {len(full_text)}")
            
            return {
                'text': full_text,
                'title': title,
                'metadata': metadata,
                'source_type': 'youtube'
            }
            
        except Exception as e:
            logger.error(f"Error processing YouTube URL {url}: {e}")
            raise URLImportError(f"Failed to process YouTube URL: {e}")
    
    def _extract_subtitle_text(self, subtitle_entries: List[Dict]) -> str:
        """字幕エントリからテキストを抽出"""
        try:
            logger.info(f"字幕テキスト抽出開始: {len(subtitle_entries)} エントリ")
            
            # 🔧 強化: 複数の字幕形式に対応
            subtitle_url = None
            subtitle_format = None
            
            # 優先順位: VTT > SRT > TTML > その他
            format_priority = ['vtt', 'srt', 'ttml', 'srv3', 'srv2', 'srv1']
            
            for fmt in format_priority:
                for entry in subtitle_entries:
                    if entry.get('ext') == fmt:
                        subtitle_url = entry.get('url')
                        subtitle_format = fmt
                        logger.info(f"字幕形式選択: {fmt}, URL: {subtitle_url}")
                        break
                if subtitle_url:
                    break
            
            if not subtitle_url:
                logger.warning("字幕URLが見つかりません")
                return ''
            
            # 字幕データの取得
            logger.info(f"字幕データ取得中: {subtitle_url}")
            response = self.session.get(subtitle_url, timeout=30)
            response.raise_for_status()
            
            # 🔧 強化: 形式に応じた解析処理
            if subtitle_format in ['vtt', 'srt']:
                subtitle_text = self._parse_vtt_srt_subtitles(response.text)
            elif subtitle_format == 'ttml':
                subtitle_text = self._parse_ttml_subtitles(response.text)
            else:
                # その他の形式は基本的なテキスト抽出
                subtitle_text = self._parse_generic_subtitles(response.text)
            
            logger.info(f"✅ 字幕テキスト抽出完了: {len(subtitle_text)} 文字")
            return subtitle_text
            
        except Exception as e:
            logger.error(f"❌ 字幕テキスト抽出エラー: {e}")
            return ''
    
    def _parse_vtt_srt_subtitles(self, subtitle_content: str) -> str:
        """VTT/SRT形式の字幕を解析"""
        lines = subtitle_content.split('\n')
        subtitle_text = []
        
        for line in lines:
            line = line.strip()
            # タイムスタンプ行をスキップ
            if '-->' in line or line.startswith('WEBVTT') or line.startswith('NOTE') or line.isdigit():
                continue
            # 空行をスキップ
            if not line:
                continue
            # HTMLタグを除去
            clean_line = re.sub(r'<[^>]+>', '', line)
            # 特殊文字を除去
            clean_line = re.sub(r'&[a-zA-Z0-9#]+;', '', clean_line)
            if clean_line:
                subtitle_text.append(clean_line)
        
        return ' '.join(subtitle_text)
    
    def _parse_ttml_subtitles(self, subtitle_content: str) -> str:
        """TTML形式の字幕を解析"""
        try:
            # 基本的なXML解析（BeautifulSoupを使用）
            if not BEAUTIFULSOUP_AVAILABLE:
                return self._parse_generic_subtitles(subtitle_content)
            
            soup = BeautifulSoup(subtitle_content, 'xml')
            text_elements = soup.find_all('p')
            
            subtitle_text = []
            for element in text_elements:
                text = element.get_text().strip()
                if text:
                    subtitle_text.append(text)
            
            return ' '.join(subtitle_text)
            
        except Exception as e:
            logger.warning(f"TTML解析エラー、基本解析にフォールバック: {e}")
            return self._parse_generic_subtitles(subtitle_content)
    
    def _parse_generic_subtitles(self, subtitle_content: str) -> str:
        """汎用的な字幕テキスト抽出"""
        lines = subtitle_content.split('\n')
        subtitle_text = []
        
        for line in lines:
            line = line.strip()
            # 明らかにタイムスタンプやメタデータの行をスキップ
            if (not line or 
                '-->' in line or 
                line.startswith('<') or 
                line.startswith('WEBVTT') or 
                line.startswith('NOTE') or
                line.isdigit() or
                re.match(r'^\d{2}:\d{2}:\d{2}', line)):
                continue
            
            # HTMLタグと特殊文字を除去
            clean_line = re.sub(r'<[^>]+>', '', line)
            clean_line = re.sub(r'&[a-zA-Z0-9#]+;', '', clean_line)
            
            if clean_line:
                subtitle_text.append(clean_line)
        
        return ' '.join(subtitle_text)
    
    async def _extract_from_webpage(self, url: str, extract_options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """一般的なWebページからテキストを抽出"""
        if not REQUESTS_AVAILABLE or not BEAUTIFULSOUP_AVAILABLE:
            raise URLImportError("requests and beautifulsoup4 are not available")
        
        try:
            # Webページの取得
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # エンコーディングの設定
            response.encoding = response.apparent_encoding
            
            # HTMLの解析
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # タイトルの取得
            title = ''
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text().strip()
            
            # メタデータの取得
            description = ''
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc:
                description = meta_desc.get('content', '').strip()
            
            # 不要なタグを除去
            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'advertisement']):
                tag.decompose()
            
            # メインコンテンツの抽出
            main_content = self._extract_main_content(soup)
            
            # テキストの清書
            clean_text = self._clean_text(main_content)
            
            # メタデータの作成
            metadata = {
                'title': title,
                'description': description,
                'url': url,
                'domain': urlparse(url).netloc,
                'text_length': len(clean_text),
                'content_type': 'webpage'
            }
            
            logger.info(f"Webpage processed. Title: {title}, Domain: {metadata['domain']}, Text length: {len(clean_text)}")
            
            return {
                'text': clean_text,
                'title': title,
                'metadata': metadata,
                'source_type': 'webpage'
            }
            
        except Exception as e:
            logger.error(f"Error processing webpage {url}: {e}")
            raise URLImportError(f"Failed to process webpage: {e}")
    
    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """メインコンテンツを抽出"""
        # メインコンテンツ候補のタグを優先順位で検索
        content_selectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.main-content',
            '.post-content',
            '.entry-content',
            '.article-content',
            'div.content',
            'div#content',
            'body'
        ]
        
        content = ''
        for selector in content_selectors:
            elements = soup.select(selector)
            if elements:
                content = elements[0].get_text()
                break
        
        return content
    
    def _clean_text(self, text: str) -> str:
        """テキストを清書"""
        if not text:
            return ''
        
        # 複数の空白を単一スペースに変換
        text = re.sub(r'\s+', ' ', text)
        
        # 複数の改行を単一改行に変換
        text = re.sub(r'\n+', '\n', text)
        
        # 先頭・末尾の空白を除去
        text = text.strip()
        
        return text
    
    def get_supported_domains(self) -> Dict[str, str]:
        """サポートされているドメインのリストを取得"""
        return self.supported_domains.copy()
    
    def is_url_supported(self, url: str) -> bool:
        """指定されたURLがサポートされているかチェック"""
        try:
            url_type = self._get_url_type(url)
            return url_type in ['youtube', 'webpage']
        except Exception:
            return False
    
    def get_service_info(self) -> Dict[str, Any]:
        """サービスのサポート情報を取得"""
        return {
            'requests_available': REQUESTS_AVAILABLE,
            'beautifulsoup_available': BEAUTIFULSOUP_AVAILABLE,
            'ytdlp_available': YTDLP_AVAILABLE,
            'supported_domains': self.get_supported_domains(),
            'max_timeout': 30
        }


# 🆕 Phase 1: チャンク分割機能追加
# 既存機能に影響しない新機能として実装

def _split_into_chunks(text: str, max_chars: int = 2000) -> List[str]:
    """
    テキストを自然な段落を保持しながら指定文字数で分割
    
    Args:
        text: 分割対象のテキスト
        max_chars: 1チャンクあたりの最大文字数
        
    Returns:
        List[str]: 分割されたテキストチャンクのリスト
    """
    if len(text) <= max_chars:
        return [text]
    
    # 段落で分割（\n\n または \n で区切り）
    paragraphs = re.split(r'\n\s*\n', text)
    if len(paragraphs) == 1:
        # 段落分割ができない場合は文で分割
        paragraphs = re.split(r'[。！？]\s*', text)
    
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
            
        # 現在のチャンクに追加可能かチェック
        if len(current_chunk + paragraph) <= max_chars:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            # 現在のチャンクを保存
            if current_chunk:
                chunks.append(current_chunk)
            
            # 段落が1チャンクの制限を超える場合は強制分割
            if len(paragraph) > max_chars:
                # 文字数制限で強制分割
                for i in range(0, len(paragraph), max_chars):
                    chunks.append(paragraph[i:i + max_chars])
                current_chunk = ""
            else:
                current_chunk = paragraph
    
    # 最後のチャンクを追加
    if current_chunk:
        chunks.append(current_chunk)
    
    logger.info(f"テキスト分割完了: {len(text)}文字 → {len(chunks)}チャンク")
    return chunks


async def extract_text_with_chunking(
    url: str,
    extract_options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    🆕 Phase 1: チャンク分割対応のURL抽出機能
    Feature Flag IMPORT_SPLIT_ENABLED が有効な場合のみ使用
    
    Args:
        url: 抽出対象のURL
        extract_options: 抽出オプション
        
    Returns:
        Dict[str, Any]: 抽出結果（pages配列付き）
        - text: 全体テキスト（後方互換用）
        - title: ページタイトル
        - metadata: メタデータ
        - source_type: ソースの種類
        - pages: チャンク分割されたページ配列（新機能）
    """
    # Feature Flag チェック
    if not settings.IMPORT_SPLIT_ENABLED:
        # 従来の機能を使用（完全後方互換）
        logger.info("IMPORT_SPLIT_ENABLED=False: 従来の抽出機能を使用")
        return await url_importer.extract_text_from_url(url, extract_options)
    
    logger.info(f"IMPORT_SPLIT_ENABLED=True: チャンク分割機能を使用 - URL: {url}")
    
    # 既存の抽出機能を使用してベースデータを取得
    base_result = await url_importer.extract_text_from_url(url, extract_options)
    
    full_text = base_result.get('text', '')
    title = base_result.get('title', '')
    metadata = base_result.get('metadata', {})
    source_type = base_result.get('source_type', 'webpage')
    
    # テキスト長チェック
    if len(full_text) <= 2000:
        # 2000文字以下の場合は従来通り（1ページ）
        logger.info(f"テキスト長 {len(full_text)}文字: 分割不要")
        pages = [{
            'page_number': 1,
            'text': full_text,
            'char_count': len(full_text)
        }]
    else:
        # 2000文字超の場合はチャンク分割
        logger.info(f"テキスト長 {len(full_text)}文字: チャンク分割実行")
        chunks = _split_into_chunks(full_text, max_chars=2000)
        
        pages = []
        for i, chunk in enumerate(chunks, 1):
            pages.append({
                'page_number': i,
                'text': chunk,
                'char_count': len(chunk)
            })
        
        logger.info(f"チャンク分割完了: {len(chunks)}ページ生成")
    
    # メタデータに分割情報を追加
    metadata.update({
        'total_pages': len(pages),
        'chunked': len(pages) > 1,
        'original_length': len(full_text)
    })
    
    # 結果を返す（既存フィールド + 新しいpages配列）
    result = {
        'text': full_text,  # 後方互換用
        'title': title,
        'metadata': metadata,
        'source_type': source_type,
        'pages': pages  # 🆕 新機能
    }
    
    logger.info(f"抽出完了: タイトル='{title}', ページ数={len(pages)}")
    return result


# グローバルURL インポートサービスインスタンス
url_importer = URLImporter() 