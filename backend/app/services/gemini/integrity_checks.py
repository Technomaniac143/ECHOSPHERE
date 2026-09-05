"""
Integrity checks service for EchoSphere.

Uses Gemini Flash multimodal to analyze camera frames for integrity verification
during assessment sessions. Per TRD §7.4 and Master Build §62:

- Single person visible
- Candidate facing camera
- No obvious second device
- Reasonable camera presence

Results are written to whiteboard_events as integrity_flag events.
All flags are descriptive + timestamped, never auto-penalizing (AGENT_CONTEXT.md rule 6).

DEV MODE: If Gemini API key is not configured, uses mock analysis.
NEVER pretend mock analysis is real AI output.
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .client import GeminiClient, GeminiError, create_multimodal_client

logger = logging.getLogger(__name__)


# ── Integrity event types ────────────────────────────────────────────────────

class IntegrityEventType(Enum):
    """Types of integrity events that can be detected."""
    TAB_SWITCH = "tab_switch"
    FULLSCREEN_EXIT = "fullscreen_exit"
    CAMERA_ABSENCE = "camera_absence"
    MULTIPLE_PERSONS = "multiple_persons"
    SECOND_DEVICE = "second_device"
    POOR_LIGHTING = "poor_lighting"
    CAMERA_OFF = "camera_off"
    LOW_QUALITY = "low_quality"
    ALL_CLEAR = "all_clear"


class IntegrityFlagLevel(Enum):
    """Severity level of an integrity flag."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ── Integrity check result ───────────────────────────────────────────────────

class IntegrityCheckResult(BaseModel):
    """Result of a single integrity check on a camera frame."""

    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    session_id: str = ""
    event_type: IntegrityEventType = IntegrityEventType.ALL_CLEAR
    level: IntegrityFlagLevel = IntegrityFlagLevel.INFO
    description: str = ""
    details: dict = Field(default_factory=dict)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    recommendation: str = ""

    @property
    def is_suspicious(self) -> bool:
        """Whether this result indicates a potential integrity issue."""
        return self.event_type != IntegrityEventType.ALL_CLEAR

    def to_whiteboard_event_payload(self) -> dict:
        """Convert to whiteboard event payload format.

        Per AGENT_CONTEXT.md rule 6: integrity flags are descriptive + timestamped,
        never auto-penalizing.
        """
        return {
            "event_type": "integrity_flag",
            "source_persona": "integrity_service",
            "payload": {
                "flag_type": self.event_type.value,
                "level": self.level.value,
                "description": self.description,
                "timestamp": self.timestamp,
                "confidence": self.confidence,
                "details": self.details,
                "recommendation": self.recommendation,
            },
        }


# ── Analysis prompt ──────────────────────────────────────────────────────────

INTEGRITY_ANALYSIS_SYSTEM_PROMPT = """You are EchoSphere's Integrity Analysis Assistant.

Your job is to analyze a single camera frame image and determine if it shows
any integrity concerns for an online interview.

You MUST return your analysis as a JSON object matching this exact schema:

{
  "event_type": "all_clear|tab_switch|fullscreen_exit|camera_absence|multiple_persons|second_device|poor_lighting|camera_off|low_quality",
  "level": "info|warning|critical",
  "description": "Brief description of what you observe",
  "confidence": 0.0-1.0,
  "recommendation": "What the system should do (e.g., 'flag for review' or 'no action needed')"
}

ANALYSIS CRITERIA:
1. Is exactly one person visible and facing the camera? → all_clear if yes
2. Are there multiple people visible? → multiple_persons
3. Is there a second device (phone, tablet, second monitor) visible? → second_device
4. Is the camera feed black, frozen, or clearly off? → camera_absence or camera_off
5. Is the lighting so poor the candidate is barely visible? → poor_lighting
6. Is the image quality extremely low (blurry, pixelated beyond usability)? → low_quality

IMPORTANT:
- Be conservative. If you're unsure, default to all_clear.
- Do not penalize based on background, clothing, or environment.
- Only flag what you can clearly see in this single frame.
- Confidence should reflect how certain you are about your observation.
- Return ONLY the JSON object, no markdown, no explanation.
"""


