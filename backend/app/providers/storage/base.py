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
