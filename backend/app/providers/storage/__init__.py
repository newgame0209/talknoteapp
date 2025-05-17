"""
ストレージプロバイダーモジュール
"""
from app.providers.storage.base import StorageProvider
from app.providers.storage.local import LocalStorageProvider
from app.providers.storage.gcs import GCSStorageProvider
from app.core.settings import settings

def get_storage_provider() -> StorageProvider:
    """
    設定に基づいて適切なストレージプロバイダーを返す
    """
    provider_type = settings.STORAGE_PROVIDER.lower()
    
    if provider_type == "local":
        return LocalStorageProvider()
    elif provider_type == "gcs":
        return GCSStorageProvider()
    else:
        raise ValueError(f"不明なストレージプロバイダー: {provider_type}")
