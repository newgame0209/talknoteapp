"""
テスト用のPubSubClientモック
"""
import json
from typing import Any, Dict, Optional, Union
from unittest.mock import MagicMock


class MockPubSubClient:
    """Google Cloud Pub/Subクライアントのモック実装"""
    
    def __init__(self, project_id: Optional[str] = None, credentials_path: Optional[str] = None):
        """
        モックPub/Subクライアントを初期化
        
        Args:
            project_id: Google Cloudプロジェクトの識別子
            credentials_path: Google Cloud認証情報のJSONファイルへのパス
        """
        self.project_id = project_id or "test-project-id"
        self.credentials_path = credentials_path
        
        # モックのクライアントを作成
        self.publisher = MagicMock()
        self.subscriber = MagicMock()
        
        # トピックパスとサブスクリプションパスのモック
        self.publisher.topic_path.side_effect = lambda project, topic: f"projects/{project}/topics/{topic}"
        self.subscriber.subscription_path.side_effect = lambda project, sub: f"projects/{project}/subscriptions/{sub}"
        
        # 発行のモック
        future = MagicMock()
        future.result.return_value = "mock-message-id"
        self.publisher.publish.return_value = future
        
        # サブスクリプション作成のモック
        subscription = MagicMock()
        subscription.name = "projects/test-project-id/subscriptions/test-subscription"
        self.subscriber.create_subscription.return_value = subscription
    
    def publish_message(
        self,
        topic_id: str,
        message: Union[Dict[str, Any], str],
        attributes: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Pub/Subトピックにメッセージを発行するモック
        
        Args:
            topic_id: Pub/Subトピック識別子
            message: メッセージデータ（辞書または文字列）
            attributes: メッセージ属性
            
        Returns:
            str: 発行されたメッセージの識別子
        """
        topic_path = self.publisher.topic_path(self.project_id, topic_id)
        
        # メッセージをJSON文字列に変換（辞書の場合）
        if isinstance(message, dict):
            message_data = json.dumps(message).encode("utf-8")
        else:
            message_data = message.encode("utf-8")
        
        # メッセージを発行
        future = self.publisher.publish(
            topic_path, 
            data=message_data,
            **(attributes or {})
        )
        message_id = future.result()
        return message_id
    
    def create_subscription(
        self,
        topic_id: str,
        subscription_id: str,
        ack_deadline_seconds: int = 60
    ) -> str:
        """
        Pub/Subトピックのサブスクリプションを作成するモック
        
        Args:
            topic_id: Pub/Subトピック識別子
            subscription_id: サブスクリプション識別子
            ack_deadline_seconds: 確認応答の期限（秒）
            
        Returns:
            str: サブスクリプションパス
        """
        topic_path = self.publisher.topic_path(self.project_id, topic_id)
        subscription_path = self.subscriber.subscription_path(
            self.project_id, subscription_id
        )
        
        subscription = self.subscriber.create_subscription(
            request={
                "name": subscription_path,
                "topic": topic_path,
                "ack_deadline_seconds": ack_deadline_seconds,
            }
        )
        return subscription.name


# モックのシングルトンインスタンス
pubsub_client = MockPubSubClient(project_id="test-project-id")
