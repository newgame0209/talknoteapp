"""
TTS (Text-to-Speech) providers module.
"""

from .base import BaseTTSProvider, SynthesisResult, VoiceInfo
from .minimax import MinimaxTTSProvider
from .elevenlabs import ElevenLabsTTSProvider
from .google import GoogleTTSProvider

__all__ = [
    "BaseTTSProvider",
    "SynthesisResult", 
    "VoiceInfo",
    "MinimaxTTSProvider",
    "ElevenLabsTTSProvider",
    "GoogleTTSProvider",
] 