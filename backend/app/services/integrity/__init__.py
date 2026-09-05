"""
EchoSphere Integrity Service.

Assessment integrity monitoring:
- Tab/window switch detection (from client events)
- Screen share monitoring
- Camera frame analysis via Gemini Flash multimodal
- Voiceprint enrollment and verification
- Periodic integrity check scheduling

Per TRD §7.4 and Master Build §62:
- Camera checks every 15-20s during assessment mode only
- All flags are descriptive + timestamped, never auto-penalizing (AGENT_CONTEXT.md rule 6)
- Integrity events stored in whiteboard_events as integrity_flag type

DEV MODE: If Gemini API key is missing, uses mock analysis.
NEVER pretends mock is real AI.
"""

from .service import (  # noqa: F401, F403
    IntegrityService,
    IntegrityEvent,
    IntegrityEventTypeEnum,
    VoiceprintProfile,
    VoiceprintVerificationResult,
    IntegrityServiceError,
    create_integrity_service,
)
