"""
Unit tests for the MockPubSubClient in tests/unit/utils/pubsub_mock.py
"""
import json
import pytest
from unittest.mock import MagicMock, patch

# モック実装をインポート
from tests.unit.utils.pubsub_mock import MockPubSubClient


class TestPubSubClientMock:
    """Test cases for MockPubSubClient class."""

    @pytest.mark.parametrize("project_id,expected", [
        (None, "test-project-id"),
        ("custom-project", "custom-project")
    ])
    def test_init(self, project_id, expected):
        """Test initialization of MockPubSubClient."""
        # モックPubSubClientを初期化
        client = MockPubSubClient(project_id=project_id)
        
        # アサーション
        assert client.project_id == expected if project_id else "test-project-id"
        assert client.publisher is not None
        assert client.subscriber is not None

    def test_publish_message_dict(self):
        """Test publishing a dictionary message."""
        # モックPubSubClientを初期化
        client = MockPubSubClient(project_id="test-project-id")
        
        # メッセージを発行
        message = {"key": "value"}
        result = client.publish_message("test-topic", message)
        
        # アサーション
        client.publisher.topic_path.assert_called_once_with("test-project-id", "test-topic")
        client.publisher.publish.assert_called_once()
        assert result == "mock-message-id"

    def test_publish_message_string(self):
        """Test publishing a string message."""
        # モックPubSubClientを初期化
        client = MockPubSubClient(project_id="test-project-id")
        
        # メッセージを発行
        message = "test message"
        result = client.publish_message("test-topic", message)
        
        # アサーション
        client.publisher.topic_path.assert_called_once_with("test-project-id", "test-topic")
        client.publisher.publish.assert_called_once()
        assert result == "mock-message-id"

    def test_create_subscription(self):
        """Test creating a subscription."""
        # モックPubSubClientを初期化
        client = MockPubSubClient(project_id="test-project-id")
        
        # サブスクリプションを作成
        result = client.create_subscription("test-topic", "test-subscription", 30)
        
        # アサーション
        client.publisher.topic_path.assert_called_once_with("test-project-id", "test-topic")
        client.subscriber.subscription_path.assert_called_once_with("test-project-id", "test-subscription")
        client.subscriber.create_subscription.assert_called_once()
        assert "projects/test-project-id/subscriptions/test-subscription" in result
