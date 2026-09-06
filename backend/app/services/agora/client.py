"""Agora HTTP client and errors."""
import logging
from app.services.agora.conversation_service import ConvoAIError

logger = logging.getLogger(__name__)


class AgoraClientError(ConvoAIError):
    """General error for Agora client operations."""
    pass
