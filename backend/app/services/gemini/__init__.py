"""
EchoSphere Gemini Service.

Gemini API client and specialized analysis services:
- client.py: Gemini API client with dev mock mode
- setup_agent.py: Parse free-text to structured panel config (TRD §7.3)
- integrity_checks.py: Camera frame analysis for integrity verification
- vagueness_detection.py: Detect vague candidate answers (Master Build §33)
- contradiction_detection.py: Detect contradictions between claims (Master Build §34)

Uses Gemini Flash for off-path reasoning (setup, integrity, vagueness, contradiction).
Uses Gemini Live preset for Agora ConvoAI voice pipeline (configured in agora service).

IMPORTANT: Never exposes GEMINI_API_KEY to frontend. All API calls are server-side.
If API key is missing, uses clearly-marked dev mock mode — NEVER pretends mock is real.
"""

from .client import (  # noqa: F401, F403
    GeminiClient,
    GeminiError,
    GeminiConfigError,
    GeminiRateLimitError,
    GeminiUnavailableError,
    create_gemini_client,
    create_flash_client,
    create_multimodal_client,
    GEMINI_FLASH_MODEL,
    GEMINI_FLASH_LITE_MODEL,
    GEMINI_MULTIMODAL_MODEL,
)
from .setup_agent import (  # noqa: F401, F403
    parse_interview_setup,
    SetupAgentError,
    SetupAgentParseError,
    SetupParseResult,
    build_setup_prompt_for_display,
)
from .integrity_checks import (  # noqa: F401, F403
    IntegrityCheckService,
    IntegrityCheckResult,
    IntegrityCheckError,
    IntegrityAnalysisUnavailable,
    IntegrityEventType,
    IntegrityFlagLevel,
    create_integrity_check_service,
)
from .vagueness_detection import (  # noqa: F401, F403
    VaguenessDetectionService,
    VaguenessFlag,
    VaguenessDetectionError,
    VaguenessDetectionUnavailable,
    VaguenessLevel,
    create_vagueness_detection_service,
)
from .contradiction_detection import (  # noqa: F401, F403
    ContradictionDetectionService,
    ContradictionFlag,
    ContradictionDetectionError,
    ContradictionDetectionUnavailable,
    ContradictionType,
    create_contradiction_detection_service,
)
