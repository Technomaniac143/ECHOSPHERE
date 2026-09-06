"""
Agora service types for EchoSphere.

Type definitions for Agora RTC, Conversational AI Engine, and Cloud Recording.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AgoraChannelMode(Enum):
    """Channel mode for Agora RTC."""
    COMMUNICATION = "communication"
    LIVE_STREAMING = "live_streaming"
    AUDIO_STREAMING = "audio_streaming"


class RtcRole(Enum):
    """Agora RTC user role."""
    BROADCASTER = "broadcaster"
    AUDIENCE = "audience"


class VoiceEventType(Enum):
    """Voice event types from Agora Conversational AI."""
    TEXT_RESPONSE = "text_response"
    AUDIO_RESPONSE = "audio_response"
    INTERRUPT = "interrupt"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class AgentsightField(Enum):
    """Agora Conversational AI field names (RESERVED for API verification)."""
    # These field names follow the spec from TRD §5.1.
    # After Agora API verification, confirm exact names match.
    ID = "id"
    NAME = "name"
    PROPERTIES = "properties"
    CHANNEL = "channel"
    TOKEN = "token"
    AGENT_RTC_UID = "agent_rtc_uid"
    ASR = "asr"
    LLM = "llm"
    TTS = "tts"
    INTERRUPT = "interrupt"
    VAD = "vad"
    GREETING_CONFIGS = "greeting_configs"
    SYSTEM_MESSAGES = "system_messages"
    MCP_SERVERS = "mcp_servers"
    VENDOR = "vendor"
    API_KEY = "api_key"
    TEXT = "text"
    INTERRUPTABLE = "interruptable"
    MODE = "mode"
    KEYWORDS = "keywords"
    ATTENTION_LOCK_VOICEPRINT = "attention_lock_voiceprint"
    JOIN_URL = "join_url"
    APP_ID = "app_id"
    AGENT_ID = "agent_id"


class AgoraTokenParams(BaseModel):
    """Parameters for Agora RTC token generation."""
    app_id: str = Field(..., description="Agora App ID")
    app_certificate: str = Field(..., description="Agora App Certificate")
    channel_name: str = Field(..., description="Channel name for the session")
    uid: int = Field(default=0, description="User ID (0 for auto-assign)")
    role: RtcRole = Field(default=RtcRole.BROADCASTER, description="RTC role")
    expiration: int = Field(default=3600, description="Token expiration in seconds")


class AgoraToken(BaseModel):
    """Generated Agora RTC token."""
    token: str
    channel_name: str
    uid: int
    expiration: int


class ConvoAIAgentConfig(BaseModel):
    """Configuration for starting a Conversational AI agent session.

    IMPORTANT: Field names in this model follow the TRD §5.1 proposal.
    After verifying against Agora's current Conversational AI Engine API,
    update field names here to match. This model is the adapter boundary.
    """

    app_id: str
    agent_name: str = Field(default="echosphere-agent", description="Agent display name")
    channel: str
    rtc_token: str
    agent_rtc_uid: str = Field(default="echosphere-agent")
    asr_vendor: str = Field(default="gemini_live", description="ASR vendor")
    llm_vendor: str = Field(default="gemini_live", description="LLM vendor")
    llm_api_key: str  # Never exposed to frontend; used server-side only
    system_messages: list[str] = Field(default_factory=list)
    mcp_servers: list[str] = Field(default_factory=list)
    greeting_text: str = ""
    greeting_interruptable: bool = False
    tts_vendor: str = Field(default="gemini_live", description="TTS vendor")
    interrupt_mode: str = Field(default="speech_and_keyword")
    interrupt_keywords: list[str] = Field(default=["hey panel"])
    voiceprint_id: Optional[str] = None
    voice_id: Optional[str] = None  # Voice preset for TTS

    class Config:
        json_encoders = {
            # Custom JSON encoding if needed
        }


# Alias for channel config
AgoraChannelConfig = ConvoAIAgentConfig


class ConvoAIStartRequest(BaseModel):
    """Request to start a ConvoAI agent session."""

    app_id: str
    agent_name: str
    channel: str
    rtc_token: str
    agent_rtc_uid: str = "echosphere-agent"
    llm_api_key: str
    system_messages: list[str] = Field(default_factory=list)
    mcp_servers: list[str] = Field(default_factory=list)
    greeting_text: str = ""
    greeting_interruptable: bool = False
    interrupt_keywords: list[str] = Field(default=["hey panel"])
    voiceprint_id: Optional[str] = None


class ConvoAIStartResponse(BaseModel):
    """Response from starting a ConvoAI agent session."""
    agent_id: str
    join_url: Optional[str] = None
    status: str = "started"


class ConvoAIInterruptRequest(BaseModel):
    """Request to interrupt/send a message to the ConvoAI agent."""

    agent_id: str
    app_id: str
    text: str


class ConvoAIInterruptResponse(BaseModel):
    """Response from interrupting a ConvoAI agent."""
    status: str
    message: Optional[str] = None


class CloudRecordingConfig(BaseModel):
    """Configuration for Agora cloud recording.

    IMPORTANT: Field names need verification against Agora's current
    Cloud Recording REST API. This is the adapter boundary.
    """

    app_id: str
    channel_name: str
    recording_mode: str = Field(default="individual", description="individual ormix")
    max_duration: int = Field(default=0, description="Max recording duration in seconds (0=unlimited)")
    storage_region: str = Field(default="na", description="Storage region")
    storage_bucket: Optional[str] = None
    storage_access_key: Optional[str] = None
    storage_secret_key: Optional[str] = None
    recording_filename_prefix: str = "echosphere-recording"
    vodec: bool = True  # Enable video codec
    accelerator_mode: bool = True  # Enable acceleration


class CloudRecordingStartRequest(BaseModel):
    """Request to start cloud recording."""

    app_id: str
    channel_name: str
    recording_config: CloudRecordingConfig


class CloudRecordingStartResponse(BaseModel):
    """Response from starting cloud recording."""
    recording_id: str
    resource_id: Optional[str] = None
    status: str = "starting"


class CloudRecordingStopRequest(BaseModel):
    """Request to stop cloud recording."""

    app_id: str
    recording_id: str


class CloudRecordingStopResponse(BaseModel):
    """Response from stopping cloud recording."""
    status: str
    recording_files: list[str] = Field(default_factory=list)


class AgoraRtcEvent(BaseModel):
    """Event from Agora RTC (forwarded to integrity service)."""
    event_type: str
    session_id: str
    data: dict


class ConnectionQuality(Enum):
    """Agora connection quality levels."""
    EXCELLENT = "excellent"
    GOOD = "good"
    POOR = "poor"
    BAD = "bad"
    UNKNOWN = "unknown"


class ReconnectionAdvice(BaseModel):
    """Agora reconnection advice."""
    reason: str
    wait_time_ms: int
    suggestion: str
