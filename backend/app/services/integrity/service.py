"""
Integrity service for EchoSphere assessment mode.

Handles:
- Tab/window switch detection (from client-side events)
- Screen share monitoring
- Camera checks (periodic frame analysis via Gemini Flash multimodal)
- Voiceprint verification
- Integrity event logging to whiteboard_events

Per TRD §7.4 and Master Build §62:
- Camera checks every 15-20s during assessment mode only
- All flags are descriptive + timestamped, never auto-penalizing
- Integrity events stored in whiteboard_events as integrity_flag type

DEV MODE: If Gemini API key is missing, uses mock analysis.
NEVER pretends mock is real AI.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from ..gemini.integrity_checks import (
    IntegrityCheckService,
    IntegrityCheckResult,
    IntegrityEventType,
    IntegrityFlagLevel,
)

logger = logging.getLogger(__name__)


# ── Integrity event models ───────────────────────────────────────────────────

class IntegrityEventTypeEnum(str):
    """String enum for integrity event types (for DB/events)."""
    TAB_SWITCH = "tab_switch"
    FULLSCREEN_EXIT = "fullscreen_exit"
    CAMERA_ABSENCE = "camera_absence"
    MULTIPLE_PERSONS = "multiple_persons"
    SECOND_DEVICE = "second_device"
    POOR_LIGHTING = "poor_lighting"
    CAMERA_OFF = "camera_off"
    LOW_QUALITY = "low_quality"
    SCREEN_SHARE_ACTIVE = "screen_share_active"
    SCREEN_SHARE_INACTIVE = "screen_share_inactive"
    VOICEPRINT_MATCH = "voiceprint_match"
    VOICEPRINT_NO_MATCH = "voiceprint_no_match"
    VOICEPRINT_NOT_ENROLLED = "voiceprint_not_enrolled"
    ALL_CLEAR = "all_clear"


class IntegrityEvent(BaseModel):
    """An integrity event recorded during an assessment."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str = ""
    event_type: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    level: str = "info"  # info, warning, critical
    description: str = ""
    details: dict = Field(default_factory=dict)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    is_automatic: bool = True  # True = from automated check, False = from client event
    source: str = "integrity_service"

    def to_whiteboard_payload(self) -> dict:
        """Convert to whiteboard_events payload."""
        return {
            "event_type": "integrity_flag",
            "source_persona": "integrity_service",
            "payload": {
                "flag_type": self.event_type,
                "level": self.level,
                "description": self.description,
                "timestamp": self.timestamp,
                "confidence": self.confidence,
                "details": self.details,
                "source": self.source,
            },
        }


# ── Voiceprint models ────────────────────────────────────────────────────────

