"""
Google Cloud Pub/Sub utilities for asynchronous processing.
"""
import json
import logging
import os
from typing import Any, Dict, Optional, Union

from google.cloud import pubsub_v1
from google.oauth2 import service_account

from app.core.settings import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PubSubClient:
    """Google Cloud Pub/Sub client wrapper."""
    
    def __init__(
        self,
        project_id: Optional[str] = None,
        credentials_path: Optional[str] = None
    ):
        """
        Initialize the Pub/Sub client.
        
        Args:
            project_id: Google Cloud project ID
            credentials_path: Path to Google Cloud credentials JSON file
        """
        self.project_id = project_id or settings.GCP_PROJECT_ID
        
        # Initialize credentials
        if credentials_path and os.path.exists(credentials_path):
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    credentials_path
                )
                self.publisher = pubsub_v1.PublisherClient(credentials=credentials)
                self.subscriber = pubsub_v1.SubscriberClient(credentials=credentials)
            except Exception as e:
                logger.warning(f"Failed to load credentials from {credentials_path}: {e}")
                # Fallback to default credentials
                self.publisher = pubsub_v1.PublisherClient()
                self.subscriber = pubsub_v1.SubscriberClient()
        else:
            self.publisher = pubsub_v1.PublisherClient()
            self.subscriber = pubsub_v1.SubscriberClient()
    
    def publish_message(
        self,
        topic_id: str,
        message: Union[Dict[str, Any], str],
        attributes: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Publish a message to a Pub/Sub topic.
        
        Args:
            topic_id: Pub/Sub topic ID
            message: Message data (dict or string)
            attributes: Message attributes
            
        Returns:
            str: Published message ID
        """
        topic_path = self.publisher.topic_path(self.project_id, topic_id)
        
        # Convert message to JSON string if it's a dict
        if isinstance(message, dict):
            message_data = json.dumps(message).encode("utf-8")
        else:
            message_data = message.encode("utf-8")
        
        # Publish the message
        try:
            future = self.publisher.publish(
                topic_path, 
                data=message_data,
                **attributes or {}
            )
            message_id = future.result()
            logger.info(f"Published message to {topic_id} with ID: {message_id}")
            return message_id
        except Exception as e:
            logger.error(f"Error publishing message to {topic_id}: {str(e)}")
            raise
    
    def create_subscription(
        self,
        topic_id: str,
        subscription_id: str,
        ack_deadline_seconds: int = 60
    ) -> str:
        """
        Create a subscription to a Pub/Sub topic.
        
        Args:
            topic_id: Pub/Sub topic ID
            subscription_id: Subscription ID
            ack_deadline_seconds: Acknowledgement deadline in seconds
            
        Returns:
            str: Subscription path
        """
        topic_path = self.publisher.topic_path(self.project_id, topic_id)
        subscription_path = self.subscriber.subscription_path(
            self.project_id, subscription_id
        )
        
        try:
            subscription = self.subscriber.create_subscription(
                request={
                    "name": subscription_path,
                    "topic": topic_path,
                    "ack_deadline_seconds": ack_deadline_seconds,
                }
            )
            logger.info(f"Created subscription: {subscription.name}")
            return subscription.name
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            raise


# モック実装（テスト用）
class MockPubSubClient:
    """テスト用のモックPub/Subクライアント"""
    
    def __init__(self, *args, **kwargs):
        self.project_id = kwargs.get('project_id') or settings.GCP_PROJECT_ID
        self.messages = []
        logger.info("Using Mock PubSub Client for testing")
    
    def publish_message(self, topic_id, message, attributes=None):
        """メッセージをモック保存"""
        message_id = f"mock-msg-{len(self.messages)}"
        self.messages.append({
            "topic_id": topic_id,
            "message": message,
            "attributes": attributes,
            "id": message_id
        })
        logger.info(f"Mock published message to {topic_id}: {message_id}")
        return message_id
    
    def create_subscription(self, topic_id, subscription_id, ack_deadline_seconds=60):
        """モックサブスクリプション作成"""
        subscription_path = f"projects/{self.project_id}/subscriptions/{subscription_id}"
        logger.info(f"Mock created subscription: {subscription_path}")
        return subscription_path


# 環境変数に基づいてクライアントを選択
if settings.FEATURE_PUBSUB == False:
    pubsub_client = MockPubSubClient(project_id=settings.GCP_PROJECT_ID)
else:
    # 本番用クライアント
    pubsub_client = PubSubClient(
        project_id=settings.GCP_PROJECT_ID,
        credentials_path=settings.GOOGLE_APPLICATION_CREDENTIALS
    )
