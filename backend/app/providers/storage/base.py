"""
ストレージプロバイダーの抽象基底クラス
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, BinaryIO, Union
from uuid import UUID


class StorageProvider(ABC):
    """
    ストレージプロバイダーの抽象基底クラス
    ローカルストレージとクラウドストレージの抽象化レイヤー
    """

    @abstractmethod
    async def generate_upload_url(
        self, 
        media_id: Union[str, UUID], 
        file_type: str, 
        file_size: int,
        user_id: str,
        expires_in: int = 3600
    ) -> Dict:
        """
        アップロード用の署名付きURLを生成
        
        Args:
            media_id: メディアID
            file_type: ファイルのMIMEタイプ
            file_size: ファイルサイズ（バイト）
            user_id: ユーザーID
            expires_in: URL有効期限（秒）
            
        Returns:
            Dict: {
                "media_id": str,
                "upload_url": str,
                "chunk_upload_enabled": bool,
                "max_chunk_size": int
            }
        """
        pass
    
    @abstractmethod
    async def upload_chunk(
        self,
        media_id: Union[str, UUID],
        chunk_index: int,
        total_chunks: int,
        chunk_data: BinaryIO,
        user_id: str
    ) -> Dict:
        """
        チャンクデータをアップロード
        
        Args:
            media_id: メディアID
            chunk_index: チャンクインデックス（0から始まる）
            total_chunks: 全チャンク数
            chunk_data: チャンクデータ
            user_id: ユーザーID
            
        Returns:
            Dict: {
                "media_id": str,
                "chunk_index": int,
                "received_bytes": int,
                "status": str
            }
        """
        pass
    
    @abstractmethod
    async def complete_upload(
        self,
        media_id: Union[str, UUID],
        total_chunks: int,
        total_size: int,
        md5_hash: Optional[str],
        user_id: str
    ) -> Dict:
        """
        チャンクアップロードの完了処理
        
        Args:
            media_id: メディアID
            total_chunks: 全チャンク数
            total_size: 合計サイズ（バイト）
            md5_hash: オプションのMD5ハッシュ（整合性チェック用）
            user_id: ユーザーID
            
        Returns:
            Dict: {
                "media_id": str,
                "status": str,
                "progress": float
            }
        """
        pass
    
    @abstractmethod
    async def get_media_status(
        self,
        media_id: Union[str, UUID],
        user_id: str
    ) -> Dict:
        """
        メディア処理状況を取得
        
        Args:
            media_id: メディアID
            user_id: ユーザーID
            
        Returns:
            Dict: {
                "media_id": str,
                "status": str,
                "progress": float,
                "error": Optional[str],
                "result": Optional[Dict]
            }
        """
        pass
    
    @abstractmethod
    async def get_file_url(
        self,
        media_id: Union[str, UUID],
        user_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        ファイルのダウンロードURLを取得
        
        Args:
            media_id: メディアID
            user_id: ユーザーID
            expires_in: URL有効期限（秒）
            
        Returns:
            str: ダウンロードURL
        """
        pass
    
    @abstractmethod
    async def delete_file(
        self,
        media_id: Union[str, UUID],
        user_id: str
    ) -> bool:
        """
        ファイルを削除
        
        Args:
            media_id: メディアID
            user_id: ユーザーID
            
        Returns:
            bool: 削除成功の場合True
        """
        pass

    @abstractmethod
    async def upload_file(
        self,
        media_id: str,
        file: BinaryIO,
        filename: str,
        content_type: str,
        user_id: str
    ) -> dict:
        """
        FormDataで受け取ったファイルを保存
        """
        pass

    # 🆕 写真スキャン専用抽象メソッド
    @abstractmethod
    async def upload_photo_scan_image(
        self, 
        note_id: str, 
        page_id: str, 
        image_data: bytes, 
        user_id: str
    ) -> dict:
        """
        写真スキャン画像を保存
        複数ページ対応のため note_id/page_id.jpg 形式で保存
        
        Args:
            note_id: ノートID
            page_id: ページID
            image_data: 画像のバイナリデータ
            user_id: ユーザーID
            
        Returns:
            保存結果の辞書
        """
        pass
    
    @abstractmethod
    async def get_photo_scan_image_url(
        self,
        note_id: str,
        page_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        写真スキャン画像のダウンロードURLを取得
        
        Args:
            note_id: ノートID
            page_id: ページID
            expires_in: URL有効期限（秒）
            
        Returns:
            ダウンロードURL
        """
        pass
    
    @abstractmethod
    async def delete_photo_scan_images(self, note_id: str) -> bool:
        """
        写真スキャンノートの全画像を削除
        
        Args:
            note_id: ノートID
            
        Returns:
            削除成功の場合True
        """
        pass