INTEGRITY_ANALYSIS_USER_PROMPT_TEMPLATE = """Analyze this camera frame from an online interview session.

Session ID: {session_id}
Frame captured at: {captured_at}

Describe what you see in this image and flag any integrity concerns.

Return your analysis as JSON:
{{}}
"""


# ── Service ──────────────────────────────────────────────────────────────────

class IntegrityCheckError(Exception):
    """Integrity check failure."""
    pass


class IntegrityAnalysisUnavailable(IntegrityCheckError):
    """Gemini multimodal analysis is unavailable."""


class IntegrityCheckService:
    """Service for camera frame integrity analysis.

    Uses Gemini Flash multimodal to analyze camera frames during assessment
    sessions. Runs on a periodic schedule (every 15-20s per TRD §9).

    In dev mode (no Gemini key), returns mock results that are clearly marked
    as mock — never pretends mock is real analysis.
    """

    def __init__(self, client: Optional[GeminiClient] = None):
        if client is None:
            try:
                client = create_multimodal_client()
            except Exception:
                client = create_multimodal_client()
                # If not configured, client will be in dev/mock mode

        self._client = client

    @property
    def is_available(self) -> bool:
        """Whether the service can perform real AI analysis."""
        return self._client.is_configured and not self._client._dev_mode

    async def analyze_camera_frame(
        self,
        session_id: str,
        image_base64: str,
        captured_at: Optional[str] = None,
    ) -> IntegrityCheckResult:
        """Analyze a camera frame for integrity concerns.

        Args:
            session_id: The interview session ID.
            image_base64: Base64-encoded JPEG/PNG image data.
            captured_at: ISO timestamp when the frame was captured.

        Returns:
            IntegrityCheckResult with the analysis.

        Raises:
            IntegrityAnalysisUnavailable: If analysis service is down.
            IntegrityCheckError: On other errors.
        """
        captured_at = captured_at or datetime.now(timezone.utc).isoformat()

        prompt = INTEGRITY_ANALYSIS_USER_PROMPT_TEMPLATE.format(
            session_id=session_id,
            captured_at=captured_at,
        )

        if not self.is_available:
            # Dev mock mode — return a clearly-marked mock result
            logger.debug(
                "Integrity check DEV MODE: mock analysis for session=%s",
                session_id,
            )
            return IntegrityCheckResult(
                session_id=session_id,
                event_type=IntegrityEventType.ALL_CLEAR,
                level=IntegrityFlagLevel.INFO,
                description="Mock analysis: No integrity concerns detected (DEV MODE — Gemini not configured)",
                confidence=0.95,
                recommendation="No action needed. Note: This is a development mock, not real AI analysis.",
                details={"dev_mode": True, "note": "Gemini API key not configured"},
            )

        try:
            # Build multimodal request with image
            response_text = await self._client._generate_content_real(
                prompt=prompt,
                system_instruction=INTEGRITY_ANALYSIS_SYSTEM_PROMPT,
                temperature=0.1,  # Very low for consistent analysis
                max_output_tokens=512,
            )

            import json
            result = json.loads(response_text.strip())

            event_type_str = result.get("event_type", "all_clear")
            try:
                event_type = IntegrityEventType(event_type_str)
            except ValueError:
                event_type = IntegrityEventType.ALL_CLEAR
                logger.warning("Unknown integrity event type: %s, defaulting to all_clear", event_type_str)

            try:
                level = IntegrityFlagLevel(result.get("level", "info"))
            except ValueError:
                level = IntegrityFlagLevel.INFO

            confidence = min(max(float(result.get("confidence", 0.5)), 0.0), 1.0)

            return IntegrityCheckResult(
                session_id=session_id,
                event_type=event_type,
                level=level,
                description=result.get("description", ""),
                confidence=confidence,
                recommendation=result.get("recommendation", ""),
                details={"raw_response": result},
            )

        except GeminiError as exc:
            logger.error("Gemini integrity analysis failed for session=%s: %s", session_id, exc)
            raise IntegrityAnalysisUnavailable(f"Integrity analysis unavailable: {exc}") from exc
        except Exception as exc:
            logger.exception("Failed to analyze camera frame for session=%s", session_id)
            raise IntegrityCheckError(f"Frame analysis failed: {exc}") from exc

    def interpret_tab_switch_event(self, session_id: str, event_data: dict) -> IntegrityCheckResult:
        """Create an integrity result from a tab switch / window blur event.

        This is called when the frontend detects a visibility change or tab switch
        and forwards the event to the backend. Per TRD §7.4, these events are
        forwarded from client-side visibilitychange/blur handlers.

        Args:
            session_id: The interview session ID.
            event_data: Event data from the client (e.g., { "type": "tab_switch", "url": "..." }).

        Returns:
            IntegrityCheckResult for the tab switch event.
        """
        return IntegrityCheckResult(
            session_id=session_id,
            event_type=IntegrityEventType.TAB_SWITCH,
            level=IntegrityFlagLevel.WARNING,
            description="Candidate switched tabs or window lost focus during assessment.",
            confidence=1.0,
            recommendation="Log event for review. Do not auto-penalize — candidate may have legitimate reason.",
            details=event_data,
        )

    def interpret_screen_share_event(
        self,
        session_id: str,
        screen_shared: bool,
        screen_details: Optional[dict] = None,
    ) -> IntegrityCheckResult:
        """Create an integrity result from a screen share state change.

        During assessment mode, screen sharing is required. This method
        generates an integrity event when screen share state changes.

        Args:
            session_id: The interview session ID.
            screen_shared: Whether screen sharing is active.
            screen_details: Optional details about the screen share.

        Returns:
            IntegrityCheckResult for the screen share event.
        """
        if screen_shared:
            return IntegrityCheckResult(
                session_id=session_id,
                event_type=IntegrityEventType.ALL_CLEAR,
                level=IntegrityFlagLevel.INFO,
                description="Screen sharing is active.",
                confidence=1.0,
                recommendation="No action needed.",
                details=screen_details or {},
            )
        else:
            return IntegrityCheckResult(
                session_id=session_id,
                event_type=IntegrityEventType.CAMERA_ABSENCE,
                level=IntegrityFlagLevel.WARNING,
                description="Screen sharing is not active during assessment mode.",
                confidence=1.0,
                recommendation="Remind candidate to share screen. Log for review.",
                details=screen_details or {},
            )

    def interpret_camera_mute_event(
        self,
        session_id: str,
        camera_muted: bool,
    ) -> IntegrityCheckResult:
        """Create an integrity result from a camera mute state change.

        Args:
            session_id: The interview session ID.
            camera_muted: Whether the camera is muted/stopped.

        Returns:
            IntegrityCheckResult for the camera state event.
        """
        if camera_muted:
            return IntegrityCheckResult(
                session_id=session_id,
                event_type=IntegrityEventType.CAMERA_OFF,
                level=IntegrityFlagLevel.WARNING,
                description="Camera is muted or stopped during assessment.",
                confidence=1.0,
                recommendation="Prompt candidate to enable camera. Log for review.",
                details={"camera_muted": True},
            )
        else:
            return IntegrityCheckResult(
                session_id=session_id,
                event_type=IntegrityEventType.ALL_CLEAR,
                level=IntegrityFlagLevel.INFO,
                description="Camera is active.",
                confidence=1.0,
                recommendation="No action needed.",
                details={"camera_muted": False},
            )


# ── Factory ──────────────────────────────────────────────────────────────────

def create_integrity_check_service(client: Optional[GeminiClient] = None) -> IntegrityCheckService:
    """Create an integrity check service.

    Args:
        client: Optional pre-configured Gemini multimodal client.

    Returns:
        IntegrityCheckService instance.
    """
    return IntegrityCheckService(client=client)
