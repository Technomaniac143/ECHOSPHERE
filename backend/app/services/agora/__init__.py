"""
EchoSphere Agora Service.

Modular Agora integration with:
- client.py: HTTP client for Agora REST APIs
- token_service.py: RTC token generation (server-side, certificate never exposed)
- conversation_service.py: ConvoAI agent lifecycle (start/stop/interrupt)
- recording_service.py: Cloud recording start/stop
- types.py: Type definitions and Pydantic models

IMPORTANT: Never exposes API keys to frontend. All credentials used server-side only.
If Agora API field names change (v2.4-v2.7 known to ship with changes), only this
layer needs modification — it's the adapter boundary.
"""

from .types import *  # noqa: F401, F403
from .token_service import (  # noqa: F401, F403
    generate_rtc_token,
    generate_rtc_token_async,
    generate_token_for_session,
    configure_dev_mode,
)
from .conversation_service import (  # noqa: F401, F403
    start_convo_agent,
    stop_convo_agent,
    interrupt_convo_agent,
    build_system_message,
    get_disclosure_text,
    ConvoAIError,
    ConvoAIConfigError,
    ConvoAIAgentNotRunningError,
    ConvoAIUnavailableError,
)
from .recording_service import (  # noqa: F401, F403
    start_cloud_recording,
    stop_cloud_recording,
    get_recording_status,
    build_recording_reference,
    CloudRecordingError,
    CloudRecordingStartError,
    CloudRecordingStopError,
    CloudRecordingNotFoundError,
)
