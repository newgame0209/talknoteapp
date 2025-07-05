"""
File Processing Service

ファイル（PDF・txt等）からテキストを抽出する処理を管理するサービス層です。
複数のファイル形式に対応し、統一的なインターフェースでテキスト抽出機能を提供します。
"""

import logging
from typing import Dict, Optional, Any, BinaryIO
import io
import mimetypes
from pathlib import Path

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    pypdf = None

try:
    import chardet
    CHARDET_AVAILABLE = True
except ImportError:
    CHARDET_AVAILABLE = False
    chardet = None

logger = logging.getLogger(__name__)


class FileProcessorError(Exception):
    """ファイル処理エラー"""
    pass


class FileProcessor:
    """ファイル処理サービスクラス"""
    
    def __init__(self):
        """ファイル処理サービスを初期化"""
        self.supported_formats = self._get_supported_formats()
        logger.info(f"FileProcessor initialized. Supported formats: {list(self.supported_formats.keys())}")
    
    def _get_supported_formats(self) -> Dict[str, str]:
        """サポートされているファイル形式を取得"""
        formats = {}
        
        if PYPDF_AVAILABLE:
            formats.update({
                'application/pdf': 'pdf',
                'pdf': 'pdf'
            })
        
        # テキストファイルは常にサポート
        formats.update({
            'text/plain': 'txt',
            'text/csv': 'txt',
            'txt': 'txt',
            'csv': 'txt'
        })
        
        return formats
    
    async def extract_text_from_file(
        self,
        file_data: bytes,
        filename: str,
        mime_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        ファイルからテキストを抽出
        
        Args:
            file_data: ファイルのバイナリデータ
            filename: ファイル名
            mime_type: MIMEタイプ（指定しない場合は自動判定）
            
        Returns:
            Dict[str, Any]: 抽出結果
            - text: 抽出されたテキスト
            - metadata: メタデータ（ページ数、エンコーディング等）
            - source_type: ソースファイルの種類
            
        Raises:
            FileProcessorError: ファイル処理でエラーが発生した場合
        """
        if not file_data:
            raise FileProcessorError("File data is empty")
        
        # MIMEタイプの判定
        if not mime_type:
            mime_type = self._detect_mime_type(filename, file_data)
        
        # ファイル形式の確認
        file_format = self._get_file_format(mime_type, filename)
        if not file_format:
            raise FileProcessorError(f"Unsupported file format: {mime_type}")
        
        try:
            # ファイル形式に応じて処理を実行
            if file_format == 'pdf':
                return await self._extract_text_from_pdf(file_data, filename)
            elif file_format == 'txt':
                return await self._extract_text_from_txt(file_data, filename)
            else:
                raise FileProcessorError(f"Handler not implemented for format: {file_format}")
                
        except FileProcessorError:
            # FileProcessorErrorはそのまま再発生
            raise
        except Exception as e:
            logger.error(f"Unexpected error in file processing: {e}")
            raise FileProcessorError(f"Unexpected error in file processing: {e}")
    
    def _detect_mime_type(self, filename: str, file_data: bytes) -> str:
        """MIMEタイプを自動判定"""
        # ファイル名からMIMEタイプを推測
        mime_type, _ = mimetypes.guess_type(filename)
        if mime_type:
            return mime_type
        
        # ファイルデータからMIMEタイプを推測
        if file_data.startswith(b'%PDF'):
            return 'application/pdf'
        
        # テキストファイルの場合（UTF-8 BOMチェック等）
        try:
            file_data[:1000].decode('utf-8')
            return 'text/plain'
        except UnicodeDecodeError:
            pass
        
        # デフォルト
        return 'application/octet-stream'
    
    def _get_file_format(self, mime_type: str, filename: str) -> Optional[str]:
        """ファイル形式を取得"""
        # MIMEタイプから判定
        if mime_type in self.supported_formats:
            return self.supported_formats[mime_type]
        
        # 拡張子から判定
        ext = Path(filename).suffix.lower().lstrip('.')
        if ext in self.supported_formats:
            return self.supported_formats[ext]
        
        return None
    
    async def _extract_text_from_pdf(self, file_data: bytes, filename: str) -> Dict[str, Any]:
        """PDFファイルからテキストを抽出"""
        if not PYPDF_AVAILABLE:
            raise FileProcessorError("pypdf is not available")
        
        try:
            # PDFファイルを開く
            pdf_file = io.BytesIO(file_data)
            pdf_reader = pypdf.PdfReader(pdf_file)
            
            # ページ数の確認
            num_pages = len(pdf_reader.pages)
            logger.info(f"PDF has {num_pages} pages: {filename}")
            
            # 最大ページ数制限（メモリ使用量制御）
            max_pages = 100
            if num_pages > max_pages:
                logger.warning(f"PDF has too many pages ({num_pages}), limiting to {max_pages}")
                num_pages = max_pages
            
            # 各ページからテキストを抽出
            extracted_text = []
            page_info = []
            
            for page_num in range(num_pages):
                try:
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    
                    if page_text.strip():
                        extracted_text.append(page_text)
                        page_info.append({
                            'page_number': page_num + 1,
                            'text_length': len(page_text),
                            'has_text': True
                        })
                    else:
                        page_info.append({
                            'page_number': page_num + 1,
                            'text_length': 0,
                            'has_text': False
                        })
                        
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                    page_info.append({
                        'page_number': page_num + 1,
                        'text_length': 0,
                        'has_text': False,
                        'error': str(e)
                    })
            
            # 全ページのテキストを結合
            full_text = '\n\n'.join(extracted_text)
            
            # メタデータの取得
            metadata = {
                'total_pages': len(pdf_reader.pages),
                'extracted_pages': num_pages,
                'page_info': page_info,
                'has_text': bool(full_text.strip()),
                'file_size': len(file_data),
                'filename': filename
            }
            
            # PDF情報の取得（可能な場合）
            try:
                if pdf_reader.metadata:
                    metadata.update({
                        'title': pdf_reader.metadata.get('/Title'),
                        'author': pdf_reader.metadata.get('/Author'),
                        'subject': pdf_reader.metadata.get('/Subject'),
                        'creator': pdf_reader.metadata.get('/Creator'),
                        'producer': pdf_reader.metadata.get('/Producer'),
                        'creation_date': pdf_reader.metadata.get('/CreationDate'),
                        'modification_date': pdf_reader.metadata.get('/ModDate')
                    })
            except Exception as e:
                logger.warning(f"Error extracting PDF metadata: {e}")
            
            logger.info(f"PDF text extraction completed. Characters: {len(full_text)}, Pages: {num_pages}")
            
            return {
                'text': full_text,
                'metadata': metadata,
                'source_type': 'pdf'
            }
            
        except Exception as e:
            logger.error(f"Error processing PDF file {filename}: {e}")
            raise FileProcessorError(f"Failed to process PDF file: {e}")
    
    async def _extract_text_from_txt(self, file_data: bytes, filename: str) -> Dict[str, Any]:
        """テキストファイルからテキストを抽出"""
        try:
            # エンコーディングの自動検出
            encoding = 'utf-8'
            confidence = 1.0
            
            if CHARDET_AVAILABLE:
                detected = chardet.detect(file_data)
                if detected and detected['encoding']:
                    encoding = detected['encoding']
                    confidence = detected['confidence']
                    logger.info(f"Detected encoding: {encoding} (confidence: {confidence:.2f})")
            
            # テキストのデコード
            try:
                text = file_data.decode(encoding)
            except UnicodeDecodeError:
                # フォールバック：utf-8で再試行
                logger.warning(f"Failed to decode with {encoding}, trying utf-8")
                text = file_data.decode('utf-8', errors='replace')
                encoding = 'utf-8'
                confidence = 0.5
            
            # メタデータの作成
            metadata = {
                'encoding': encoding,
                'encoding_confidence': confidence,
                'file_size': len(file_data),
                'character_count': len(text),
                'line_count': text.count('\n') + 1,
                'filename': filename
            }
            
            logger.info(f"Text file processed. Characters: {len(text)}, Lines: {metadata['line_count']}")
            
            return {
                'text': text,
                'metadata': metadata,
                'source_type': 'txt'
            }
            
        except Exception as e:
            logger.error(f"Error processing text file {filename}: {e}")
            raise FileProcessorError(f"Failed to process text file: {e}")
    
    def get_supported_formats(self) -> Dict[str, str]:
        """サポートされているファイル形式のリストを取得"""
        return self.supported_formats.copy()
    
    def is_format_supported(self, mime_type: str, filename: str = '') -> bool:
        """指定されたファイル形式がサポートされているかチェック"""
        return self._get_file_format(mime_type, filename) is not None
    
    def get_format_info(self) -> Dict[str, Any]:
        """ファイル形式のサポート情報を取得"""
        return {
            'pypdf_available': PYPDF_AVAILABLE,
            'chardet_available': CHARDET_AVAILABLE,
            'supported_formats': self.get_supported_formats(),
            'max_pdf_pages': 100
        }


# グローバルファイル処理サービスインスタンス
file_processor = FileProcessor() 