"""Agora Conversational AI service for managing agent sessions.

Uses the Agora Conversational AI REST API (v2):
  Start:   POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/join
  Stop:    POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/leave
  Interrupt: POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/interrupt
  Status:  GET  https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/agents/{agent_id}
  History: GET  https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/agents/{agent_id}/history

Auth: X-AGORA-API-KEY header (RESTful auth).
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import uuid4

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── API constants (verified against Agora docs 2026-09-06) ──────────────────

CONVAI_BASE = "https://api.agora.io/api/conversational-ai-agent/v2/projects"
CONVAI_API_KEY_HEADER = "X-AGORA-API-KEY"


class AgoraConversationalAIConfig:
    """Configuration for Agora Conversational AI Engine agent.

    Wraps the fields needed for the /join request body per the Agora REST API.
    System messages and greeting are passed via the llm block.
    """

    def __init__(
        self,
        *,
        agent_name: str,
        channel_name: str,
        token: str,
        agent_rtc_uid: str = "echosphere-agent",
        remote_rtc_uids: list[str] | None = None,
        system_messages: list[str] | None = None,
        greeting_text: str = "Hello! I'm your interviewer. Let's begin.",
        interrupt_mode: str = "speech_and_keyword",
        interrupt_keywords: list[str] | None = None,
        asr_vendor: str = "gemini_live",
        llm_vendor: str = "gemini_live",
        tts_vendor: str = "gemini_live",
        gemini_api_key: Optional[str] = None,
        mcp_server_url: Optional[str] = None,
        voice_lock_voiceprint_id: Optional[str] = None,
        llm_model: str = "gemini-2.0-flash-exp",
        llm_max_history: int = 10,
        llm_failure_message: str = "Sorry, I'm not sure how to respond to that.",
        tts_voice_id: Optional[str] = None,
    ):
        self.agent_name = agent_name
        self.channel_name = channel_name
        self.token = token
        self.agent_rtc_uid = agent_rtc_uid
        self.remote_rtc_uids = remote_rtc_uids or []
        self.system_messages = system_messages or []
        self.greeting_text = greeting_text
        self.interrupt_mode = interrupt_mode
        self.interrupt_keywords = interrupt_keywords or ["hey panel", "next interviewer"]
        self.asr_vendor = asr_vendor
        self.llm_vendor = llm_vendor
        self.tts_vendor = tts_vendor
        self.gemini_api_key = gemini_api_key or settings.gemini_api_key
        self.mcp_server_url = mcp_server_url
        self.voice_lock_voiceprint_id = voice_lock_voiceprint_id
        self.llm_model = llm_model
        self.llm_max_history = llm_max_history
        self.llm_failure_message = llm_failure_message
        self.tts_voice_id = tts_voice_id

    def to_join_request(self) -> dict[str, Any]:
        """Build the request body for the /join (start agent) endpoint.

        Reference: https://docs.agora.io/en/api-reference/api-ref/conversational-ai/join
        """
        llm_block: dict[str, Any] = {
            "vendor": self.llm_vendor,
            "model": self.llm_model,
            "max_history": self.llm_max_history,
            "failure_message": self.llm_failure_message,
            "system_messages": self.system_messages,
        }
        if self.gemini_api_key:
            llm_block["api_key"] = self.gemini_api_key
        if self.mcp_server_url:
            llm_block["mcp_servers"] = [{"url": self.mcp_server_url}]

        request: dict[str, Any] = {
            "name": self.agent_name,
            "properties": {
                "channel": self.channel_name,
                "token": self.token,
                "agent_rtc_uid": self.agent_rtc_uid,
                "remote_rtc_uids": self.remote_rtc_uids,
                "asr": {
                    "vendor": self.asr_vendor,
                },
                "llm": llm_block,
                "tts": {
                    "vendor": self.tts_vendor,
                },
                "interrupt": {
                    "mode": self.interrupt_mode,
                    "keywords": self.interrupt_keywords,
                },
            },
        }

        if self.voice_lock_voiceprint_id:
            request["properties"]["vad"] = {
                "attention_lock_voiceprint": self.voice_lock_voiceprint_id,
            }

        if self.tts_voice_id:
            request["properties"]["tts"]["voice_id"] = self.tts_voice_id

        return request


class AgoraConversationalAIError(Exception):
    """Exception for Agora Conversational AI API errors."""

    def __init__(self, message: str, status_code: int | None = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class AgoraConversationalAI:
    """Service for managing Agora Conversational AI Engine agent sessions.

    Handles:
    - Starting/stopping AI agents via the REST API
    - Sending interrupt messages for persona handoffs
    - Querying agent status
    - Retrieving conversation history
    """

    def __init__(self):
        self._api_key = settings.agora_convoai_api_key
        self._app_id = settings.agora_app_id
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    def _base_headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            CONVAI_API_KEY_HEADER: self._api_key,
        }

    async def start_agent(
        self,
        config: AgoraConversationalAIConfig,
    ) -> dict[str, Any]:
        """Start a conversational AI agent in an Agora channel.

        Calls POST .../projects/{appid}/join.
        Returns the agent response containing agent_id, status, etc.
        """
        client = await self._get_client()
        url = f"{CONVAI_BASE}/{self._app_id}/join"
        payload = config.to_join_request()

        logger.info(
            "Starting ConvoAI agent %s in channel %s (remote_uids=%s)",
            config.agent_name,
            config.channel_name,
            config.remote_rtc_uids,
        )

        try:
            response = await client.post(
                url,
                headers=self._base_headers(),
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            logger.info("Agent started: agent_id=%s status=%s", result.get("agent_id"), result.get("status"))
            return result
        except httpx.HTTPStatusError as e:
            logger.error(
                "Failed to start agent: %s %s — %s",
                e.response.status_code,
                e.response.headers.get("content-type", ""),
                e.response.text[:500],
            )
            raise AgoraConversationalAIError(
                f"Failed to start ConvoAI agent: {e.response.status_code}",
                status_code=e.response.status_code,
                body=e.response.text,
            ) from e
        except Exception as e:
            logger.error("Unexpected error starting agent: %s", e)
            raise AgoraConversationalAIError(f"Unexpected error: {e}") from e

    async def interrupt_agent(
        self,
        agent_id: str,
        message: str,
    ) -> dict[str, Any]:
        """Send an interrupt/instruction message to the running agent.

        Calls POST .../projects/{appid}/interrupt.
        Used for persona handoffs — injecting new instructions.
        """
        client = await self._get_client()
        url = f"{CONVAI_BASE}/{self._app_id}/interrupt"

        payload: dict[str, Any] = {
            "agent_id": agent_id,
            "text": message,
        }

        logger.info("Interrupting agent %s: %s", agent_id, message[:100])

        try:
            response = await client.post(
                url,
                headers=self._base_headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("Failed to interrupt agent: %s — %s", e.response.status_code, e.response.text[:300])
            raise AgoraConversationalAIError(
                f"Failed to interrupt agent: {e.response.status_code}",
                status_code=e.response.status_code,
                body=e.response.text,
            ) from e
        except Exception as e:
            logger.error("Unexpected error interrupting agent: %s", e)
            raise AgoraConversationalAIError(f"Unexpected error: {e}") from e

    async def stop_agent(self, agent_id: str) -> dict[str, Any]:
        """Stop a running conversational AI agent.

        Calls POST .../projects/{appid}/leave.
        """
        client = await self._get_client()
        url = f"{CONVAI_BASE}/{self._app_id}/leave"

        payload: dict[str, Any] = {
            "agent_id": agent_id,
        }

        logger.info("Stopping ConvoAI agent %s", agent_id)

        try:
            response = await client.post(
                url,
                headers=self._base_headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("Failed to stop agent: %s — %s", e.response.status_code, e.response.text[:300])
            raise AgoraConversationalAIError(
                f"Failed to stop agent: {e.response.status_code}",
                status_code=e.response.status_code,
                body=e.response.text,
            ) from e
        except Exception as e:
            logger.error("Unexpected error stopping agent: %s", e)
            raise AgoraConversationalAIError(f"Unexpected error: {e}") from e

    async def get_agent_status(self, agent_id: str) -> dict[str, Any]:
        """Get the current status of a conversational AI agent.

        Calls GET .../projects/{appid}/agents/{agent_id}.
        """
        client = await self._get_client()
        url = f"{CONVAI_BASE}/{self._app_id}/agents/{agent_id}"

        try:
            response = await client.get(url, headers=self._base_headers())
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("Failed to get agent status: %s", e.response.status_code)
            raise AgoraConversationalAIError(
                f"Failed to get agent status: {e.response.status_code}",
                status_code=e.response.status_code,
            ) from e
        except Exception as e:
            logger.error("Unexpected error getting agent status: %s", e)
            raise AgoraConversationalAIError(f"Unexpected error: {e}") from e

    async def get_agent_history(
        self,
        agent_id: str,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Retrieve short-term conversation history for an agent.

        Calls GET .../projects/{appid}/agents/{agent_id}/history.
        """
        client = await self._get_client()
        url = f"{CONVAI_BASE}/{self._app_id}/agents/{agent_id}/history"
        params = {"limit": limit}

        try:
            response = await client.get(url, headers=self._base_headers(), params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("Failed to get agent history: %s", e.response.status_code)
            raise AgoraConversationalAIError(
                f"Failed to get agent history: {e.response.status_code}",
                status_code=e.response.status_code,
            ) from e
        except Exception as e:
            logger.error("Unexpected error getting agent history: %s", e)
            raise AgoraConversationalAIError(f"Unexpected error: {e}") from e


# ── Singleton ─────────────────────────────────────────────────────────────────

_convoai_service: Optional[AgoraConversationalAI] = None


def get_convoai_service() -> AgoraConversationalAI:
    """Get the singleton Conversational AI service instance."""
    global _convoai_service
    if _convoai_service is None:
        _convoai_service = AgoraConversationalAI()
    return _convoai_service


# ── Aliases & Helper Wrappers ────────────────────────────────────────────────

ConvoAIError = AgoraConversationalAIError
ConvoAIConfigError = AgoraConversationalAIError
ConvoAIAgentNotRunningError = AgoraConversationalAIError
ConvoAIUnavailableError = AgoraConversationalAIError


async def start_convo_agent(
    channel_name: str,
    token: str,
    agent_name: str = "echosphere-agent",
    persona_system_prompt: Optional[str] = None,
    greeting_text: Optional[str] = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Helper wrapper to start a Conversational AI agent session."""
    system_messages = [persona_system_prompt] if persona_system_prompt else []
    config = AgoraConversationalAIConfig(
        agent_name=agent_name,
        channel_name=channel_name,
        token=token,
        system_messages=system_messages,
        greeting_text=greeting_text or "Hello! I'm your AI interviewer. Let's begin.",
        **kwargs,
    )
    service = get_convoai_service()
    return await service.start_agent(config)


async def stop_convo_agent(agent_id: str) -> dict[str, Any]:
    """Helper wrapper to stop a Conversational AI agent session."""
    service = get_convoai_service()
    return await service.stop_agent(agent_id)


async def interrupt_convo_agent(agent_id: str, message: str) -> dict[str, Any]:
    """Helper wrapper to interrupt / send prompt instruction to a running agent."""
    service = get_convoai_service()
    return await service.interrupt_agent(agent_id, message)


def build_system_message(
    persona: str,
    target_role: str,
    target_company: Optional[str] = None,
    difficulty: str = "medium",
) -> str:
    """Build initial system prompt message for an interviewer persona."""
    company_str = f" at {target_company}" if target_company else ""
    return (
        f"You are the {persona.upper()} interviewer for a candidate applying for {target_role}{company_str}. "
        f"Current difficulty level is {difficulty}. Ask clear, focused questions, evaluate their depth of knowledge, "
        f"and adapt based on their claims."
    )


def get_disclosure_text() -> str:
    """Get standard spoken AI disclosure message prior to evaluative questions."""
    return (
        "Hello! Welcome to your interview with EchoSphere. I am an AI-driven interview panel. "
        "This session will be recorded and evaluated across technical, product, and behavioral competencies. "
        "Let's begin."
    )
