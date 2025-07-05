"""
Google Cloud Storage (GCS) プロバイダーの実装
本番環境用のGCSベースのストレージ
"""
import os
import json
import asyncio
from typing import Dict, List, Optional, BinaryIO, Union
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from pathlib import Path
import tempfile

from google.cloud import storage
from google.cloud.exceptions import NotFound
from google.api_core.exceptions import GoogleAPIError

from app.core.settings import settings
from app.providers.storage.base import StorageProvider


class GCSStorageProvider(StorageProvider):
    """
    Google Cloud Storage (GCS) を使用したストレージプロバイダー
    本番環境用
    """
    
    def __init__(self):
        """
        GCSストレージプロバイダーの初期化
        """
        # GCSクライアントの初期化
        self.client = storage.Client()
        
        # バケット名の設定
        self.bucket_name = settings.GCS_BUCKET_NAME
        self.bucket = self.client.bucket(self.bucket_name)
        
        # メタデータの一時保存用ディレクトリ
        self.temp_dir = Path(tempfile.gettempdir()) / "talknote_metadata"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_blob_path(self, user_id: str, media_id: str, ext: str = None) -> str:
        """
        GCS内のBlobパスを取得
        """
        if ext:
            return f"{user_id}/{media_id}.{ext}"
        else:
            return f"{user_id}/{media_id}"
    
    def _get_chunk_blob_path(self, user_id: str, media_id: str, chunk_index: int) -> str:
        """
        チャンク用のBlobパスを取得
        """
        return f"{user_id}/{media_id}/chunks/chunk_{chunk_index:04d}.bin"
    
    def _get_metadata_blob_path(self, user_id: str, media_id: str) -> str:
        """
        メタデータ用のBlobパスを取得
        """
        return f"{user_id}/{media_id}/metadata.json"
    
    async def _save_metadata_to_gcs(self, user_id: str, media_id: str, metadata: Dict) -> None:
        """
        メタデータをGCSに保存
        """
        metadata_path = self._get_metadata_blob_path(user_id, media_id)
        blob = self.bucket.blob(metadata_path)
        
        # メタデータをJSON形式に変換
        metadata_json = json.dumps(metadata, ensure_ascii=False)
        
        # GCSにアップロード
        blob.upload_from_string(metadata_json, content_type="application/json")
    
    async def _load_metadata_from_gcs(self, user_id: str, media_id: str) -> Dict:
        """
        メタデータをGCSから読み込み
        """
        metadata_path = self._get_metadata_blob_path(user_id, media_id)
        blob = self.bucket.blob(metadata_path)
        
        try:
            # GCSからダウンロード
            metadata_json = blob.download_as_text()
            return json.loads(metadata_json)
        except NotFound:
            return {}
        except Exception as e:
            print(f"メタデータ読み込みエラー: {e}")
            return {}
    
    async def _update_metadata(self, user_id: str, media_id: str, updates: Dict) -> Dict:
        """
        メタデータを更新
        """
        metadata = await self._load_metadata_from_gcs(user_id, media_id)
        metadata.update(updates)
        await self._save_metadata_to_gcs(user_id, media_id, metadata)
        return metadata
    
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
        """
        media_id_str = str(media_id)
        
        # ファイル拡張子の取得
        ext = self._get_extension_from_mimetype(file_type)
        
        # Blobパスの生成
        blob_path = self._get_blob_path(user_id, media_id_str, ext)
        blob = self.bucket.blob(blob_path)
        
        # メタデータの作成
        metadata = {
            "media_id": media_id_str,
            "user_id": user_id,
            "file_type": file_type,
            "file_size": file_size,
            "status": "pending",
            "progress": 0.0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "blob_path": blob_path
        }
        
        # メタデータの保存
        await self._save_metadata_to_gcs(user_id, media_id_str, metadata)
        
        # チャンクアップロードが必要かどうかの判断
        chunk_upload_enabled = file_size > settings.MAX_DIRECT_UPLOAD_SIZE
        
        if chunk_upload_enabled:
            # チャンクアップロードが必要な場合
            return {
                "media_id": media_id_str,
                "upload_url": None,  # チャンクアップロードでは直接URLは使用しない
                "chunk_upload_enabled": True,
                "max_chunk_size": settings.MAX_CHUNK_SIZE
            }
        else:
            # 直接アップロードの場合、署名付きURLを生成
            expiration = datetime.now() + timedelta(seconds=expires_in)
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method="PUT",
                content_type=file_type
            )
            
            return {
                "media_id": media_id_str,
                "upload_url": signed_url,
                "chunk_upload_enabled": False,
                "max_chunk_size": settings.MAX_CHUNK_SIZE
            }
    
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
        """
        media_id_str = str(media_id)
        
        # チャンク用Blobパスの生成
        chunk_blob_path = self._get_chunk_blob_path(user_id, media_id_str, chunk_index)
        chunk_blob = self.bucket.blob(chunk_blob_path)
        
        # チャンクデータの読み込み
        chunk_content = chunk_data.read()
        chunk_size = len(chunk_content)
        
        # GCSにアップロード
        chunk_blob.upload_from_string(chunk_content)
        
        # メタデータの更新
        metadata = await self._load_metadata_from_gcs(user_id, media_id_str)
        
        # チャンク情報の追加
        if "chunks" not in metadata:
            metadata["chunks"] = {}
        
        metadata["chunks"][str(chunk_index)] = {
            "size": chunk_size,
            "path": chunk_blob_path,
            "uploaded_at": datetime.now().isoformat()
        }
        
        metadata["total_chunks"] = total_chunks
        metadata["updated_at"] = datetime.now().isoformat()
        
        # アップロード進捗の計算
        uploaded_chunks = len(metadata["chunks"])
        metadata["upload_progress"] = uploaded_chunks / total_chunks
        
        # メタデータの保存
        await self._save_metadata_to_gcs(user_id, media_id_str, metadata)
        
        return {
            "media_id": media_id_str,
            "chunk_index": chunk_index,
            "received_bytes": chunk_size,
            "status": "success"
        }
    
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
        """
        media_id_str = str(media_id)
        
        # メタデータの読み込み
        metadata = await self._load_metadata_from_gcs(user_id, media_id_str)
        
        # チャンク数の確認
        if "chunks" not in metadata or len(metadata["chunks"]) != total_chunks:
            return {
                "media_id": media_id_str,
                "status": "error",
                "progress": 0.0,
                "error": f"チャンク数が一致しません。期待: {total_chunks}, 実際: {len(metadata.get('chunks', {}))}"
            }
        
        # ファイル拡張子の取得
        ext = self._get_extension_from_mimetype(metadata.get("file_type", "application/octet-stream"))
        
        # 最終的なBlobパス
        final_blob_path = self._get_blob_path(user_id, media_id_str, ext)
        final_blob = self.bucket.blob(final_blob_path)
        
        # 一時ファイルの作成
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = temp_file.name
            
            # チャンクの結合
            for i in range(total_chunks):
                chunk_info = metadata["chunks"].get(str(i))
                if not chunk_info:
                    return {
                        "media_id": media_id_str,
                        "status": "error",
                        "progress": 0.0,
                        "error": f"チャンク {i} が見つかりません"
                    }
                
                chunk_blob_path = chunk_info["path"]
                chunk_blob = self.bucket.blob(chunk_blob_path)
                
                # チャンクをダウンロードして一時ファイルに追加
                chunk_data = chunk_blob.download_as_bytes()
                temp_file.write(chunk_data)
        
        try:
            # 一時ファイルをGCSにアップロード
            final_blob.upload_from_filename(temp_path)
            
            # 一時ファイルの削除
            os.unlink(temp_path)
            
            # メタデータの更新
            metadata["status"] = "processing"
            metadata["progress"] = 0.0
            metadata["blob_path"] = final_blob_path
            metadata["updated_at"] = datetime.now().isoformat()
            
            if md5_hash:
                metadata["md5_hash"] = md5_hash
            
            await self._save_metadata_to_gcs(user_id, media_id_str, metadata)
            
            # 非同期で処理を開始（ここではシミュレーション）
            asyncio.create_task(self._process_media(user_id, media_id_str))
            
            return {
                "media_id": media_id_str,
                "status": "processing",
                "progress": 0.0
            }
        except Exception as e:
            return {
                "media_id": media_id_str,
                "status": "error",
                "progress": 0.0,
                "error": f"ファイル結合エラー: {str(e)}"
            }
    
    async def _process_media(self, user_id: str, media_id: str) -> None:
        """
        メディア処理のシミュレーション
        実際の環境では、ここでSTTやOCR処理を行う
        """
        # 処理時間のシミュレーション
        total_steps = 5
        
        for step in range(1, total_steps + 1):
            # メタデータの更新
            metadata = await self._load_metadata_from_gcs(user_id, media_id)
            metadata["progress"] = step / total_steps
            metadata["updated_at"] = datetime.now().isoformat()
            await self._save_metadata_to_gcs(user_id, media_id, metadata)
            
            # 処理時間のシミュレーション
            await asyncio.sleep(2)
        
        # 処理完了
        metadata = await self._load_metadata_from_gcs(user_id, media_id)
        metadata["status"] = "completed"
        metadata["progress"] = 1.0
        metadata["updated_at"] = datetime.now().isoformat()
        metadata["result"] = {
            "transcript": "これはテスト用の文字起こし結果です。",
            "duration": 5.0,
            "language": "ja-JP"
        }
        await self._save_metadata_to_gcs(user_id, media_id, metadata)
    
    async def get_media_status(
        self,
        media_id: Union[str, UUID],
        user_id: str
    ) -> Dict:
        """
        メディア処理状況を取得
        """
        media_id_str = str(media_id)
        
        # メタデータの読み込み
        metadata = await self._load_metadata_from_gcs(user_id, media_id_str)
        
        if not metadata:
            return {
                "media_id": media_id_str,
                "status": "error",
                "progress": 0.0,
                "error": "メディアが見つかりません",
                "result": None
            }
        
        return {
            "media_id": media_id_str,
            "status": metadata.get("status", "unknown"),
            "progress": metadata.get("progress", 0.0),
            "error": metadata.get("error"),
            "result": metadata.get("result")
        }
    
    async def get_file_url(
        self,
        media_id: Union[str, UUID],
        user_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        ファイルのダウンロードURLを取得
        """
        media_id_str = str(media_id)
        
        # メタデータの読み込み
        metadata = await self._load_metadata_from_gcs(user_id, media_id_str)
        
        if not metadata or "blob_path" not in metadata:
            raise FileNotFoundError(f"メディア {media_id_str} が見つかりません")
        
        # Blobの取得
        blob_path = metadata["blob_path"]
        blob = self.bucket.blob(blob_path)
        
        # 署名付きURLの生成
        expiration = datetime.now() + timedelta(seconds=expires_in)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=expiration,
            method="GET"
        )
        
        return signed_url
    
    async def delete_file(
        self,
        media_id: Union[str, UUID],
        user_id: str
    ) -> bool:
        """
        ファイルを削除
        """
        media_id_str = str(media_id)
        
        # メタデータの読み込み
        metadata = await self._load_metadata_from_gcs(user_id, media_id_str)
        
        if not metadata:
            return False
        
        try:
            # メインファイルの削除
            if "blob_path" in metadata:
                blob_path = metadata["blob_path"]
                blob = self.bucket.blob(blob_path)
                blob.delete()
            
            # チャンクの削除
            if "chunks" in metadata:
                for chunk_index, chunk_info in metadata["chunks"].items():
                    chunk_path = chunk_info["path"]
                    chunk_blob = self.bucket.blob(chunk_path)
                    chunk_blob.delete()
            
            # メタデータの削除
            metadata_path = self._get_metadata_blob_path(user_id, media_id_str)
            metadata_blob = self.bucket.blob(metadata_path)
            metadata_blob.delete()
            
            return True
        except Exception as e:
            print(f"ファイル削除エラー: {e}")
            return False
    
    def _get_extension_from_mimetype(self, mimetype: str) -> str:
        """
        MIMEタイプからファイル拡張子を取得
        """
        mimetype_map = {
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/wave": "wav",
            "audio/mp3": "mp3",
            "audio/mpeg": "mp3",
            "audio/m4a": "m4a",
            "audio/mp4": "m4a",
            "audio/aac": "aac",
            "audio/ogg": "ogg",
            "audio/webm": "webm",
            "application/pdf": "pdf",
            "image/jpeg": "jpg",
            "image/png": "png",
            "application/octet-stream": "bin"
        }
        
        return mimetype_map.get(mimetype.lower(), "bin")

    async def upload_file(self, media_id: str, file: BinaryIO, filename: str, content_type: str, user_id: str) -> dict:
        """
        FormDataで受け取ったファイルをGCSに保存
        """
        # ファイル拡張子の取得
        ext = self._get_extension_from_mimetype(content_type)
        blob_path = self._get_blob_path(user_id, media_id, ext)
        blob = self.bucket.blob(blob_path)
        # GCSにアップロード
        blob.upload_from_file(file, content_type=content_type)
        # メタデータの作成
        metadata = {
            "media_id": media_id,
            "user_id": user_id,
            "file_type": content_type,
            "status": "processing",
            "progress": 0.0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "blob_path": blob_path
        }
        await self._save_metadata_to_gcs(user_id, media_id, metadata)
        # 非同期で処理を開始（ここではシミュレーション）
        asyncio.create_task(self._process_media(user_id, media_id))
        return {"status": "success", "media_id": media_id, "blob_path": blob_path}

    # 🆕 写真スキャン専用メソッド
    def _get_photo_scan_blob_path(self, note_id: str, page_id: str) -> str:
        """
        写真スキャン用のBlobパスを取得
        形式: {note_id}/{page_id}.jpg
        """
        return f"{note_id}/{page_id}.jpg"
    
    async def upload_photo_scan_image(
        self, 
        note_id: str, 
        page_id: str, 
        image_data: bytes, 
        user_id: str
    ) -> dict:
        """
        写真スキャン画像をGCSに保存
        複数ページ対応のため note_id/page_id.jpg 形式で保存
        
        Args:
            note_id: ノートID
            page_id: ページID
            image_data: 画像のバイナリデータ
            user_id: ユーザーID
            
        Returns:
            保存結果の辞書
        """
        try:
            # 写真スキャン用Blobパスの生成
            blob_path = self._get_photo_scan_blob_path(note_id, page_id)
            blob = self.bucket.blob(blob_path)
            
            # GCSにアップロード
            blob.upload_from_string(
                image_data, 
                content_type="image/jpeg"
            )
            
            # メタデータの作成
            metadata = {
                "note_id": note_id,
                "page_id": page_id,
                "user_id": user_id,
                "file_type": "image/jpeg",
                "status": "completed",
                "blob_path": blob_path,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "storage_type": "photo_scan"
            }
            
            # メタデータの保存（写真スキャン用）
            await self._save_photo_scan_metadata(note_id, page_id, metadata)
            
            return {
                "status": "success",
                "note_id": note_id,
                "page_id": page_id,
                "blob_path": blob_path,
                "public_url": f"gs://{self.bucket_name}/{blob_path}"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "note_id": note_id,
                "page_id": page_id,
                "error": f"画像保存エラー: {str(e)}"
            }
    
    async def _save_photo_scan_metadata(self, note_id: str, page_id: str, metadata: Dict) -> None:
        """
        写真スキャン用メタデータをGCSに保存
        """
        metadata_path = f"{note_id}/{page_id}_metadata.json"
        blob = self.bucket.blob(metadata_path)
        
        # メタデータをJSON形式に変換
        metadata_json = json.dumps(metadata, ensure_ascii=False)
        
        # GCSにアップロード
        blob.upload_from_string(metadata_json, content_type="application/json")
    
    async def get_photo_scan_image_url(
        self,
        note_id: str,
        page_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        写真スキャン画像のダウンロードURLを取得
        """
        blob_path = self._get_photo_scan_blob_path(note_id, page_id)
        blob = self.bucket.blob(blob_path)
        
        # 署名付きURLの生成
        expiration = datetime.now() + timedelta(seconds=expires_in)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=expiration,
            method="GET"
        )
        
        return signed_url
    
    async def delete_photo_scan_images(self, note_id: str) -> bool:
        """
        写真スキャンノートの全画像を削除
        """
        try:
            # note_id/ プレフィックスの全ファイルを削除
            blobs = self.bucket.list_blobs(prefix=f"{note_id}/")
            
            for blob in blobs:
                blob.delete()
            
            return True
            
        except Exception as e:
            print(f"写真スキャン画像削除エラー: {e}")
            return False