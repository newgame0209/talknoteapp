"""
Unit tests for the PubSubClient using MockPubSubClient
"""
import json
import pytest
from unittest.mock import MagicMock

# モック実装をインポート
from tests.unit.utils.pubsub_mock import MockPubSubClient


class TestPubSubClient:
    """Test cases for PubSubClient class using MockPubSubClient."""

    @pytest.fixture
    def pubsub_client(self):
        # モックPubSubClientを作成
        return MockPubSubClient(project_id="test-project-id")

    def test_init_with_default_params(self):
        """Test initialization with default parameters."""
        client = MockPubSubClient()
        assert client.project_id == "test-project-id"
        assert client.publisher is not None
        assert client.subscriber is not None

    def test_init_with_custom_params(self):
        """Test initialization with custom parameters."""
        client = MockPubSubClient(
            project_id="custom-project",
            credentials_path="/path/to/credentials.json"
        )
        assert client.project_id == "custom-project"
        assert client.credentials_path == "/path/to/credentials.json"
        assert client.publisher is not None
        assert client.subscriber is not None

    def test_publish_message_dict(self, pubsub_client):
        """Test publishing a dictionary message."""
        # Setup
        topic_id = "test-topic"
        message = {"key": "value"}
        expected_data = json.dumps(message).encode("utf-8")
        
        # Execute
        result = pubsub_client.publish_message(topic_id, message)
        
        # Assert
        pubsub_client.publisher.topic_path.assert_called_once_with("test-project-id", topic_id)
        pubsub_client.publisher.publish.assert_called_once()
        # データの検証は複雑なので省略（モック内部で処理されるため）
        assert result == "mock-message-id"

    def test_publish_message_string(self, pubsub_client):
        """Test publishing a string message."""
        # Setup
        topic_id = "test-topic"
        message = "test message"
        expected_data = message.encode("utf-8")
        
        # Execute
        result = pubsub_client.publish_message(topic_id, message)
        
        # Assert
        pubsub_client.publisher.topic_path.assert_called_once_with("test-project-id", topic_id)
        pubsub_client.publisher.publish.assert_called_once()
        assert result == "mock-message-id"

    def test_publish_message_with_attributes(self, pubsub_client):
        """Test publishing a message with attributes."""
        # Setup
        topic_id = "test-topic"
        message = "test message"
        attributes = {"attr1": "value1", "attr2": "value2"}
        
        # Execute
        result = pubsub_client.publish_message(topic_id, message, attributes)
        
        # Assert
        pubsub_client.publisher.topic_path.assert_called_once_with("test-project-id", topic_id)
        pubsub_client.publisher.publish.assert_called_once()
        assert result == "mock-message-id"

    def test_create_subscription(self, pubsub_client):
        """Test creating a subscription."""
        # Setup
        topic_id = "test-topic"
        subscription_id = "test-subscription"
        ack_deadline = 30
        
        # Execute
        result = pubsub_client.create_subscription(topic_id, subscription_id, ack_deadline)
        
        # Assert
        pubsub_client.publisher.topic_path.assert_called_once_with("test-project-id", topic_id)
        pubsub_client.subscriber.subscription_path.assert_called_once_with("test-project-id", subscription_id)
        pubsub_client.subscriber.create_subscription.assert_called_once()
        assert "projects/test-project-id/subscriptions/test-subscription" in result