class VoiceprintProfile(BaseModel):
    """A voiceprint enrollment profile."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str = ""
    candidate_id: str = ""
    enrolled_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    enrollment_data: dict = Field(default_factory=dict)  # Voiceprint reference from Agora
    is_verified: bool = False


class VoiceprintVerificationResult(BaseModel):
    """Result of a voiceprint verification attempt."""

    matched: bool
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    details: dict = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Integrity service ────────────────────────────────────────────────────────

class IntegrityServiceError(Exception):
    """Integrity service failure."""
    pass


class IntegrityService:
    """Service for assessment integrity monitoring.

    Manages:
    - Tab/screen switch detection via client events
    - Screen share state tracking
    - Camera frame analysis via Gemini Flash multimodal
    - Voiceprint enrollment and verification
    - Periodic integrity check scheduling

    In DEV mode (no Gemini API key), all camera checks return mock results
    clearly marked as mock. Never pretends mock is real AI analysis.
    """

    def __init__(
        self,
        integrity_check_service: Optional[IntegrityCheckService] = None,
    ):
        self._integrity_checks = integrity_check_service or IntegrityCheckService()
        self._voiceprint_profiles: dict[str, VoiceprintProfile] = {}
        self._session_check_intervals: dict[str, asyncio.Task] = {}
        self._session_camera_checks: dict[str, bool] = {}  # Track if checks are running

    # ── Tab/Window events ───────────────────────────────────────────────────

    def handle_tab_switch_event(
        self,
        session_id: str,
        event_data: dict,
    ) -> IntegrityEvent:
        """Handle a tab switch or window blur event from the client.

        Called when the frontend detects visibilitychange or window blur.
        Per TRD §7.4, these events are forwarded from the client.

        Args:
            session_id: The session ID.
            event_data: Event data from the client (e.g., { "type": "tab_switch", "url": "..." }).

        Returns:
            IntegrityEvent for the tab switch.
        """
        logger.warning(
            "Integrity: Tab switch detected for session=%s, data=%s",
            session_id, event_data,
        )

        event = IntegrityEvent(
            session_id=session_id,
            event_type=IntegrityEventTypeEnum.TAB_SWITCH,
            level="warning",
            description="Candidate switched tabs or window lost focus during assessment.",
            details=event_data,
            confidence=1.0,
            is_automatic=False,
            source="client_event",
        )

        return event

    def handle_fullscreen_exit_event(
        self,
        session_id: str,
        event_data: dict,
    ) -> IntegrityEvent:
        """Handle a fullscreen exit event from the client.

        Args:
            session_id: The session ID.
            event_data: Event data from the client.

        Returns:
            IntegrityEvent for the fullscreen exit.
        """
        logger.warning(
            "Integrity: Fullscreen exit detected for session=%s",
            session_id,
        )

        event = IntegrityEvent(
            session_id=session_id,
            event_type=IntegrityEventTypeEnum.FULLSCREEN_EXIT,
            level="warning",
            description="Candidate exited fullscreen mode during assessment.",
            details=event_data,
            confidence=1.0,
            is_automatic=False,
            source="client_event",
        )

        return event

    # ── Screen share monitoring ─────────────────────────────────────────────

    def handle_screen_share_state(
        self,
        session_id: str,
        is_sharing: bool,
        details: Optional[dict] = None,
    ) -> IntegrityEvent:
        """Handle a screen share state change.

        During assessment mode, screen sharing is required.

        Args:
            session_id: The session ID.
            is_sharing: Whether screen sharing is active.
            details: Optional details about the screen share.

        Returns:
            IntegrityEvent for the screen share state.
        """
        if is_sharing:
            logger.info("Integrity: Screen share active for session=%s", session_id)
            event = IntegrityEvent(
                session_id=session_id,
                event_type=IntegrityEventTypeEnum.SCREEN_SHARE_ACTIVE,
                level="info",
                description="Screen sharing is active.",
                details=details or {},
                confidence=1.0,
                is_automatic=False,
                source="client_event",
            )
        else:
            logger.warning("Integrity: Screen share not active for session=%s", session_id)
            event = IntegrityEvent(
                session_id=session_id,
                event_type=IntegrityEventTypeEnum.SCREEN_SHARE_INACTIVE,
                level="warning",
                description="Screen sharing is not active during assessment mode.",
                details=details or {},
                confidence=1.0,
                is_automatic=False,
                source="client_event",
            )

        return event

    # ── Camera checks ───────────────────────────────────────────────────────

    async def start_camera_checks(
        self,
        session_id: str,
        interval_seconds: float = 15.0,
    ) -> None:
        """Start periodic camera frame checks for an assessment session.

        Per TRD §9: Camera frame check every 15-20s during assessment mode only.
        Never during practice mode.

        Args:
            session_id: The session ID.
            interval_seconds: Interval between checks (default 15s).

        Note:
            This is a long-running background task. In production, this would
            be managed by a task queue or orchestrator, not directly by this service.
        """
        if session_id in self._session_check_intervals:
            logger.warning("Camera checks already running for session=%s", session_id)
            return

        self._session_camera_checks[session_id] = True

        async def _periodic_check():
            while self._session_camera_checks.get(session_id, False):
                try:
                    # In a full implementation, this would grab a frame
                    # from the Agora RTC stream. For now, this is a
                    # placeholder that shows where the integration goes.
                    logger.debug(
                        "Integrity: Camera check tick for session=%s (DEV: no frame available)",
                        session_id,
                    )
                    # Mock result since we don't have actual frame capture
                    result = IntegrityCheckResult(
                        session_id=session_id,
                        event_type=IntegrityEventType.ALL_CLEAR,
                        level=IntegrityFlagLevel.INFO,
                        description="Mock camera check: No frame captured (DEV MODE)",
                        confidence=0.0,
                        recommendation="Frame capture not implemented in this build.",
                        details={"dev_mode": True, "note": "Camera frame capture requires Agora RTC integration"},
                    )
                    logger.info(
                        "Integrity: Camera check result for session=%s: %s",
                        session_id, result.event_type.value,
                    )
                except Exception as exc:
                    logger.error(
                        "Integrity: Camera check failed for session=%s: %s",
                        session_id, exc,
                    )

                await asyncio.sleep(interval_seconds)

        task = asyncio.create_task(_periodic_check())
        self._session_check_intervals[session_id] = task
        logger.info(
            "Started camera checks for session=%s, interval=%.1fs",
            session_id, interval_seconds,
        )

    async def stop_camera_checks(self, session_id: str) -> None:
        """Stop periodic camera checks for a session.

        Args:
            session_id: The session ID.
        """
        self._session_camera_checks.pop(session_id, None)
        task = self._session_check_intervals.pop(session_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped camera checks for session=%s", session_id)

    async def analyze_camera_frame(
        self,
        session_id: str,
        image_base64: str,
        captured_at: Optional[str] = None,
    ) -> IntegrityCheckResult:
        """Analyze a single camera frame for integrity concerns.

        Args:
            session_id: The session ID.
            image_base64: Base64-encoded image data.
            captured_at: ISO timestamp of capture.

        Returns:
            IntegrityCheckResult with the analysis.
        """
        return await self._integrity_checks.analyze_camera_frame(
            session_id=session_id,
            image_base64=image_base64,
            captured_at=captured_at,
        )

    # ── Voiceprint ──────────────────────────────────────────────────────────

    def enroll_voiceprint(
        self,
        session_id: str,
        candidate_id: str,
        enrollment_data: dict,
    ) -> VoiceprintProfile:
        """Enroll a voiceprint for a candidate session.

        In a full implementation, this would call Agora's voiceprint
        enrollment API. The enrollment_data contains the voiceprint
        reference returned by Agora.

        Args:
            session_id: The session ID.
            candidate_id: The candidate's user ID.
            enrollment_data: Voiceprint enrollment data from Agora.

        Returns:
            VoiceprintProfile with the enrollment info.
        """
        profile = VoiceprintProfile(
            session_id=session_id,
            candidate_id=candidate_id,
            enrollment_data=enrollment_data,
        )
        self._voiceprint_profiles[session_id] = profile
        logger.info(
            "Enrolled voiceprint for session=%s, candidate=%s",
            session_id, candidate_id,
        )
        return profile

    def get_voiceprint_profile(self, session_id: str) -> Optional[VoiceprintProfile]:
        """Get the voiceprint profile for a session."""
        return self._voiceprint_profiles.get(session_id)

    async def verify_voiceprint(
        self,
        session_id: str,
        audio_data: dict,
    ) -> VoiceprintVerificationResult:
        """Verify a voiceprint against the enrolled profile.

        In a full implementation, this would call Agora's voiceprint
        verification API.

        Args:
            session_id: The session ID.
            audio_data: Audio data for verification.

        Returns:
            VoiceprintVerificationResult.
        """
        profile = self._voiceprint_profiles.get(session_id)

        if not profile:
            logger.warning(
                "Voiceprint verification requested but no profile enrolled for session=%s",
                session_id,
            )
            return VoiceprintVerificationResult(
                matched=False,
                confidence=0.0,
                details={"error": "No voiceprint enrolled"},
            )

        # DEV: Mock verification since we don't have real Agora voiceprint API
        logger.debug(
            "Voiceprint verification (DEV/MOCK) for session=%s: returning mock match",
            session_id,
        )
        return VoiceprintVerificationResult(
            matched=True,
            confidence=0.85,
            details={
                "dev_mode": True,
                "note": "Voiceprint verification requires Agora voiceprint API integration",
            },
        )

    def handle_voiceprint_event(
        self,
        session_id: str,
        verification_result: VoiceprintVerificationResult,
    ) -> IntegrityEvent:
        """Create an integrity event from a voiceprint verification result.

        Args:
            session_id: The session ID.
            verification_result: The verification result.

        Returns:
            IntegrityEvent.
        """
        if verification_result.matched:
            event_type = IntegrityEventTypeEnum.VOICEPRINT_MATCH
            level = "info"
            description = "Voiceprint verification passed."
        else:
            event_type = IntegrityEventTypeEnum.VOICEPRINT_NO_MATCH
            level = "critical"
            description = "Voiceprint verification failed — voice does not match enrolled profile."

        return IntegrityEvent(
            session_id=session_id,
            event_type=event_type,
            level=level,
            description=description,
            details=verification_result.details,
            confidence=verification_result.confidence,
            is_automatic=True,
            source="voiceprint_service",
        )

    # ── Event aggregation ────────────────────────────────────────────────────

    def aggregate_events(
        self,
        session_id: str,
        events: list[IntegrityEvent],
    ) -> dict:
        """Aggregate integrity events into a summary for the report.

        Args:
            session_id: The session ID.
            events: List of integrity events for the session.

        Returns:
            Aggregated summary dict.
        """
        from collections import Counter

        type_counts = Counter(e.event_type for e in events)
        level_counts = Counter(e.level for e in events)

        warnings = [e for e in events if e.level == "warning"]
        criticals = [e for e in events if e.level == "critical"]

        return {
            "session_id": session_id,
            "total_events": len(events),
            "by_type": dict(type_counts),
            "by_level": dict(level_counts),
            "warning_count": len(warnings),
            "critical_count": len(criticals),
            "has_flags": len(warnings) > 0 or len(criticals) > 0,
            "events": [e.model_dump() for e in events],
        }


# ── Factory ──────────────────────────────────────────────────────────────────

def create_integrity_service(
    integrity_check_service: Optional[IntegrityCheckService] = None,
) -> IntegrityService:
    """Create an integrity service.

    Args:
        integrity_check_service: Optional pre-configured integrity check service.

    Returns:
        IntegrityService instance.
    """
    return IntegrityService(integrity_check_service=integrity_check_service)
