"""Schemas for report generation and display."""
from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class EvidenceLink(BaseModel):
    """A single piece of evidence linked to a transcript turn."""
    competency: str
    transcript_turn_id: str
    whiteboard_event_id: Optional[str] = None
    timestamp: str  # Format: "MM:SS" relative to session start
    quote: str
    type: str = "statement"  # "statement", "achievement", "weakness", "strength"


class CompetencyScoreDetail(BaseModel):
    """Detailed score for a single competency."""
    score: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    strengths: list[str] = []
    weaknesses: list[str] = []
    evidence: list[EvidenceLink] = []
    persona: Optional[str] = None  # Which persona assessed this


class PanelDisagreementItem(BaseModel):
    """A single disagreement between personas."""
    persona_a: str
    persona_b: str
    area: str  # e.g., "System Design Depth"
    persona_a_perspective: str
    persona_b_perspective: str
    resolution: Optional[str] = None


class PanelDisagreement(BaseModel):
    """Aggregate panel disagreement analysis."""
    detected: bool = False
    pairs: list[PanelDisagreementItem] = []
    summary: str = ""


class ReportSummary(BaseModel):
    """Top-level report summary."""
    id: str
    session_id: str
    candidate_id: str
    candidate_name: str
    target_role: str
    target_company: Optional[str] = None
    target_domain: Optional[str] = None
    mode: str  # "practice" or "assessment"
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: int = 0
    overall_score: float = Field(ge=0, le=100)
    overall_confidence: float = Field(ge=0, le=1)
    generated_at: datetime
    status: str = "completed"


class ReportDetail(ReportSummary):
    """Full report with all details."""
    competency_scores: dict[str, CompetencyScoreDetail] = {}
    evidence_links: list[EvidenceLink] = []
    panel_disagreement: Optional[PanelDisagreement] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendations: list[str] = []
    persona_scores: dict[str, float] = {}  # persona -> avg score
    difficulty_progression: list[dict] = []  # [{competency, from, to, timestamp}]
    interview_timeline: list[dict] = []  # [{persona, start_time, end_time, topic}]


class ReportListResponse(BaseModel):
    """Paginated list of reports."""
    reports: list[ReportSummary]
    total: int
    page: int = 1
    page_size: int = 20


class ReportGenerationRequest(BaseModel):
    """Request to generate a report (usually triggered async after session end)."""
    session_id: str
    include_ai_narrative: bool = True
    include_panel_disagreement: bool = True
    include_recommendations: bool = True


class ReportGenerationStatus(BaseModel):
    """Status of an async report generation job."""
    report_id: str
    session_id: str
    status: str  # "pending", "generating", "completed", "failed"
    progress: Optional[float] = None
    error: Optional[str] = None
    completed_at: Optional[datetime] = None


class RoadmapEntry(BaseModel):
    """A single entry in a candidate's roadmap/competency ledger."""
    competency: str
    score: float = Field(ge=0, le=100)
    progress: float = Field(ge=0, le=1)
    level: str = "beginner"  # "beginner", "intermediate", "advanced", "expert"
    sessions_count: int = 0
    last_practice_at: Optional[datetime] = None
    trend: str = "stable"  # "improving", "stable", "declining"
    next_focus_areas: list[str] = []


class RoadmapResponse(BaseModel):
    """Candidate's persistent roadmap across sessions."""
    student_id: str
    competency_ledger: dict[str, RoadmapEntry] = {}
    updated_at: datetime
    sessions_count: int = 0
    overall_progress: float = Field(ge=0, le=1)


class ReportEvidenceRequest(BaseModel):
    """Request to get specific evidence for a report."""
    session_id: str
    competency: Optional[str] = None  # Filter by competency
    evidence_type: Optional[str] = None  # "strength", "weakness", "statement"


class ReportEvidenceResponse(BaseModel):
    """Response containing filtered evidence items."""
    session_id: str
    evidence: list[EvidenceLink]
    total: int
