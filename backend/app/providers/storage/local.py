"""
ローカルストレージプロバイダーの実装
開発環境用のローカルファイルシステムベースのストレージ
"""
import os
import json
import shutil
import asyncio
from typing import Dict, List, Optional, BinaryIO, Union
from uuid import UUID, uuid4
from datetime import datetime
from pathlib import Path

from app.core.settings import settings
from app.providers.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    """
    ローカルファイルシステムを使用したストレージプロバイダー
    開発環境用
    """
    
    def __init__(self):
        """
        ローカルストレージプロバイダーの初期化
        """
        # ベースディレクトリの設定
        self.base_dir = Path(settings.LOCAL_STORAGE_PATH)
        self.chunks_dir = self.base_dir / "chunks"
        self.media_dir = self.base_dir / "media"
        self.metadata_dir = self.base_dir / "metadata"
        
        # ディレクトリの作成
        self.chunks_dir.mkdir(parents=True, exist_ok=True)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_user_dir(self, user_id: str) -> Path:
        """ユーザーディレクトリを取得"""
        user_dir = self.media_dir / user_id
        user_dir.mkdir(exist_ok=True)
        return user_dir
    
    def _get_chunks_dir(self, user_id: str, media_id: str) -> Path:
        """チャンクディレクトリを取得"""
        chunks_dir = self.chunks_dir / user_id / media_id
        chunks_dir.mkdir(parents=True, exist_ok=True)
        return chunks_dir
    
    def _get_metadata_path(self, user_id: str, media_id: str) -> Path:
        """メタデータファイルパスを取得"""
        user_metadata_dir = self.metadata_dir / user_id
        user_metadata_dir.mkdir(parents=True, exist_ok=True)
        return user_metadata_dir / f"{media_id}.json"
    
    def _save_metadata(self, user_id: str, media_id: str, metadata: Dict) -> None:
        """メタデータを保存"""
        metadata_path = self._get_metadata_path(user_id, media_id)
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    def _load_metadata(self, user_id: str, media_id: str) -> Dict:
        """メタデータを読み込み"""
        metadata_path = self._get_metadata_path(user_id, media_id)
        if not metadata_path.exists():
            return {}
        
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _update_metadata(self, user_id: str, media_id: str, updates: Dict) -> Dict:
        """メタデータを更新"""
        metadata = self._load_metadata(user_id, media_id)
        metadata.update(updates)
        self._save_metadata(user_id, media_id, metadata)
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
        ローカル環境では直接ファイルパスを返す
        """
        media_id_str = str(media_id)
        
        # ファイル拡張子の取得
        ext = self._get_extension_from_mimetype(file_type)
        
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
            "filename": f"{media_id_str}.{ext}"
        }
        
        # メタデータの保存
        self._save_metadata(user_id, media_id_str, metadata)
        
        # チャンクアップロードが必要かどうかの判断
        chunk_upload_enabled = file_size > settings.MAX_DIRECT_UPLOAD_SIZE
        
        # ローカル環境では、サーバーのエンドポイントURLを返す
        base_url = settings.API_BASE_URL or "http://localhost:8000"
        
        if chunk_upload_enabled:
            # チャンクアップロードが必要な場合
            return {
                "media_id": media_id_str,
                "upload_url": f"{base_url}/api/v1/media/test-upload/{media_id_str}",
                "chunk_upload_enabled": True,
                "max_chunk_size": settings.MAX_CHUNK_SIZE
            }
        else:
            # 直接アップロードの場合
            return {
                "media_id": media_id_str,
                "upload_url": f"{base_url}/api/v1/media/test-upload/{media_id_str}",
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
        
        # チャンクディレクトリの取得
        chunks_dir = self._get_chunks_dir(user_id, media_id_str)
        
        # チャンクファイルパスの生成
        chunk_path = chunks_dir / f"chunk_{chunk_index:04d}.bin"
        
        # チャンクデータの保存
        chunk_content = chunk_data.read()
        chunk_size = len(chunk_content)
        
        with open(chunk_path, 'wb') as f:
            f.write(chunk_content)
        
        # メタデータの更新
        metadata = self._load_metadata(user_id, media_id_str)
        
        # チャンク情報の追加
        if "chunks" not in metadata:
            metadata["chunks"] = {}
        
        metadata["chunks"][str(chunk_index)] = {
            "size": chunk_size,
            "path": str(chunk_path),
            "uploaded_at": datetime.now().isoformat()
        }
        
        metadata["total_chunks"] = total_chunks
        metadata["updated_at"] = datetime.now().isoformat()
        
        # アップロード進捗の計算
        uploaded_chunks = len(metadata["chunks"])
        metadata["upload_progress"] = uploaded_chunks / total_chunks
        
        # メタデータの保存
        self._save_metadata(user_id, media_id_str, metadata)
        
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
        metadata = self._load_metadata(user_id, media_id_str)
        
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
        
        # 最終的なファイルパス
        user_dir = self._get_user_dir(user_id)
        final_path = user_dir / f"{media_id_str}.{ext}"
        
        # チャンクの結合
        with open(final_path, 'wb') as outfile:
            for i in range(total_chunks):
                chunk_info = metadata["chunks"].get(str(i))
                if not chunk_info:
                    return {
                        "media_id": media_id_str,
                        "status": "error",
                        "progress": 0.0,
                        "error": f"チャンク {i} が見つかりません"
                    }
                
                chunk_path = Path(chunk_info["path"])
                with open(chunk_path, 'rb') as infile:
                    outfile.write(infile.read())
        
        # メタデータの更新
        metadata["status"] = "processing"
        metadata["progress"] = 0.0
        metadata["file_path"] = str(final_path)
        metadata["updated_at"] = datetime.now().isoformat()
        
        if md5_hash:
            metadata["md5_hash"] = md5_hash
        
        self._save_metadata(user_id, media_id_str, metadata)
        
        # 非同期で処理を開始（ここではシミュレーション）
        asyncio.create_task(self._process_media(user_id, media_id_str))
        
        return {
            "media_id": media_id_str,
            "status": "processing",
            "progress": 0.0
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
            metadata = self._load_metadata(user_id, media_id)
            metadata["progress"] = step / total_steps
            metadata["updated_at"] = datetime.now().isoformat()
            self._save_metadata(user_id, media_id, metadata)
            
            # 処理時間のシミュレーション
            await asyncio.sleep(2)
        
        # 処理完了
        metadata = self._load_metadata(user_id, media_id)
        metadata["status"] = "completed"
        metadata["progress"] = 1.0
        metadata["updated_at"] = datetime.now().isoformat()
        metadata["result"] = {
            "transcript": "これはテスト用の文字起こし結果です。",
            "duration": 5.0,
            "language": "ja-JP"
        }
        self._save_metadata(user_id, media_id, metadata)
    
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
        metadata = self._load_metadata(user_id, media_id_str)
        
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
        ローカル環境では直接ファイルパスを返す
        """
        media_id_str = str(media_id)
        
        # メタデータの読み込み
        metadata = self._load_metadata(user_id, media_id_str)
        
        if not metadata or "file_path" not in metadata:
            raise FileNotFoundError(f"メディア {media_id_str} が見つかりません")
        
        # ローカル環境では、サーバーのエンドポイントURLを返す
        base_url = settings.API_BASE_URL or "http://localhost:8000"
        return f"{base_url}/api/v1/media/download/{media_id_str}"
    
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
        metadata = self._load_metadata(user_id, media_id_str)
        
        if not metadata:
            return False
        
        # ファイルの削除
        if "file_path" in metadata:
            file_path = Path(metadata["file_path"])
            if file_path.exists():
                file_path.unlink()
        
        # チャンクディレクトリの削除
        chunks_dir = self._get_chunks_dir(user_id, media_id_str)
        if chunks_dir.exists():
            shutil.rmtree(chunks_dir)
        
        # メタデータファイルの削除
        metadata_path = self._get_metadata_path(user_id, media_id_str)
        if metadata_path.exists():
            metadata_path.unlink()
        
        return True
    
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
    
    # 🆕 写真スキャン専用メソッド
    def _get_photo_scan_path(self, note_id: str, page_id: str) -> Path:
        """
        写真スキャン用のファイルパスを取得
        形式: {base_dir}/photo_scan/{note_id}/{page_id}.jpg
        """
        photo_scan_dir = self.base_dir / "photo_scan" / note_id
        photo_scan_dir.mkdir(parents=True, exist_ok=True)
        return photo_scan_dir / f"{page_id}.jpg"
    
    async def upload_photo_scan_image(
        self, 
        note_id: str, 
        page_id: str, 
        image_data: bytes, 
        user_id: str
    ) -> dict:
        """
        写真スキャン画像をローカルに保存
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
            # 写真スキャン用ファイルパスの生成
            file_path = self._get_photo_scan_path(note_id, page_id)
            
            # ローカルファイルに保存
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            # メタデータの作成
            metadata = {
                "note_id": note_id,
                "page_id": page_id,
                "user_id": user_id,
                "file_type": "image/jpeg",
                "status": "completed",
                "file_path": str(file_path),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "storage_type": "photo_scan"
            }
            
            # メタデータの保存（写真スキャン用）
            self._save_photo_scan_metadata(note_id, page_id, metadata)
            
            return {
                "status": "success",
                "note_id": note_id,
                "page_id": page_id,
                "file_path": str(file_path),
                "local_url": f"file://{file_path}"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "note_id": note_id,
                "page_id": page_id,
                "error": f"画像保存エラー: {str(e)}"
            }
    
    def _save_photo_scan_metadata(self, note_id: str, page_id: str, metadata: dict) -> None:
        """
        写真スキャン用メタデータをローカルに保存
        """
        metadata_dir = self.metadata_dir / "photo_scan" / note_id
        metadata_dir.mkdir(parents=True, exist_ok=True)
        
        metadata_path = metadata_dir / f"{page_id}_metadata.json"
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    async def get_photo_scan_image_url(
        self,
        note_id: str,
        page_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        写真スキャン画像のローカルURLを取得
        """
        file_path = self._get_photo_scan_path(note_id, page_id)
        
        if file_path.exists():
            return f"file://{file_path}"
        else:
            raise FileNotFoundError(f"写真スキャン画像が見つかりません: {note_id}/{page_id}")
    
    async def delete_photo_scan_images(self, note_id: str) -> bool:
        """
        写真スキャンノートの全画像を削除
        """
        try:
            # note_id ディレクトリを削除
            photo_scan_dir = self.base_dir / "photo_scan" / note_id
            if photo_scan_dir.exists():
                shutil.rmtree(photo_scan_dir)
            
            # メタデータディレクトリも削除
            metadata_dir = self.metadata_dir / "photo_scan" / note_id
            if metadata_dir.exists():
                shutil.rmtree(metadata_dir)
            
            return True
            
        except Exception as e:
            print(f"写真スキャン画像削除エラー: {e}")
            return False

    async def upload_file(self, media_id: str, file: BinaryIO, filename: str, content_type: str, user_id: str) -> dict:
        """
        FormDataで受け取ったファイルをローカルに保存
        """
        ext = self._get_extension_from_mimetype(content_type)
        user_dir = self._get_user_dir(user_id)
        save_path = user_dir / f"{media_id}.{ext}"
        with open(save_path, 'wb') as out_file:
            import shutil
            shutil.copyfileobj(file, out_file)
        metadata = {
            "media_id": media_id,
            "user_id": user_id,
            "file_type": content_type,
            "status": "processing",
            "progress": 0.0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "file_path": str(save_path)
        }
        self._save_metadata(user_id, media_id, metadata)
        asyncio.create_task(self._process_media(user_id, media_id))
        return {"status": "success", "media_id": media_id, "file_path": str(save_path)}
