"""
EchoSphere Reporting Service.

Final report generation and deterministic competency scoring:
- generator.py: Full report generation from whiteboard state
- scoring.py: Deterministic scoring engine with evidence and transparency

Per AGENT_CONTEXT.md rule 3: Every score needs evidence linked to transcript_turn_id + whiteboard_event_id.
Per Master Build §82: Deterministic scoring, no unsupported LLM score becomes final score directly.
"""

from .generator import (  # noqa: F401, F403
    ReportGeneratorService,
    FinalReport,
    CompetencyScore,
    EvidenceLink,
    PanelDisagreement,
    ReportGenerationError,
    create_report_generator,
)
from .scoring import (  # noqa: F401, F403
    DeterministicScoringEngine,
    ScoringWeights,
    ScoreCalculationInput,
    ScoreBreakdown,
    CompetencyScoreWithBreakdown,
    ScoreValidator,
    ScoringEngineError,
    create_scoring_engine,
    create_default_scoring_engine,
    DEFAULT_COMPETENCY_WEIGHTS,
    EXTENDED_COMPETENCY_WEIGHTS,
)
