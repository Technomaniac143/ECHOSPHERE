"""
EchoSphere Interview Service.

Session lifecycle management and dynamic question generation:
- manager.py: Session state machine (LOBBY → ... → COMPLETED/ABANDONED)
- question_generator.py: Dynamic question generation from whiteboard state

Per AGENT_CONTEXT.md:
- Rule 2: Every mutation writes to whiteboard_events for audit trail
- Rule 5: Difficulty adjusts per-competency, not globally
- Rule 8: No fixed question sequences — questions generated live from whiteboard state
"""

from .manager import (  # noqa: F401, F403
    InterviewManager,
    InterviewSession,
    SessionStatus,
    SessionStateTransitionError,
    SessionNotFoundError,
    SessionAlreadyStartedError,
    SessionAlreadyEndedError,
    SessionStore,
    create_interview_manager,
)
from .question_generator import (  # noqa: F401, F403
    QuestionGeneratorService,
    GeneratedQuestion,
    QuestionType,
    DifficultyLevel,
    QuestionGenerationError,
    create_question_generator,
)
